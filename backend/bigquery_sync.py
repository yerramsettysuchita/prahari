"""BigQuery analytics layer for Prahari.

When BigQuery is configured, case records are upserted into a warehouse table
and the scoreboard ranking is computed by a real BigQuery SQL query. When it is
not configured, every function falls back to the in-memory engine in
analytics.py, so the app always returns correct data. This mirrors the
fault-tolerant pattern in firebase.py: configuration is optional, behavior is
guaranteed.

Configuration (env):
  BIGQUERY_PROJECT_ID   GCP project that owns the dataset
  BIGQUERY_DATASET      dataset name (default "prahari")
  BIGQUERY_TABLE        table name (default "cases")
Credentials come from Application Default Credentials, the same as Firestore.

Warehouse table schema (BIGQUERY_DATASET.BIGQUERY_TABLE):
  id                STRING    NOT NULL   case id, the upsert key
  type              STRING               pothole | road_crack | debris | waterlogging | unknown
  severity          STRING               low | medium | high
  status            STRING               open | escalated | verified_resolved
  ward              STRING               BBMP ward name
  zone              STRING               BBMP zone
  routedDept        STRING               grounded department, or "unknown"
  citizensAffected  INT64                deduped count of affected citizens
  escalationLevel   INT64                0 Filed .. 3 RTI
  createdAt         TIMESTAMP            case creation
  resolvedAt        TIMESTAMP NULLABLE   set only on verified resolution
  verifiedResolved  BOOL                 vision-proof gate
The scoreboard SQL only counts status = 'verified_resolved' as resolved, so the
warehouse ranking honors the same vision-proof gate as the in-memory engine.
"""

from __future__ import annotations

import os
from typing import Optional

from analytics import compute_scoreboard

_PROJECT = os.environ.get("BIGQUERY_PROJECT_ID")
_DATASET = os.environ.get("BIGQUERY_DATASET", "prahari")
_TABLE = os.environ.get("BIGQUERY_TABLE", "cases")

_client = None
_checked = False


def is_configured() -> bool:
    return bool(_PROJECT)


def _get_client():
    """Lazily build a BigQuery client. Returns None if unavailable."""
    global _client, _checked
    if _checked:
        return _client
    _checked = True
    if not _PROJECT:
        return None
    try:
        from google.cloud import bigquery

        _client = bigquery.Client(project=_PROJECT)
    except Exception as exc:  # pragma: no cover
        print(f"[bigquery] client unavailable, using in-memory fallback: {exc}")
        _client = None
    return _client


def _table_id() -> str:
    return f"{_PROJECT}.{_DATASET}.{_TABLE}"


def upsert_case(case: dict) -> None:
    """Upsert one case into the warehouse. No-op (and never raises) when
    BigQuery is not configured; Firestore remains the system of record."""
    client = _get_client()
    if client is None:
        return
    try:
        from google.cloud import bigquery

        loc = case.get("location") or {}
        row = {
            "id": case.get("id"),
            "type": case.get("type"),
            "severity": case.get("severity"),
            "status": case.get("status"),
            "ward": loc.get("ward"),
            "zone": case.get("zone"),
            "routedDept": case.get("routedDept"),
            "citizensAffected": int(case.get("citizensAffected", 1) or 1),
            "escalationLevel": int(case.get("escalationLevel", 0) or 0),
            "createdAt": case.get("createdAt"),
            "resolvedAt": case.get("resolvedAt"),
            "verifiedResolved": bool(case.get("verifiedResolved", False)),
        }
        # MERGE on id so re-syncing a case (after merge, escalation, or
        # resolution) updates the warehouse row in place.
        merge_sql = f"""
        MERGE `{_table_id()}` T
        USING (SELECT @id AS id) S
        ON T.id = S.id
        WHEN MATCHED THEN UPDATE SET
          type=@type, severity=@severity, status=@status, ward=@ward, zone=@zone,
          routedDept=@routedDept, citizensAffected=@citizensAffected,
          escalationLevel=@escalationLevel, resolvedAt=@resolvedAt,
          verifiedResolved=@verifiedResolved
        WHEN NOT MATCHED THEN INSERT ROW
        """
        params = [
            bigquery.ScalarQueryParameter(k, _bq_type(k), v)
            for k, v in row.items()
        ]
        client.query(
            merge_sql, job_config=bigquery.QueryJobConfig(query_parameters=params)
        ).result()
    except Exception as exc:  # pragma: no cover
        print(f"[bigquery] upsert skipped: {exc}")


