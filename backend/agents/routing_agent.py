"""routing_agent — the credibility core of the Prahari agent graph.

Routing is a GROUNDED lookup over a real knowledge base (kb/departments.json),
never a model guess. Every routed case carries a provenance string naming the
source of the decision. If no confident knowledge-base match exists, the agent
returns "unknown" rather than inventing an authority. Honesty is the feature.

Exposes:
  * `routing_agent`   an ADK Agent declaration for the orchestrator graph.
  * `route_case(...)` the concrete, deterministic, KB-only routing callable.

The callable never raises. Any failure returns an honest unknown result with a
provenance note, never a fabricated department.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Optional, TypedDict

from agents.dedup_agent import haversine_m

# A nearest-ward match beyond this distance is treated as out of coverage.
MAX_WARD_KM = 8.0

_KB_PATH = os.path.join(os.path.dirname(__file__), "..", "kb", "departments.json")


class RouteResult(TypedDict):
    routedDept: str
    ward: Optional[str]
    zone: Optional[str]
    grievanceChannel: Optional[str]
    provenance: str
    matched: bool


@lru_cache(maxsize=1)
def _load_kb() -> list[dict]:
    """Load and cache the grounded department knowledge base."""
    try:
        with open(_KB_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception as exc:  # pragma: no cover
        print(f"[routing_agent] could not load KB: {exc}")
        return []


def _unknown(reason: str) -> RouteResult:
    return RouteResult(
        routedDept="unknown",
        ward=None,
        zone=None,
        grievanceChannel=None,
        provenance=reason,
        matched=False,
    )


def _ward_by_name(kb: list[dict], ward: str) -> Optional[dict]:
    target = ward.strip().lower()
    for e in kb:
        if str(e.get("ward", "")).strip().lower() == target:
            return e
    return None


def _nearest_ward(kb: list[dict], lat: float, lng: float) -> tuple[Optional[dict], float]:
    best: Optional[dict] = None
    best_m = float("inf")
    for e in kb:
        rlat, rlng = e.get("refLat"), e.get("refLng")
        if rlat is None or rlng is None:
            continue
        d = haversine_m(lat, lng, float(rlat), float(rlng))
        if d < best_m:
            best_m, best = d, e
    return best, best_m


def _dept_for_issue(kb: list[dict], ward: str, issue_type: str) -> Optional[dict]:
    """Exact KB entry for this ward and issue type, if present."""
    w = ward.strip().lower()
    for e in kb:
        if (
            str(e.get("ward", "")).strip().lower() == w
            and e.get("issueType") == issue_type
        ):
            return e
    return None


def _canonical_dept_for_issue(kb: list[dict], issue_type: str) -> Optional[dict]:
    """Any KB entry for this issue type, used to ground the responsible wing
    when the matched ward has no exact entry for the type."""
    for e in kb:
        if e.get("issueType") == issue_type:
            return e
    return None


def route_case(
    issue_type: str,
    lat: float,
    lng: float,
    ward: Optional[str] = None,
) -> RouteResult:
    """Resolve the responsible department from the KB. Never invents, never raises."""
    kb = _load_kb()
    if not kb:
        return _unknown("No verified knowledge base was available, so this case was not routed.")

    # 1) Resolve the ward. Prefer a known ward name, else nearest reference point.
    matched_ward_entry: Optional[dict] = None
    if ward:
        matched_ward_entry = _ward_by_name(kb, ward)

    if matched_ward_entry is None:
        nearest, dist_m = _nearest_ward(kb, lat, lng)
        if nearest is None or dist_m > MAX_WARD_KM * 1000:
            return _unknown(
                "No verified BBMP ward mapping was found for this location, so it was not routed to a department."
            )
        matched_ward_entry = nearest

    ward_name = matched_ward_entry.get("ward")
    zone = matched_ward_entry.get("zone")

    # 2) Resolve the responsible department for this issue type, KB only.
    if issue_type not in {"pothole", "road_crack", "debris", "waterlogging"}:
        return _unknown(
            f"The issue type is not classified, so no verified BBMP department could be matched for {ward_name} ward."
        )

    exact = _dept_for_issue(kb, str(ward_name), issue_type)
    if exact is not None:
        return RouteResult(
            routedDept=exact["department"],
            ward=ward_name,
            zone=zone,
            grievanceChannel=exact.get("grievanceChannel"),
            provenance=(
                f"Matched to {ward_name} ward, {zone} zone in the BBMP knowledge base. "
                f"Source: {exact.get('source')}."
            ),
            matched=True,
        )

    canonical = _canonical_dept_for_issue(kb, issue_type)
    if canonical is not None:
        return RouteResult(
            routedDept=canonical["department"],
            ward=ward_name,
            zone=zone,
            grievanceChannel=canonical.get("grievanceChannel"),
            provenance=(
                f"Resolved {ward_name} ward, {zone} zone from the BBMP knowledge base and routed "
                f"the {issue_type.replace('_', ' ')} to its responsible wing. "
                f"Source: {canonical.get('source')}."
            ),
            matched=True,
        )

    return _unknown(
        f"No verified BBMP wing for this issue type was found in the knowledge base for {ward_name} ward."
    )


# --------------------------------------------------------------------------- #
# ADK agent declaration (used by the orchestrator graph in later steps).
# The instruction makes the KB-only, never-invent rule explicit. The concrete
# routing is deterministic by design; grounding is the point.
# Guarded so an ADK import/version mismatch can never take down the API.
# --------------------------------------------------------------------------- #
routing_agent = None
try:  # pragma: no cover - declaration only
    from google.adk.agents import Agent

    routing_agent = Agent(
        name="routing_agent",
        model="gemini-flash-latest",
        description="Routes a case to the responsible BBMP department using only the grounded knowledge base.",
        instruction=(
            "You route civic road cases to the responsible BBMP department. You may "
            "only use the provided knowledge base of wards, zones, and departments. "
            "Never invent a department, officer, or contact. If no confident match "
            "exists, return unknown. Always state the knowledge base source as "
            "provenance. Do not use dashes of any kind. Do not use emoji."
        ),
    )
except Exception as exc:  # pragma: no cover
    print(f"[routing_agent] ADK agent not declared ({exc}); using grounded lookup.")
