"""Prahari backend — FastAPI wrapper around the ADK agent graph.

STEP 2 scope: the intake spine.
  - GET  /health    liveness probe
  - POST /report    multipart upload -> store image -> intake_agent classify
                    -> write enriched case to Firestore
  - GET  /cases     all cases (powers the live map and list)

Later steps add dedup, routing, escalation, resolution, and insight agents.
"""

from __future__ import annotations

import load_env  # noqa: F401  must be first: loads backend/.env before env reads

import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from agents.intake_agent import classify_intake, transcribe_voice
from agents.verification_agent import verify_classification
from agents.dedup_agent import find_duplicate
from agents.resolution_agent import verify_resolution
from agents.routing_agent import route_case
from agents.escalation_agent import (
    LADDER,
    MAX_LEVEL,
    PUBLIC_LEVEL,
    draft_for_level,
    draft_offline,
    generate_rti_draft,
    initial_draft,
    initial_sla,
    is_past_sla,
    should_threshold_escalate,
)
from agents.insight_agent import ward_insights
import bigquery_sync
from firebase import get_db, upload_image


def _all_cases(db) -> list[dict]:
    """Load all cases from Firestore. Returns [] on any failure."""
    try:
        return [d.to_dict() for d in db.collection("cases").limit(2000).stream()]
    except Exception:
        return []

app = FastAPI(
    title="Prahari API",
    description="Autonomous civic accountability infrastructure for urban India.",
    version="0.2.0",
)

# Frontend (Next.js) runs on a different origin; allow it in dev + deployed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    """Liveness probe for Cloud Run."""
    return {"status": "ok", "service": "prahari-backend", "version": app.version}


@app.get("/debug/firebase")
def debug_firebase() -> dict:
    """Temporary diagnostics for credential wiring. Safe: exposes no secrets."""
    from firebase import _resolve_credentials_path, get_db, get_init_error

    db = get_db()
    resolved = _resolve_credentials_path()
    try:
        etc_secrets = os.listdir("/etc/secrets")
    except Exception as e:
        etc_secrets = f"unreadable: {e}"
    return {
        "db_ok": db is not None,
        "cred_env": os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"),
        "resolved_path": resolved,
        "resolved_exists": resolved is not None,
        "etc_secrets": etc_secrets,
        "project_id_env": os.environ.get("FIREBASE_PROJECT_ID"),
        "init_error": get_init_error(),
    }


