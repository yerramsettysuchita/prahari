"""resolution_agent — the closed loop of the Prahari agent graph.

Proves a road issue is physically fixed by comparing the original "before"
photo against a follow-up "after" photo with Gemini Vision. Resolution is only
ever confirmed by visual evidence, never by a manual toggle.

Exposes:
  * `resolution_agent`        an ADK Agent declaration for the orchestrator graph.
  * `verify_resolution(...)`  the concrete callable used by the /verify endpoint.

The callable never raises. Any failure, low confidence, or a location mismatch
returns a `needs_review` verdict so a case is never falsely closed.
"""

from __future__ import annotations

import json
import os
import urllib.request
from typing import Optional, TypedDict

# A resolution is only accepted at or above this confidence.
CONFIDENCE_THRESHOLD = 0.7

INSTRUCTION = (
    "You are the resolution verifier for Prahari, a civic road-issue platform. "
    "You are given two photographs of a road: a BEFORE image showing a reported "
    "issue, and an AFTER image taken later. The reported issue type is provided. "
    "Do two things. First, judge whether the two photos plausibly show the same "
    "location, using road markings, kerbs, surroundings, and framing. Second, "
    "judge whether the reported issue is now physically fixed in the AFTER image. "
    "Be strict. A photo of a different smooth road does not prove a specific "
    "pothole was repaired. Fresh patch asphalt, a filled hole, or cleared debris "
    "count as resolved. Standing doubt means not resolved.\n\n"
    "Write reasoning as one short, plain sentence. Do not use dashes of any kind. "
    "Do not use emoji. Return your judgement as the required JSON."
)

_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "sameLocation": {"type": "boolean"},
        "resolved": {"type": "boolean"},
        "confidence": {"type": "number"},
        "reasoning": {"type": "string"},
    },
    "required": ["sameLocation", "resolved", "confidence", "reasoning"],
}


class VerifyResult(TypedDict):
    sameLocation: bool
    resolved: bool
    confidence: float
    reasoning: str
    verdict: str  # "verified_resolved" | "needs_review"


def _strip_dashes(text: str) -> str:
    if not text:
        return text
    cleaned = text.replace("—", " ").replace("–", " ").replace(" - ", " ")
    return " ".join(cleaned.split()).strip()


def _needs_review(reasoning: str, *, same: bool = False, conf: float = 0.0) -> VerifyResult:
    return VerifyResult(
        sameLocation=same,
        resolved=False,
        confidence=conf,
        reasoning=_strip_dashes(reasoning) or "Could not confirm resolution from the photos.",
        verdict="needs_review",
    )


def _client():
    try:
        from google import genai

        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        return genai.Client(api_key=api_key) if api_key else genai.Client()
    except Exception as exc:  # pragma: no cover
        print(f"[resolution_agent] genai client unavailable: {exc}")
        return None


def _fetch_bytes(url: str) -> Optional[bytes]:
    """Download an image URL to bytes. Returns None on any failure."""
    if not url:
        return None
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            return resp.read()
    except Exception as exc:  # pragma: no cover
        print(f"[resolution_agent] could not fetch before image: {exc}")
        return None


def verify_resolution(
    case_id: str,
    issue_type: str,
    before_url: Optional[str],
    before_bytes: Optional[bytes],
    after_bytes: Optional[bytes],
    after_mime: str = "image/jpeg",
) -> VerifyResult:
    """Compare before and after photos. Always returns a verdict, never raises.

    Pass either `before_bytes` (already in memory) or `before_url` (fetched here).
    """
    if not after_bytes:
        return _needs_review("No follow-up photo was provided.")

    if before_bytes is None:
        before_bytes = _fetch_bytes(before_url or "")
    if before_bytes is None:
        return _needs_review(
            "The original photo is unavailable, so a comparison cannot be made."
        )

    client = _client()
    if client is None:
        return _needs_review("The vision service is unavailable. Saved for manual review.")

    try:
        from google.genai import types

        response = client.models.generate_content(
            model="gemini-flash-latest",
            contents=[
                "BEFORE image:",
                types.Part.from_bytes(data=before_bytes, mime_type="image/jpeg"),
                "AFTER image:",
                types.Part.from_bytes(data=after_bytes, mime_type=after_mime or "image/jpeg"),
                f"The reported issue type is: {issue_type}. Compare the two photos.",
            ],
            config=types.GenerateContentConfig(
                system_instruction=INSTRUCTION,
                response_mime_type="application/json",
                response_schema=_RESPONSE_SCHEMA,
                temperature=0.1,
            ),
        )

        data = json.loads((response.text or "").strip())
        same = bool(data.get("sameLocation", False))
        resolved = bool(data.get("resolved", False))
        reasoning = _strip_dashes(str(data.get("reasoning", "")).strip())

        try:
            confidence = max(0.0, min(1.0, float(data.get("confidence", 0.0))))
        except (TypeError, ValueError):
            confidence = 0.0

        # Guard rails. A confident resolution requires same location, the model
        # asserting resolved, and confidence at or above the threshold.
        if same and resolved and confidence >= CONFIDENCE_THRESHOLD:
            return VerifyResult(
                sameLocation=True,
                resolved=True,
                confidence=confidence,
                reasoning=reasoning or "The reported issue is no longer visible in the follow-up photo.",
                verdict="verified_resolved",
            )

        if not same:
            return _needs_review(
                reasoning or "The follow-up photo does not look like the same location.",
                same=False,
                conf=confidence,
            )

        return _needs_review(
            reasoning or "The issue still appears present or the evidence is not clear enough.",
            same=same,
            conf=confidence,
        )
    except Exception as exc:
        print(f"[resolution_agent] verification failed: {exc}")
        return _needs_review("The comparison could not be completed. Saved for manual review.")


# --------------------------------------------------------------------------- #
# ADK agent declaration (used by the orchestrator graph in later steps).
# Guarded so an ADK import/version mismatch can never take down the API.
# --------------------------------------------------------------------------- #
resolution_agent = None
try:  # pragma: no cover - declaration only
    from google.adk.agents import Agent

    resolution_agent = Agent(
        name="resolution_agent",
        model="gemini-flash-latest",
        description="Confirms a road issue is physically fixed by comparing before and after photos.",
        instruction=INSTRUCTION,
    )
except Exception as exc:  # pragma: no cover
    print(f"[resolution_agent] ADK agent not declared ({exc}); using direct verifier.")
