"""intake_agent — the first node of the Prahari agent graph.

Multimodal classification of a road issue from an image plus location and an
optional note. Uses gemini-flash-latest to return strict structured JSON:
issueType, severity, and a one-line plain-language description.

This module exposes two things:
  * `intake_agent`        an ADK Agent declaration used by the orchestrator graph.
  * `classify_intake(...)` the concrete callable used by the /report endpoint.

The app must never crash on classification failure. `classify_intake` always
returns a result; on any error it returns a low-confidence "unknown" result and
the caller decides what to persist.
"""

from __future__ import annotations

import json
import os
import traceback
from typing import Optional, TypedDict

ISSUE_TYPES = ("pothole", "road_crack", "debris", "waterlogging")
SEVERITIES = ("low", "medium", "high")

INSTRUCTION = (
    "You are the intake classifier for Prahari, a civic road-issue platform for "
    "one Indian city. You only handle road damage. Look at the photo, the "
    "location, and the optional citizen note, then classify the issue.\n\n"
    "Return issueType as exactly one of: pothole, road_crack, debris, "
    "waterlogging. Return severity as exactly one of: low, medium, high, judged "
    "by how dangerous it is to road users. Write description as one short, plain "
    "sentence a person would actually say, naming what you see and roughly where. "
    "Do not use dashes of any kind in the description. Do not use emoji. If the "
    "photo clearly does not show a road issue, pick the closest type and set "
    "severity low."
)


class IntakeResult(TypedDict):
    issueType: str
    severity: str
    description: str
    confidence: float


# JSON schema handed to Gemini for guaranteed-shape output.
_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "issueType": {"type": "string", "enum": list(ISSUE_TYPES)},
        "severity": {"type": "string", "enum": list(SEVERITIES)},
        "description": {"type": "string"},
        "confidence": {"type": "number"},
    },
    "required": ["issueType", "severity", "description", "confidence"],
}


def _strip_dashes(text: str) -> str:
    """Enforce the permanent no-dash copy rule on model output."""
    if not text:
        return text
    cleaned = text.replace("—", " ").replace("–", " ").replace(" - ", " ")
    # collapse any double spaces the replacement introduced
    return " ".join(cleaned.split()).strip()


def _unknown(note: Optional[str] = None) -> IntakeResult:
    desc = "Unclassified road issue awaiting review."
    if note:
        desc = _strip_dashes(note.strip()) or desc
    return IntakeResult(
        issueType="unknown", severity="medium", description=desc, confidence=0.0
    )


def _client():
    """Lazily build a google-genai client. Returns None if unavailable."""
    try:
        from google import genai

        google_key = os.environ.get("GOOGLE_API_KEY")
        gemini_key = os.environ.get("GEMINI_API_KEY")
        api_key = google_key or gemini_key
        # TEMP DIAGNOSTIC: which key env is present (never log the value).
        print(
            f"[intake_agent][diag] GOOGLE_API_KEY present={bool(google_key)} "
            f"GEMINI_API_KEY present={bool(gemini_key)} "
            f"using={'GOOGLE_API_KEY' if google_key else ('GEMINI_API_KEY' if gemini_key else 'none/ADC')} "
            f"key_len={len(api_key) if api_key else 0} "
            f"key_prefix={api_key[:3] if api_key else ''}"
        )
        if api_key:
            return genai.Client(api_key=api_key)
        # Fall back to ADC / Vertex configuration if present.
        return genai.Client()
    except Exception as exc:  # pragma: no cover
        print(f"[intake_agent] genai client unavailable: {exc}")
        return None


def classify_intake(
    image_bytes: Optional[bytes],
    mime_type: str,
    lat: float,
    lng: float,
    note: Optional[str] = None,
) -> IntakeResult:
    """Classify a road issue. Always returns a result, never raises."""
    client = _client()
    # TEMP DIAGNOSTIC: surface why classification might short-circuit.
    print(
        f"[intake_agent][diag] classify_intake called: client={'ok' if client else 'None'} "
        f"image_bytes={len(image_bytes) if image_bytes else 0} mime={mime_type}"
    )
    if client is None or not image_bytes:
        print(
            "[intake_agent][diag] short-circuit to unknown: "
            f"reason={'no client' if client is None else 'no image bytes'}"
        )
        return _unknown(note)

    try:
        from google.genai import types

        location_line = f"Location: latitude {lat}, longitude {lng}."
        note_line = f"Citizen note: {note.strip()}" if note and note.strip() else "Citizen note: none."

        print("[intake_agent][diag] calling Gemini model=gemini-flash-latest")
        response = client.models.generate_content(
            model="gemini-flash-latest",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type or "image/jpeg"),
                f"{location_line}\n{note_line}\n\nClassify this road issue.",
            ],
            config=types.GenerateContentConfig(
                system_instruction=INSTRUCTION,
                response_mime_type="application/json",
                response_schema=_RESPONSE_SCHEMA,
                temperature=0.2,
            ),
        )

        raw = (response.text or "").strip()
        # TEMP DIAGNOSTIC: log the raw model output before parsing.
        print(f"[intake_agent][diag] raw model response (first 500 chars): {raw[:500]!r}")
        data = json.loads(raw)

        issue = data.get("issueType")
        severity = data.get("severity")
        if issue not in ISSUE_TYPES:
            issue = "unknown"
        if severity not in SEVERITIES:
            severity = "medium"

        description = _strip_dashes(str(data.get("description", "")).strip())
        if not description:
            description = "Road issue reported by a citizen."

        confidence = data.get("confidence", 0.5)
        try:
            confidence = max(0.0, min(1.0, float(confidence)))
        except (TypeError, ValueError):
            confidence = 0.5

        return IntakeResult(
            issueType=issue,
            severity=severity,
            description=description,
            confidence=confidence,
        )
    except Exception as exc:
        # TEMP DIAGNOSTIC: surface the full error type and traceback so the
        # real production failure is visible instead of the silent fallback.
        print(f"[intake_agent][diag] classification raised {type(exc).__name__}: {exc}")
        print("[intake_agent][diag] traceback:\n" + traceback.format_exc())
        return _unknown(note)


# --------------------------------------------------------------------------- #
# ADK agent declaration (used by the orchestrator graph in later steps).
# Guarded so an ADK import/version mismatch can never take down the API.
# --------------------------------------------------------------------------- #
intake_agent = None
try:  # pragma: no cover - declaration only
    from google.adk.agents import Agent

    intake_agent = Agent(
        name="intake_agent",
        model="gemini-flash-latest",
        description="Classifies a road issue from a photo, location, and note.",
        instruction=INSTRUCTION,
    )
except Exception as exc:  # pragma: no cover
    print(f"[intake_agent] ADK agent not declared ({exc}); using direct classifier.")