def _bq_type(field: str) -> str:
    if field in {"citizensAffected", "escalationLevel"}:
        return "INT64"
    if field == "verifiedResolved":
        return "BOOL"
    if field in {"createdAt", "resolvedAt"}:
        return "TIMESTAMP"
    return "STRING"


# Scoreboard SQL. Faster verified resolution and a fresher, smaller open backlog
# rank higher, matching the documented formula in analytics.py. Only
# verified_resolved counts as resolved (the vision-proof gate).
_SCOREBOARD_SQL = """
WITH per_ward AS (
  SELECT
    COALESCE(ward, 'Unassigned') AS ward,
    COUNTIF(status = 'verified_resolved') AS verifiedResolvedCount,
    COUNTIF(status != 'verified_resolved') AS openCount,
    AVG(IF(status = 'verified_resolved',
           TIMESTAMP_DIFF(resolvedAt, createdAt, HOUR) / 24.0, NULL)) AS avgResolutionDays,
    MAX(IF(status != 'verified_resolved',
           TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), createdAt, HOUR) / 24.0, 0)) AS oldestOpenAgeDays
  FROM `{table}`
  GROUP BY ward
)
SELECT * FROM per_ward
"""


def compute_scoreboard_bq() -> Optional[dict]:
    """Compute the scoreboard via BigQuery SQL. Returns None to signal the
    caller to fall back to the in-memory engine."""
    client = _get_client()
    if client is None:
        return None
    try:
        rows = list(client.query(_SCOREBOARD_SQL.format(table=_table_id())).result())
        from analytics import responsiveness_score

        wards = []
        for r in rows:
            avg_res = float(r["avgResolutionDays"]) if r["avgResolutionDays"] is not None else None
            oldest = float(r["oldestOpenAgeDays"] or 0.0)
            wards.append(
                {
                    "ward": r["ward"],
                    "verifiedResolvedCount": int(r["verifiedResolvedCount"]),
                    "openCount": int(r["openCount"]),
                    "avgResolutionDays": round(avg_res, 2) if avg_res is not None else None,
                    "oldestOpenAgeDays": round(oldest, 2),
                    "responsivenessScore": responsiveness_score(
                        int(r["verifiedResolvedCount"]), avg_res, int(r["openCount"]), oldest
                    ),
                }
            )
        wards.sort(key=lambda w: w["responsivenessScore"], reverse=True)
        for i, w in enumerate(wards, start=1):
            w["rank"] = i
        return {"wards": wards, "source": "bigquery"}
    except Exception as exc:  # pragma: no cover
        print(f"[bigquery] scoreboard query failed, falling back: {exc}")
        return None


def scoreboard(cases: list[dict]) -> dict:
    """Scoreboard via BigQuery when available, else the in-memory engine.

    BigQuery is used for the ward ranking; department rows and city headline
    metrics are always computed in memory for completeness and to keep the SQL
    surface small. Never raises.
    """
    in_memory = compute_scoreboard(cases)
    if not is_configured():
        return in_memory

    bq = compute_scoreboard_bq()
    if bq is None:
        return in_memory

    # Warehouse-ranked wards, with departments and headline from the engine.
    return {
        "wards": bq["wards"],
        "departments": in_memory["departments"],
        "headline": in_memory["headline"],
        "source": "bigquery",
    }
