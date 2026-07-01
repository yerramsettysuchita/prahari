"""Prahari demo seed.

DEMO DATA ONLY. Populates Firestore with ten open Bengaluru cases across all
four issue types, in real BBMP knowledge-base wards, so the board looks alive
and every case can be resolved on camera during the demo. Idempotent: every
case uses a fixed `seed-*` id, so re-running overwrites rather than duplicating.

Run from the backend directory with Firestore credentials configured:

    python seed.py

Grievance drafts are generated deterministically (no model call), so seeding is
fast and never consumes Gemini quota.
"""

from __future__ import annotations

import load_env  # noqa: F401  must be first: loads backend/.env

from datetime import datetime, timedelta, timezone

from agents.escalation_agent import LADDER, initial_draft, initial_sla
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
    "Domlur": (12.9609, 77.6387),
    "Banashankari Temple Ward": (12.9255, 77.5468),
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _jitter(coord: tuple[float, float], i: int) -> tuple[float, float]:
    return (coord[0] + 0.0006 * ((i % 3) - 1), coord[1] + 0.0006 * ((i // 3) - 1))


def _case(
    seed_id: str,
    ward: str,
    issue_type: str,
    severity: str,
    description: str,
    *,
    citizens: int,
    created_days_ago: float,
    confidence: float = 0.92,
    needs_community: bool = False,
    community_confirmations: int = 0,
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
        "status": "open",
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
        "escalationLevel": 0,
        "escalationLabel": LADDER[0],
        "predictedRisk": None,
        "createdAt": created_iso,
        "updatedAt": created_iso,
        "resolvedAt": None,
        "verifiedResolved": False,
        "description": description,
        "classificationConfidence": confidence,
        "needsCommunity": needs_community,
        "communityConfirmations": community_confirmations,
        "seed": True,
    }
    filed = initial_draft(case)
    case["escalations"] = [filed]
    case["grievanceDraft"] = filed["text"]
    return case


def build_cases() -> list[dict]:
    return [
        # Potholes
        _case("seed-01", "Indiranagar", "pothole", "high",
              "Deep pothole near the 100 feet road junction, dangerous for two wheelers.",
              citizens=4, created_days_ago=3, jitter_index=1),
        _case("seed-02", "Jayanagar", "pothole", "medium",
              "Cracked and sunken patch outside a bus stop on the 4th block road.",
              citizens=2, created_days_ago=1.5, jitter_index=2),
        _case("seed-03", "Malleshwaram", "pothole", "high",
              "Pothole widening on a busy market street near the temple.",
              citizens=5, created_days_ago=5, jitter_index=3),

        # Road cracks
        _case("seed-04", "Shanthala Nagar", "road_crack", "medium",
              "Long crack running along a commercial stretch service road.",
              citizens=2, created_days_ago=2, jitter_index=1),
        _case("seed-05", "Domlur", "road_crack", "low",
              "Surface cracking near a residential lane corner.",
              citizens=1, created_days_ago=0.5, confidence=0.45,
              needs_community=True, jitter_index=2),

        # Debris
        _case("seed-06", "HSR Layout", "debris", "medium",
              "Construction debris blocking part of a sector road.",
              citizens=3, created_days_ago=4, jitter_index=1),
        _case("seed-07", "Koramangala", "debris", "low",
              "Dumped waste and rubble narrowing a side street.",
              citizens=2, created_days_ago=2.5, confidence=0.48,
              needs_community=True, jitter_index=2),

        # Waterlogging
        _case("seed-08", "Bellandur", "waterlogging", "high",
              "Severe waterlogging near the outer ring road underpass.",
              citizens=5, created_days_ago=6, jitter_index=1),
        _case("seed-09", "Bellandur", "waterlogging", "high",
              "Stormwater drain overflow flooding a service lane.",
              citizens=4, created_days_ago=4.5, jitter_index=2),
        _case("seed-10", "Banashankari Temple Ward", "waterlogging", "medium",
              "Water pooling at a temple road corner after rain.",
              citizens=2, created_days_ago=1, jitter_index=3),

        # Dedicated community co-sign demo case. It is flagged for community
        # confirmation and pre-loaded one short of the target, so a single
        # "I see this too" flips it to community confirmed on camera.
        _case("seed-cosign", "Koramangala", "pothole", "medium",
              "Pothole reported by a citizen with low confidence, needs community confirmation.",
              citizens=2, created_days_ago=0.3, confidence=0.42,
              needs_community=True, community_confirmations=2, jitter_index=1),
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

    try:
        import bigquery_sync

        for case in cases:
            bigquery_sync.upsert_case(case)
    except Exception as exc:  # pragma: no cover
        print(f"BigQuery mirror skipped: {exc}")

    types = {}
    for c in cases:
        types[c["type"]] = types.get(c["type"], 0) + 1
    print(
        f"Seeded {len(cases)} open demo cases across {len(WARDS)} BBMP wards. "
        f"Breakdown: {types}. Two are flagged for community confirmation."
    )


if __name__ == "__main__":
    main()