@app.post("/report")
async def create_report(
    lat: float = Form(...),
    lng: float = Form(...),
    note: Optional[str] = Form(None),
    ward: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    audio: Optional[UploadFile] = File(None),
) -> dict:
    """Intake a road issue: store the photo, classify it, persist the case.

    Resilient by design:
      * 503 only when Firestore itself is unconfigured.
      * If classification fails, the case is still created as type "unknown".
      * If storage is unconfigured, the case is created without a photo URL.
    """
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured. Set GOOGLE_APPLICATION_CREDENTIALS "
            "or FIREBASE_PROJECT_ID.",
        )

    image_bytes: Optional[bytes] = None
    content_type = "image/jpeg"
    if image is not None:
        image_bytes = await image.read()
        content_type = image.content_type or content_type

    # Voice reporting: transcribe a local-language voice note (Kannada, Hindi,
    # or English) and fold the English translation into the note used for
    # classification. Never blocks the report on failure.
    voice = {"language": "", "spokenText": "", "englishText": ""}
    if audio is not None:
        audio_bytes = await audio.read()
        voice = transcribe_voice(audio_bytes, audio.content_type or "audio/webm")
        if voice.get("englishText"):
            note = (
                f"{note.strip()} {voice['englishText']}".strip()
                if note and note.strip()
                else voice["englishText"]
            )

    case_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()

    # 1) Store the "before" photo (best effort).
    ext = "jpg"
    if content_type and "/" in content_type:
        ext = content_type.split("/", 1)[1].split(";")[0] or "jpg"
    before_url = upload_image(image_bytes, f"cases/{case_id}/before.{ext}", content_type)

    # 2) Classify with intake_agent (never raises).
    result = classify_intake(image_bytes, content_type, lat, lng, note)

    # 2b) verification_agent cross-checks the classification confidence.
    verification = verify_classification(result)

    # Build a visible agent trace as the graph runs, so the multi-agent work is
    # inspectable rather than hidden. Each step names the agent and its decision.
    conf_pct = round((result.get("confidence") or 0.0) * 100)

    def _step(agent: str, action: str, outcome: str, status: str = "done") -> dict:
        return {"agent": agent, "action": action, "result": outcome, "status": status}

    trace = [
        _step(
            "Intake agent",
            "Classified the photo and note",
            f'{result["issueType"]}, {result["severity"]} severity, {conf_pct} percent confidence',
        ),
        _step(
            "Verification agent",
            "Cross-checked classification confidence",
            verification["note"],
            "flagged" if verification["needsCommunity"] else "done",
        ),
    ]

    # When a voice note was given, the voice step leads the trace.
    if voice.get("englishText"):
        trace.insert(
            0,
            _step(
                "Voice agent",
                f"Transcribed a {voice.get('language') or 'local language'} voice note",
                voice["englishText"],
            ),
        )

    # 3) Dedup BEFORE creating a new case. A failure here falls back to a new
    #    case; it must never block a report.
    try:
        open_cases = [d.to_dict() for d in db.collection("cases").limit(500).stream()]
    except Exception:
        open_cases = []

    dedup = find_duplicate(
        new_lat=lat,
        new_lng=lng,
        new_type=result["issueType"],
        new_description=result["description"],
        open_cases=open_cases,
    )

    if dedup["isDuplicate"] and dedup["matchedCaseId"]:
        merged = _merge_into_case(
            db,
            dedup["matchedCaseId"],
            lat=lat,
            lng=lng,
            note=note,
            before_url=before_url,
            now=now,
        )
        if merged is not None:
            prior, fresh = merged
            new_affected = fresh.get("citizensAffected", prior + 1)

            # REAL-TIME THRESHOLD TRIGGER. If this merge pushes the case to or
            # past the citizens threshold within the recent window, the system
            # escalates to public on its own, no human in the loop. This happens
            # live inside the report path so the demo sees it instantly.
            trace.append(
                _step(
                    "Dedup agent",
                    "Searched open cases within 50 meters",
                    f"Matched an existing case, now {new_affected} citizens affected",
                )
            )

            auto = None
            if should_threshold_escalate(fresh, new_affected):
                auto = _escalate_case(
                    db, dedup["matchedCaseId"], PUBLIC_LEVEL, reason="threshold"
                )
                if auto is not None:
                    fresh = auto["case"]

            if auto is not None:
                trace.append(
                    _step(
                        "Escalation agent",
                        "Reacted to the citizens threshold",
                        "Threshold crossed, escalated to public automatically",
                        "alert",
                    )
                )
            else:
                trace.append(
                    _step(
                        "Escalation agent",
                        "Updated the tracked case",
                        "Merged into the existing grievance",
                    )
                )

            return {
                "merged": True,
                "matchedCaseId": dedup["matchedCaseId"],
                "matchesReports": prior,
                "citizensAffected": new_affected,
                "dedup": {
                    "confidence": dedup["confidence"],
                    "reasoning": dedup["reasoning"],
                    "provenance": "gemini-2.5-flash dedup within 50 meters",
                },
                "autoEscalation": auto["escalation"] if auto else None,
                "verification": verification,
                "voice": voice,
                "trace": trace,
                "case": fresh,
            }
        # If the merge target vanished, fall through and create a new case.

    # 4) Not a duplicate: route it against the grounded KB (never invents), then
    #    write the enriched case to Firestore.
    trace.append(
        _step(
            "Dedup agent",
            "Searched open cases within 50 meters",
            "No duplicate nearby, creating a new case",
        )
    )

    routing = route_case(result["issueType"], lat, lng, ward)
    trace.append(
        _step(
            "Routing agent",
            "Matched against the grounded knowledge base",
            f'{routing["ward"]}, {routing["routedDept"]}'
            if routing["matched"]
            else "No verified routing found",
            "done" if routing["matched"] else "unknown",
        )
    )

    case = {
        "id": case_id,
        "type": result["issueType"],
        "severity": result["severity"],
        "status": "open",
        "location": {"lat": lat, "lng": lng, "ward": routing["ward"] or ward},
        "photos": {"before": [before_url] if before_url else [], "after": []},
        "citizensAffected": 1,
        "dedupGroupId": case_id,
        "reporters": [{"lat": lat, "lng": lng, "note": note, "at": now}],
        "routedDept": routing["routedDept"],
        "zone": routing["zone"],
        "grievanceChannel": routing["grievanceChannel"],
        "routingMatched": routing["matched"],
        "provenance": routing["provenance"],
        "slaDeadline": initial_sla(),
        "escalationLevel": 0,
        "escalationLabel": LADDER[0],
        "predictedRisk": None,
        "createdAt": now,
        "updatedAt": now,
        "resolvedAt": None,
        "verifiedResolved": False,
        "description": result["description"],
        "classificationConfidence": result["confidence"],
        "needsCommunity": verification["needsCommunity"],
        "voiceLanguage": voice.get("language") or None,
        "voiceSpoken": voice.get("spokenText") or None,
        "voiceTranscript": voice.get("englishText") or None,
    }

    # 5) escalation_agent sets the SLA (above) and files the level 0 grievance.
    #    Deterministic so submission is fast; richer drafts come on escalation.
    filed = initial_draft(case)
    case["grievanceDraft"] = filed["text"]
    case["escalations"] = [filed]
    trace.append(
        _step(
            "Escalation agent",
            "Filed the grievance and started the SLA",
            "Level 0 filed, silence clock running",
        )
    )

    db.collection("cases").document(case_id).set(case)
    bigquery_sync.upsert_case(case)
    return {
        "merged": False,
        "case": case,
        "dedup": {"reasoning": dedup["reasoning"]},
        "verification": verification,
        "voice": voice,
        "trace": trace,
    }


