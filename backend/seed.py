"""Prahari demo seed.

DEMO DATA ONLY. This populates Firestore with a realistic spread of Bengaluru
cases inside BBMP knowledge-base wards so the scoreboard and risk layer look
alive on stage. It is idempotent: every case uses a fixed `seed-*` id, so
re-running overwrites rather than duplicating.

Run from the backend directory with Firestore credentials configured:

    python seed.py

If Firestore is not configured it prints an honest message and exits without
writing anything.
"""

from __future__ import annotations

import load_env  # noqa: F401  must be first: loads backend/.env before env reads

from datetime import datetime, timedelta, timezone

from agents.escalation_agent import LADDER, draft_for_level, initial_sla
from agents.routing_agent import route_case
from firebase import get_db

# Real BBMP ward reference coordinates, matching kb/departments.json.
WARDS = {
    "Indiranagar": (12.9719, 77.6412),
    "Jayanagar": (12.9250, 77.5938),
    "Koramangala": (12.9352, 77.6245),
    "HSR Layout": (12.9116, 77.6412),
    "Bellandur": (12.9304, 77.6784),
    "Malleshwaram": (13.0035, 77.5709),
    "Shanthala Nagar": (12.9716, 77.6090),
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _jitter(coord: tuple[float, float], i: int) -> tuple[float, float]:
    """Spread clustered cases a few meters apart so markers do not overlap."""
    return (coord[0] + 0.0006 * ((i % 3) - 1), coord[1] + 0.0006 * ((i // 3) - 1))


def _case(
    seed_id: str,
    ward: str,
    issue_type: str,
    severity: str,
    description: str,
    *,
    status: str,
    citizens: int,
    created_days_ago: float,
    resolved_days_ago: float | None = None,
    escalation_level: int = 0,
    jitter_index: int = 1,
) -> dict:
    lat, lng = _jitter(WARDS[ward], jitter_index)
    created = _now() - timedelta(days=created_days_ago)
    created_iso = created.isoformat()

    routing = route_case(issue_type, lat, lng, ward)

    case: dict = {
        "id": seed_id,
        "type": issue_type,
        "severity": severity,
        "status": status,
        "location": {"lat": lat, "lng": lng, "ward": routing["ward"] or ward},
        "photos": {"before": [], "after": []},
        "citizensAffected": citizens,
        "dedupGroupId": seed_id,
        "reporters": [{"lat": lat, "lng": lng, "note": None, "at": created_iso}],
        "routedDept": routing["routedDept"],
        "zone": routing["zone"],
        "grievanceChannel": routing["grievanceChannel"],
        "routingMatched": routing["matched"],
        "provenance": routing["provenance"],
        "slaDeadline": initial_sla(created),
        "escalationLevel": escalation_level,
        "escalationLabel": LADDER.get(escalation_level, "Filed"),
        "predictedRisk": None,
        "createdAt": created_iso,
        "updatedAt": created_iso,
        "resolvedAt": None,
        "verifiedResolved": False,
        "description": description,
        "classificationConfidence": 0.9,
        "seed": True,
    }

    # Drafts for every level reached (offline-safe; falls back without Gemini).
    drafts = [draft_for_level(lvl, case) for lvl in range(0, escalation_level + 1)]
    case["escalations"] = drafts
    case["grievanceDraft"] = drafts[0]["text"]

    if status == "verified_resolved" and resolved_days_ago is not None:
        resolved = _now() - timedelta(days=resolved_days_ago)
        case["resolvedAt"] = resolved.isoformat()
        case["verifiedResolved"] = True
        case["resolutionReasoning"] = (
            "The reported issue is no longer visible in the follow-up photo."
        )
        case["resolutionConfidence"] = 0.88

    return case


def build_cases() -> list[dict]:
    return [
        # Indiranagar: a fast, high responder. Two verified resolutions.
        _case("seed-001", "Indiranagar", "pothole", "high",
              "Deep pothole near the 100 feet road junction.",
              status="verified_resolved", citizens=4, created_days_ago=4, resolved_days_ago=1, jitter_index=1),
        _case("seed-002", "Indiranagar", "pothole", "medium",
              "Cracked surface outside a bus stop on CMH road.",
              status="verified_resolved", citizens=2, created_days_ago=6, resolved_days_ago=2, jitter_index=2),

        # Jayanagar: one quick verified resolution.
        _case("seed-003", "Jayanagar", "road_crack", "medium",
              "Long crack along the 4th block service road.",
              status="verified_resolved", citizens=3, created_days_ago=3, resolved_days_ago=0.5, jitter_index=1),

        # Koramangala: fresh open case.
        _case("seed-004", "Koramangala", "waterlogging", "medium",
              "Water pooling at the 80 feet road corner after rain.",
              status="open", citizens=3, created_days_ago=2, jitter_index=1),

        # HSR Layout: an aging open debris case.
        _case("seed-005", "HSR Layout", "debris", "low",
              "Construction debris blocking part of a sector road.",
              status="open", citizens=2, created_days_ago=5, jitter_index=1),

        # Malleshwaram: escalated to reminder, past SLA.
        _case("seed-006", "Malleshwaram", "pothole", "high",
              "Pothole widening on a busy market street.",
              status="escalated", citizens=5, created_days_ago=8, escalation_level=1, jitter_index=1),

        # Shanthala Nagar: publicly escalated, high impact.
        _case("seed-007", "Shanthala Nagar", "pothole", "high",
              "Sunken road slab affecting a main commercial stretch.",
              status="escalated", citizens=7, created_days_ago=9, escalation_level=2, jitter_index=1),

        # Bellandur: a high-risk unresolved drainage cluster (monsoon flood risk).
        _case("seed-008", "Bellandur", "waterlogging", "high",
              "Severe waterlogging near the outer ring road underpass.",
              status="escalated", citizens=8, created_days_ago=12, escalation_level=2, jitter_index=1),
        _case("seed-009", "Bellandur", "waterlogging", "high",
              "Stormwater drain overflow flooding a service lane.",
              status="open", citizens=6, created_days_ago=9, jitter_index=2),
        _case("seed-010", "Bellandur", "waterlogging", "medium",
              "Standing water outside a tech park gate.",
              status="open", citizens=4, created_days_ago=8, jitter_index=3),
        _case("seed-011", "Bellandur", "waterlogging", "medium",
              "Clogged drain causing road flooding near a lake edge.",
              status="open", citizens=5, created_days_ago=7, jitter_index=4),
    ]


def main() -> None:
    db = get_db()
    if db is None:
        print(
            "Firestore is not configured. Set GOOGLE_APPLICATION_CREDENTIALS and "
            "FIREBASE_PROJECT_ID, then run python seed.py again. Nothing was written."
        )
        return

    cases = build_cases()
    batch = db.batch()
    for case in cases:
        batch.set(db.collection("cases").document(case["id"]), case)
    batch.commit()

    # Mirror into BigQuery when configured (no-op otherwise).
    try:
        import bigquery_sync

        for case in cases:
            bigquery_sync.upsert_case(case)
    except Exception as exc:  # pragma: no cover
        print(f"BigQuery mirror skipped: {exc}")

    verified = sum(1 for c in cases if c["status"] == "verified_resolved")
    escalated = sum(1 for c in cases if c["status"] == "escalated")
    open_count = sum(1 for c in cases if c["status"] == "open")
    print(
        f"Seeded {len(cases)} demo cases across {len(WARDS)} BBMP wards "
        f"({verified} verified resolved, {escalated} escalated, {open_count} open). "
        f"Bellandur carries the high-risk drainage cluster."
    )


if __name__ == "__main__":
    main()
