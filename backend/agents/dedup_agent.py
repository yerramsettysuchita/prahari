"""dedup_agent — the civic intelligence node of the Prahari agent graph.

The same pothole reported by 40 people should be one case affecting 40 citizens,
not 40 ignored reports. This agent finds whether a new report is the same
physical issue as an existing open case, so the system merges instead of
duplicating and the citizensAffected number can do its accountability work.

Exposes:
  * `dedup_agent`         an ADK Agent declaration for the orchestrator graph.
  * `find_duplicate(...)` the concrete callable used by the /report endpoint.

The callable never raises. Any failure returns "not a duplicate" so a report is
always honored as a new case rather than being lost.
"""

from __future__ import annotations

import json
import math
import os
from typing import Optional, TypedDict

# A merge is only considered within this radius and at or above this confidence.
RADIUS_METERS = 50.0
CONFIDENCE_THRESHOLD = 0.75
# How many of the closest candidates we ask the model to judge.
MAX_CANDIDATES = 5

# Issue types that could plausibly describe the same physical damage.
COMPATIBLE_TYPES = {
    "pothole": {"pothole", "road_crack"},
    "road_crack": {"road_crack", "pothole"},
    "debris": {"debris"},
    "waterlogging": {"waterlogging"},
    "unknown": {"pothole", "road_crack", "debris", "waterlogging", "unknown"},
}

INSTRUCTION = (
    "You are the deduplication judge for Prahari, a civic road-issue platform. "
    "A new report has arrived. You are given the new report and a short list of "
    "nearby existing open cases of a compatible type. Decide whether the new "
    "report is the SAME physical road issue as one of the existing cases, using "
    "issue type, how close they are in meters, and the descriptions. Be careful. "
    "Two separate potholes ten meters apart are different cases. Only call it a "
    "duplicate when it is clearly the same spot and the same damage.\n\n"
    "Return isDuplicate, the matchedCaseId of the existing case if it is a "
    "duplicate or null otherwise, a confidence from 0 to 1, and one short plain "
    "reasoning sentence. Do not use dashes of any kind. Do not use emoji."
)

_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "isDuplicate": {"type": "boolean"},
        "matchedCaseId": {"type": ["string", "null"]},
        "confidence": {"type": "number"},
        "reasoning": {"type": "string"},
    },
    "required": ["isDuplicate", "matchedCaseId", "confidence", "reasoning"],
}


class DedupResult(TypedDict):
    isDuplicate: bool
    matchedCaseId: Optional[str]
    confidence: float
    reasoning: str


def _strip_dashes(text: str) -> str:
    if not text:
        return text
    cleaned = text.replace("—", " ").replace("–", " ").replace(" - ", " ")
    return " ".join(cleaned.split()).strip()


def _not_duplicate(reasoning: str = "No matching open case nearby.") -> DedupResult:
    return DedupResult(
        isDuplicate=False,
        matchedCaseId=None,
        confidence=0.0,
        reasoning=_strip_dashes(reasoning),
    )


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in meters between two lat/lng points."""
    r = 6371000.0  # earth radius in meters
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dlam / 2) ** 2
    )
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def _compatible(new_type: str, existing_type: str) -> bool:
    allowed = COMPATIBLE_TYPES.get(new_type, {new_type})
    return existing_type in allowed


def nearby_candidates(
    new_lat: float,
    new_lng: float,
    new_type: str,
    open_cases: list[dict],
) -> list[dict]:
    """Open cases within RADIUS_METERS and of a compatible type, closest first.

    Each returned dict carries a 'distance_m' field for the model and the caller.
    """
    out: list[dict] = []
    for c in open_cases:
        if c.get("status") == "verified_resolved":
            continue
        loc = c.get("location") or {}
        lat, lng = loc.get("lat"), loc.get("lng")
        if lat is None or lng is None:
            continue
        if not _compatible(new_type, c.get("type", "unknown")):
            continue
        dist = haversine_m(new_lat, new_lng, float(lat), float(lng))
        if dist <= RADIUS_METERS:
            out.append({**c, "distance_m": round(dist, 1)})
    out.sort(key=lambda c: c["distance_m"])
    return out[:MAX_CANDIDATES]


def _client():
    try:
        from google import genai

        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        return genai.Client(api_key=api_key) if api_key else genai.Client()
    except Exception as exc:  # pragma: no cover
        print(f"[dedup_agent] genai client unavailable: {exc}")
        return None


def find_duplicate(
    new_lat: float,
    new_lng: float,
    new_type: str,
    new_description: str,
    open_cases: list[dict],
) -> DedupResult:
    """Decide whether a new report duplicates an existing open case.

    Always returns a result, never raises. Returns not-a-duplicate when unsure.
    """
    candidates = nearby_candidates(new_lat, new_lng, new_type, open_cases or [])
    if not candidates:
        return _not_duplicate()

    client = _client()
    # Without a model we stay conservative and create a new case.
    if client is None:
        return _not_duplicate("Could not run the duplicate check, treating as new.")

    try:
        from google.genai import types

        candidate_lines = [
            {
                "caseId": c.get("id"),
                "type": c.get("type"),
                "distanceMeters": c.get("distance_m"),
                "description": c.get("description", ""),
                "citizensAffected": c.get("citizensAffected", 1),
            }
            for c in candidates
        ]

        payload = {
            "newReport": {
                "type": new_type,
                "description": new_description,
                "lat": new_lat,
                "lng": new_lng,
            },
            "nearbyOpenCases": candidate_lines,
        }

        response = client.models.generate_content(
            model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
            contents=[
                "Decide if the new report duplicates one of the nearby cases.\n"
                + json.dumps(payload, ensure_ascii=False)
            ],
            config=types.GenerateContentConfig(
                system_instruction=INSTRUCTION,
                response_mime_type="application/json",
                response_schema=_RESPONSE_SCHEMA,
                temperature=0.1,
            ),
        )

        data = json.loads((response.text or "").strip())
        is_dup = bool(data.get("isDuplicate", False))
        matched = data.get("matchedCaseId")
        reasoning = _strip_dashes(str(data.get("reasoning", "")).strip())
        try:
            confidence = max(0.0, min(1.0, float(data.get("confidence", 0.0))))
        except (TypeError, ValueError):
            confidence = 0.0

        valid_ids = {c.get("id") for c in candidates}

        # Guard rail: confident, matched to a real in-radius candidate.
        if is_dup and matched in valid_ids and confidence >= CONFIDENCE_THRESHOLD:
            return DedupResult(
                isDuplicate=True,
                matchedCaseId=matched,
                confidence=confidence,
                reasoning=reasoning or "Matches an existing report at the same spot.",
            )

        return _not_duplicate(
            reasoning or "Not confident this is the same issue, treating as new."
        )
    except Exception as exc:
        print(f"[dedup_agent] dedup check failed: {exc}")
        return _not_duplicate("Duplicate check failed, treating as a new case.")


# --------------------------------------------------------------------------- #
# ADK agent declaration (used by the orchestrator graph in later steps).
# Guarded so an ADK import/version mismatch can never take down the API.
# --------------------------------------------------------------------------- #
dedup_agent = None
try:  # pragma: no cover - declaration only
    from google.adk.agents import Agent

    dedup_agent = Agent(
        name="dedup_agent",
        model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
        description="Judges whether a new road report duplicates a nearby open case.",
        instruction=INSTRUCTION,
    )
except Exception as exc:  # pragma: no cover
    print(f"[dedup_agent] ADK agent not declared ({exc}); using direct judge.")