def _merge_into_case(
    db,
    matched_id: str,
    *,
    lat: float,
    lng: float,
    note: Optional[str],
    before_url: Optional[str],
    now: str,
):
    """Merge a new report into an existing case. Returns (priorCount, freshCase)
    or None if the matched case no longer exists. Never raises."""
    try:
        from firebase_admin import firestore as _fs

        ref = db.collection("cases").document(matched_id)
        snap = ref.get()
        if not snap.exists:
            return None
        prior = snap.to_dict().get("citizensAffected", 1)

        update = {
            "citizensAffected": _fs.Increment(1),
            "updatedAt": now,
            "dedupGroupId": matched_id,
            "reporters": _fs.ArrayUnion(
                [{"lat": lat, "lng": lng, "note": note, "at": now}]
            ),
        }
        if before_url:
            update["photos.before"] = _fs.ArrayUnion([before_url])

        ref.update(update)
        fresh = ref.get().to_dict()
        bigquery_sync.upsert_case(fresh)
        return prior, fresh
    except Exception as exc:  # pragma: no cover
        print(f"[report] merge failed, will create new case: {exc}")
        return None


def _escalate_case(db, case_id: str, target_level: int, *, reason: str):
    """Advance a case to target_level (never backwards), draft that level's
    grounded text, and persist. Returns {case, escalation} or None. Never raises.
    """
    try:
        from firebase_admin import firestore as _fs

        ref = db.collection("cases").document(case_id)
        snap = ref.get()
        if not snap.exists:
            return None
        case = snap.to_dict()
        if case.get("status") == "verified_resolved":
            return None

        current = int(case.get("escalationLevel", 0))
        new_level = min(MAX_LEVEL, max(current, int(target_level)))
        if new_level == current and reason != "manual":
            return None
        # Manual advance always moves at least one step.
        if reason == "manual":
            new_level = min(MAX_LEVEL, current + 1)

        # Autonomous and SLA escalations use the deterministic offline draft so
        # the scheduled tick stays fast and never spends model quota. A manual
        # advance uses the richer model draft.
        draft = (
            draft_for_level(new_level, case)
            if reason == "manual"
            else draft_offline(new_level, case)
        )
        now = datetime.now(timezone.utc).isoformat()

        update = {
            "escalationLevel": new_level,
            "escalationLabel": LADDER[new_level],
            "status": "escalated" if new_level >= 1 else "open",
            "updatedAt": now,
            "lastEscalationReason": reason,
            "lastEscalationAt": now,
            "escalations": _fs.ArrayUnion([draft]),
        }
        ref.update(update)
        fresh = ref.get().to_dict()
        bigquery_sync.upsert_case(fresh)
        return {"case": fresh, "escalation": draft}
    except Exception as exc:  # pragma: no cover
        print(f"[escalation] advance failed for {case_id}: {exc}")
        return None


