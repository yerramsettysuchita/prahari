"""insight_agent — the predictive civic risk node of the Prahari agent graph.

Aggregates open cases per ward (count, cluster density, average unresolved age)
and produces a short, grounded, plain-language risk read per high-load ward. The
read is grounded in the actual case counts; it never invents statistics.

Exposes:
  * `insight_agent`        an ADK Agent declaration for the orchestrator graph.
  * `ward_insights(...)`   the concrete callable used by the /insights endpoint.

Never raises. If the model is unavailable, a deterministic risk level and note
are derived from the real counts so insights always return.
"""

from __future__ import annotations

import json
import os
from typing import TypedDict

from analytics import compute_ward_aggregates

# Wards with at least this many open cases get an explicit risk read.
HIGH_LOAD_OPEN = 3
# Drainage clusters drive monsoon flood risk; called out specifically.
WATER_TYPES = {"waterlogging"}


class WardInsight(TypedDict):
    ward: str
    openCount: int
    avgUnresolvedAgeDays: float
    riskLevel: str  # low | medium | high
    riskNote: str


def _strip_dashes(text: str) -> str:
    if not text:
        return text
    cleaned = text.replace("—", " ").replace("–", " ").replace(" - ", " ")
    return " ".join(cleaned.split()).strip()


def _heuristic_risk(agg: dict) -> tuple[str, str]:
    """Deterministic risk level and note grounded in the real counts."""
    count = agg.get("openCount", 0)
    age = agg.get("avgUnresolvedAgeDays", 0.0)
    types = agg.get("types", {})
    ward = agg.get("ward", "this ward")
    water = sum(v for k, v in types.items() if k in WATER_TYPES)

    if count >= 6 or (count >= 3 and age >= 7):
        level = "high"
    elif count >= 3 or age >= 5:
        level = "medium"
    else:
        level = "low"

    if water >= 2:
        note = (
            f"{ward} has {water} unresolved drainage cases among {count} open issues, "
            f"which raises monsoon flooding risk."
        )
    else:
        note = (
            f"{ward} has {count} open cases averaging {round(age, 1)} days unresolved, "
            f"indicating a {level} accountability backlog."
        )
    return level, _strip_dashes(note)


def _client():
    try:
        from google import genai

        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        return genai.Client(api_key=api_key) if api_key else genai.Client()
    except Exception as exc:  # pragma: no cover
        print(f"[insight_agent] genai client unavailable: {exc}")
        return None


_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "riskLevel": {"type": "string", "enum": ["low", "medium", "high"]},
        "riskNote": {"type": "string"},
    },
    "required": ["riskLevel", "riskNote"],
}

INSTRUCTION = (
    "You are the civic risk analyst for Prahari. You are given the real open-case "
    "counts for one Bengaluru ward, broken down by issue type, plus the average "
    "days unresolved. Produce a short risk read grounded only in these numbers. "
    "Many unresolved drainage or waterlogging cases mean higher monsoon flood "
    "risk. Many aging potholes mean rising road safety risk. Do not invent any "
    "statistics or numbers that are not given. Write one short plain sentence. Do "
    "not use dashes of any kind. Do not use emoji."
)


def _model_risk(client, agg: dict) -> tuple[str, str] | None:
    try:
        from google.genai import types

        facts = {
            "ward": agg.get("ward"),
            "openCount": agg.get("openCount"),
            "avgUnresolvedAgeDays": agg.get("avgUnresolvedAgeDays"),
            "openByType": agg.get("types", {}),
        }
        response = client.models.generate_content(
            model="gemini-flash-latest",
            contents=["Assess civic risk for this ward.\n" + json.dumps(facts)],
            config=types.GenerateContentConfig(
                system_instruction=INSTRUCTION,
                response_mime_type="application/json",
                response_schema=_RESPONSE_SCHEMA,
                temperature=0.2,
            ),
        )
        data = json.loads((response.text or "").strip())
        level = data.get("riskLevel")
        note = _strip_dashes(str(data.get("riskNote", "")).strip())
        if level in {"low", "medium", "high"} and note:
            return level, note
    except Exception as exc:
        print(f"[insight_agent] model risk failed: {exc}")
    return None


def ward_insights(cases: list[dict]) -> list[WardInsight]:
    """Per-ward predictive risk. Never raises; falls back to heuristics."""
    try:
        aggregates = compute_ward_aggregates(cases)
    except Exception as exc:  # pragma: no cover
        print(f"[insight_agent] aggregation failed: {exc}")
        return []

    client = _client()
    out: list[WardInsight] = []
    for agg in aggregates:
        # Heuristic is the grounded baseline and the guaranteed fallback.
        level, note = _heuristic_risk(agg)
        # Only spend a model call on high-load wards worth a richer read.
        if client is not None and agg.get("openCount", 0) >= HIGH_LOAD_OPEN:
            model = _model_risk(client, agg)
            if model is not None:
                level, note = model

        out.append(
            WardInsight(
                ward=agg.get("ward", "Unassigned"),
                openCount=agg.get("openCount", 0),
                avgUnresolvedAgeDays=agg.get("avgUnresolvedAgeDays", 0.0),
                riskLevel=level,
                riskNote=note,
            )
        )
    return out


# --------------------------------------------------------------------------- #
# ADK agent declaration (used by the orchestrator graph in later steps).
# Guarded so an ADK import/version mismatch can never take down the API.
# --------------------------------------------------------------------------- #
insight_agent = None
try:  # pragma: no cover - declaration only
    from google.adk.agents import Agent

    insight_agent = Agent(
        name="insight_agent",
        model="gemini-flash-latest",
        description="Surfaces predictive civic risk per ward, grounded in real open-case counts.",
        instruction=INSTRUCTION,
    )
except Exception as exc:  # pragma: no cover
    print(f"[insight_agent] ADK agent not declared ({exc}); using grounded analytics.")
