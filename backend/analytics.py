"""In-memory analytics engine for Prahari.

Pure functions that compute the responsiveness scoreboard and per-ward risk
aggregates from a list of case dicts. This is both the canonical computation and
the honest fallback used when BigQuery is not configured (see bigquery_sync.py).

Every function is defensive and never raises; bad or missing fields are skipped.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional


# --------------------------------------------------------------------------- #
# Date helpers
# --------------------------------------------------------------------------- #
def _parse(iso: Optional[str]) -> Optional[datetime]:
    if not iso:
        return None
    try:
        dt = datetime.fromisoformat(iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _age_days(iso: Optional[str], until: Optional[datetime] = None) -> Optional[float]:
    start = _parse(iso)
    if start is None:
        return None
    end = until or datetime.now(timezone.utc)
    return max(0.0, (end - start).total_seconds() / 86400.0)


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


# --------------------------------------------------------------------------- #
# Responsiveness score
# --------------------------------------------------------------------------- #
#
# responsivenessScore is a 0 to 100 number. Faster vision-verified resolution
# and a fresher, smaller open backlog rank higher. It is a weighted blend:
#
#     score = 0.5 * speed + 0.3 * throughput + 0.2 * freshness
#
#   speed       how fast verified cases were resolved.
#               100 at same-day resolution, falling to 0 by ~6.7 days
#               (100 - avgResolutionDays * 15). Zero when nothing is verified,
#               because an unproven ward has not earned a speed score.
#   throughput  resolution rate, verified / (verified + open), as a percentage.
#   freshness   how stale the oldest open case is.
#               100 with no open backlog, falling to 0 by ~10 days
#               (100 - oldestOpenAgeDays * 10).
#
# The vision-proof gate is strict: only status == "verified_resolved" counts as
# resolved. A manual toggle never moves the score.
# --------------------------------------------------------------------------- #
def responsiveness_score(
    verified_count: int,
    avg_resolution_days: Optional[float],
    open_count: int,
    oldest_open_age_days: Optional[float],
) -> int:
    if verified_count > 0 and avg_resolution_days is not None:
        speed = _clamp(100.0 - avg_resolution_days * 15.0)
    else:
        speed = 0.0

    total = verified_count + open_count
    throughput = _clamp((verified_count / total) * 100.0) if total > 0 else 0.0

    if open_count == 0:
        freshness = 100.0
    else:
        freshness = _clamp(100.0 - (oldest_open_age_days or 0.0) * 10.0)

    return round(0.5 * speed + 0.3 * throughput + 0.2 * freshness)


# --------------------------------------------------------------------------- #
# Grouped aggregation
# --------------------------------------------------------------------------- #
def _blank_group(key: str, key_field: str) -> dict:
    return {
        key_field: key,
        "verifiedResolvedCount": 0,
        "openCount": 0,
        "_resolutionDays": [],  # internal, removed before return
        "_openAges": [],  # internal
        "oldestOpenAgeDays": 0.0,
    }


def _aggregate_by(cases: list[dict], key_field: str, label_default: str) -> list[dict]:
    groups: dict[str, dict] = {}

    for c in cases or []:
        if key_field == "ward":
            key = (c.get("location") or {}).get("ward") or label_default
        else:
            key = c.get("routedDept") or label_default
        if not key or str(key).lower() == "unknown":
            key = label_default

        g = groups.setdefault(key, _blank_group(key, key_field))

        status = c.get("status")
        if status == "verified_resolved":
            g["verifiedResolvedCount"] += 1
            days = _age_days(c.get("createdAt"), _parse(c.get("resolvedAt")))
            if days is not None:
                g["_resolutionDays"].append(days)
        else:
            g["openCount"] += 1
            age = _age_days(c.get("createdAt"))
            if age is not None:
                g["_openAges"].append(age)

    out: list[dict] = []
    for g in groups.values():
        res_days = g.pop("_resolutionDays")
        open_ages = g.pop("_openAges")
        avg_resolution = round(sum(res_days) / len(res_days), 2) if res_days else None
        oldest_open = round(max(open_ages), 2) if open_ages else 0.0
        avg_open = round(sum(open_ages) / len(open_ages), 2) if open_ages else 0.0

        g["avgResolutionDays"] = avg_resolution
        g["oldestOpenAgeDays"] = oldest_open
        g["avgUnresolvedAgeDays"] = avg_open
        g["responsivenessScore"] = responsiveness_score(
            g["verifiedResolvedCount"], avg_resolution, g["openCount"], oldest_open
        )
        out.append(g)

    # Rank by responsiveness, then by verified count as a tiebreaker.
    out.sort(
        key=lambda r: (r["responsivenessScore"], r["verifiedResolvedCount"]),
        reverse=True,
    )
    for i, row in enumerate(out, start=1):
        row["rank"] = i
    return out


def compute_scoreboard(cases: list[dict]) -> dict:
    """Ranked ward and department scoreboards plus city headline metrics."""
    wards = _aggregate_by(cases, "ward", "Unassigned")
    departments = _aggregate_by(cases, "department", "Unrouted")

    total_cases = len(cases or [])
    total_citizens = sum(int(c.get("citizensAffected", 1) or 1) for c in (cases or []))
    verified = [c for c in (cases or []) if c.get("status") == "verified_resolved"]
    res_days = [
        d
        for c in verified
        if (d := _age_days(c.get("createdAt"), _parse(c.get("resolvedAt")))) is not None
    ]
    city_avg_resolution = round(sum(res_days) / len(res_days), 2) if res_days else None

    return {
        "wards": wards,
        "departments": departments,
        "headline": {
            "totalCases": total_cases,
            "totalCitizensAffected": total_citizens,
            "verifiedResolvedCount": len(verified),
            "avgResolutionDays": city_avg_resolution,
        },
        "source": "in-memory",
    }


def compute_ward_aggregates(cases: list[dict]) -> list[dict]:
    """Per-ward open-case load for the insight agent: count, density, age."""
    wards: dict[str, dict] = {}
    for c in cases or []:
        if c.get("status") == "verified_resolved":
            continue
        ward = (c.get("location") or {}).get("ward") or "Unassigned"
        w = wards.setdefault(
            ward,
            {"ward": ward, "openCount": 0, "_ages": [], "types": {}},
        )
        w["openCount"] += 1
        age = _age_days(c.get("createdAt"))
        if age is not None:
            w["_ages"].append(age)
        t = c.get("type") or "unknown"
        w["types"][t] = w["types"].get(t, 0) + 1

    out: list[dict] = []
    for w in wards.values():
        ages = w.pop("_ages")
        w["avgUnresolvedAgeDays"] = round(sum(ages) / len(ages), 2) if ages else 0.0
        out.append(w)
    out.sort(key=lambda r: (r["openCount"], r["avgUnresolvedAgeDays"]), reverse=True)
    return out