@app.post("/cases/{case_id}/check-escalation")
def check_escalation(case_id: str) -> dict:
    """TIME-BASED escalation. If the case is still open past its slaDeadline and
    not verified_resolved, advance one ladder level and draft that level's text.

    In production this is driven by an ADK long-running agent that periodically
    re-checks all open cases and calls the same advance logic. For the demo it is
    a callable endpoint so a judge can trigger the time-based path on stage.
    """
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore not configured.")

    ref = db.collection("cases").document(case_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Case not found.")
    case = snap.to_dict()

    if case.get("status") == "verified_resolved":
        return {"advanced": False, "reason": "Already verified resolved.", "case": case}
    if int(case.get("escalationLevel", 0)) >= MAX_LEVEL:
        return {"advanced": False, "reason": "Already at the top of the ladder.", "case": case}
    if not is_past_sla(case.get("slaDeadline")):
        return {
            "advanced": False,
            "reason": "Still within the service level deadline.",
            "case": case,
        }

    result = _escalate_case(db, case_id, int(case.get("escalationLevel", 0)) + 1, reason="sla")
    if result is None:
        return {"advanced": False, "reason": "Could not advance.", "case": case}
    return {"advanced": True, "escalation": result["escalation"], "case": result["case"]}


@app.post("/cases/{case_id}/advance-escalation")
def advance_escalation(case_id: str) -> dict:
    """Manual ladder advance for the demo, to show every drafted level. The
    real-time threshold path still fires automatically inside /report."""
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore not configured.")
    result = _escalate_case(db, case_id, 0, reason="manual")
    if result is None:
        raise HTTPException(status_code=404, detail="Case not found or already resolved.")
    return {"advanced": True, "escalation": result["escalation"], "case": result["case"]}


@app.api_route("/cron/tick", methods=["GET", "POST"])
def cron_tick(key: Optional[str] = None) -> dict:
    """Autonomous long-running agent tick.

    Re-checks every open case against its SLA deadline and, for any case that is
    past due and not resolved, advances it one escalation rung with no human in
    the loop. Meant to be called on a schedule (Cloud Scheduler when billing is
    on, or a free cron pinger otherwise). It also wakes the service, so it works
    as a keep-alive too. Never crashes.

    Protect it by setting CRON_SECRET in the environment and passing ?key=SECRET.
    """
    secret = os.environ.get("CRON_SECRET")
    if secret and key != secret:
        raise HTTPException(status_code=403, detail="Invalid cron key.")

    db = get_db()
    if db is None:
        return {"ok": False, "reason": "Firestore not configured."}

    cases = _all_cases(db)
    escalated = []
    for c in cases:
        if c.get("status") == "verified_resolved":
            continue
        level = int(c.get("escalationLevel", 0) or 0)
        if level >= MAX_LEVEL:
            continue
        if not is_past_sla(c.get("slaDeadline")):
            continue
        res = _escalate_case(db, c.get("id"), level + 1, reason="sla")
        if res is not None:
            fresh = res["case"]
            escalated.append(
                {
                    "id": c.get("id"),
                    "level": fresh.get("escalationLevel"),
                    "label": fresh.get("escalationLabel"),
                }
            )

    return {
        "ok": True,
        "checked": len(cases),
        "escalatedCount": len(escalated),
        "escalated": escalated,
    }


@app.post("/cases/{case_id}/rti-draft")
def rti_draft(case_id: str) -> dict:
    """Generate a complete RTI request for a case, on request only.

    Additive: it does not change how escalation advances. Grounded only in the
    case facts. Never crashes; the generator returns an honest fallback on any
    failure. The draft is also stored on the case so it can be reopened.
    """
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore not configured.")

    ref = db.collection("cases").document(case_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Case not found.")

    draft = generate_rti_draft(snap.to_dict())
    try:
        ref.update({"rtiDraft": draft})
    except Exception as exc:  # pragma: no cover - storing is best effort
        print(f"[rti] could not persist draft: {exc}")
    return {"caseId": case_id, "rti": draft}


@app.post("/cases/{case_id}/verify")
async def verify_case(
    case_id: str,
    image: UploadFile = File(...),
    before: Optional[UploadFile] = File(None),
) -> dict:
    """Verify a resolution from a follow-up photo, via resolution_agent.

    The "after" photo is required. The "before" photo is optional: if a before
    image is uploaded it is used directly for the comparison (and stored), which
    is the path used when the case has no stored before photo. Otherwise the
    case's stored before photo is used.

    Flips the case to verified_resolved only on a confident, same-location
    resolved verdict. Otherwise the case stays open with a needs_review note.
    Never crashes on a vision failure.
    """
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore not configured.")

    ref = db.collection("cases").document(case_id)
    snapshot = ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Case not found.")
    case = snapshot.to_dict()

    after_bytes = await image.read()
    content_type = image.content_type or "image/jpeg"
    ext = "jpg"
    if "/" in content_type:
        ext = content_type.split("/", 1)[1].split(";")[0] or "jpg"

    now = datetime.now(timezone.utc).isoformat()

    # 1) Store the "after" photo (best effort).
    after_url = upload_image(
        after_bytes, f"cases/{case_id}/after-{int(datetime.now().timestamp())}.{ext}", content_type
    )

    # Resolve the "before" image: an uploaded one wins, else the stored photo.
    before_bytes = None
    before_photos = (case.get("photos") or {}).get("before") or []
    before_url = before_photos[0] if before_photos else None
    if before is not None:
        before_bytes = await before.read()
        before_mime = before.content_type or "image/jpeg"
        bext = before_mime.split("/", 1)[1].split(";")[0] if "/" in before_mime else "jpg"
        stored = upload_image(before_bytes, f"cases/{case_id}/before.{bext}", before_mime)
        if stored:
            before_url = stored
            case.setdefault("photos", {})["before"] = [stored]

    # 2) Run the vision comparison (never raises).
    result = verify_resolution(
        case_id=case_id,
        issue_type=case.get("type", "unknown"),
        before_url=before_url,
        before_bytes=before_bytes,
        after_bytes=after_bytes,
        after_mime=content_type,
    )

    # 3) Persist the after photo and the verification record.
    after_list = ((case.get("photos") or {}).get("after") or [])
    if after_url:
        after_list = after_list + [after_url]

    verification = {
        "sameLocation": result["sameLocation"],
        "resolved": result["resolved"],
        "confidence": result["confidence"],
        "reasoning": result["reasoning"],
        "verdict": result["verdict"],
        "provenance": "gemini-2.5-flash vision before/after comparison",
        "checkedAt": now,
        "afterPhoto": after_url,
    }

    update: dict = {
        "photos.after": after_list,
        "lastVerification": verification,
    }
    # Persist a newly uploaded before photo so the case keeps its evidence.
    if before is not None and before_url:
        update["photos.before"] = [before_url]

    if result["verdict"] == "verified_resolved":
        update.update(
            {
                "status": "verified_resolved",
                "verifiedResolved": True,
                "resolvedAt": now,
                "resolutionReasoning": result["reasoning"],
                "resolutionConfidence": result["confidence"],
                "provenance": verification["provenance"],
            }
        )

    ref.update(update)

    fresh = ref.get().to_dict()
    bigquery_sync.upsert_case(fresh)
    return {"verification": verification, "case": fresh}


@app.post("/cases/{case_id}/route")
def route_existing_case(case_id: str) -> dict:
    """Re-run grounded routing for an existing case. KB only, never invents."""
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore not configured.")

    ref = db.collection("cases").document(case_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Case not found.")
    case = snap.to_dict()
    loc = case.get("location") or {}

    routing = route_case(
        case.get("type", "unknown"),
        float(loc.get("lat", 0.0)),
        float(loc.get("lng", 0.0)),
        loc.get("ward"),
    )
    ref.update(
        {
            "routedDept": routing["routedDept"],
            "location.ward": routing["ward"] or loc.get("ward"),
            "zone": routing["zone"],
            "grievanceChannel": routing["grievanceChannel"],
            "routingMatched": routing["matched"],
            "provenance": routing["provenance"],
        }
    )
    return {"routing": routing, "case": ref.get().to_dict()}


@app.get("/cases")
def list_cases(limit: int = 200) -> dict:
    """List recent cases, newest first (powers the live map and list)."""
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore not configured.")

    try:
        from google.cloud.firestore_v1.base_query import FieldFilter  # noqa: F401

        query = db.collection("cases").order_by(
            "createdAt", direction="DESCENDING"
        ).limit(limit)
        docs = query.stream()
    except Exception:
        # Ordering can require an index on some setups; fall back to unordered.
        docs = db.collection("cases").limit(limit).stream()

    cases = [d.to_dict() for d in docs]
    cases.sort(key=lambda c: c.get("createdAt", ""), reverse=True)
    return {"cases": cases, "count": len(cases)}


@app.delete("/cases/{case_id}")
def delete_case(case_id: str) -> dict:
    """Remove a single case. Used by the Remove control in the case list."""
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore not configured.")
    db.collection("cases").document(case_id).delete()
    return {"deleted": case_id}


@app.delete("/cases")
def delete_all_cases() -> dict:
    """Clear every case. Used by the Clear all control to reset the board."""
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore not configured.")
    deleted = 0
    while True:
        docs = list(db.collection("cases").limit(400).stream())
        if not docs:
            break
        batch = db.batch()
        for d in docs:
            batch.delete(d.reference)
        batch.commit()
        deleted += len(docs)
    return {"deleted": deleted}


@app.get("/scoreboard")
def scoreboard() -> dict:
    """Government responsiveness scoreboard. Ranks BBMP wards and departments by
    vision-verified resolution speed and backlog freshness.

    Powered by BigQuery SQL when configured, with an honest in-memory fallback.
    Never crashes; returns a safe empty board on failure.
    """
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore not configured.")
    cases = _all_cases(db)
    try:
        return bigquery_sync.scoreboard(cases)
    except Exception as exc:
        print(f"[scoreboard] failed: {exc}")
        from analytics import compute_scoreboard

        try:
            return compute_scoreboard(cases)
        except Exception:
            return {"wards": [], "departments": [], "headline": {}, "source": "empty"}


@app.get("/insights")
def insights() -> dict:
    """Predictive civic risk per ward, grounded in real open-case counts.

    Never crashes; returns an empty list on failure.
    """
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore not configured.")
    cases = _all_cases(db)
    try:
        return {
            "wards": ward_insights(cases),
            "source": "bigquery" if bigquery_sync.is_configured() else "in-memory",
        }
    except Exception as exc:
        print(f"[insights] failed: {exc}")
        return {"wards": [], "source": "empty"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
