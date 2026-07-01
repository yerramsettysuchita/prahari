"""escalation_agent — the autonomous heart of the Prahari agent graph.

An unresolved case should not wait for a human. This agent sets an SLA on
creation, drafts a formal grievance, and climbs an escalation ladder when
nothing is resolved. It supports two paths:

  TIME-BASED   a case past its SLA deadline advances one ladder level.
  REAL-TIME    a dedup merge crossing a citizens threshold inside a recent
               window jumps straight to public escalation, no human in the loop.

The ladder:
  0  Filed              the initial formal grievance to the routed department
  1  Reminder sent      a firmer follow-up referencing the elapsed SLA
  2  Publicly escalated a drafted public post tagging the department by name
  3  RTI drafted        a Right to Information request on the case status

Exposes:
  * `escalation_agent`        an ADK Agent declaration for the orchestrator graph.
  * `initial_sla(...)`        compute the SLA deadline at creation time.
  * `draft_for_level(...)`    generate the grounded text for a ladder level.

Drafting never raises. On failure it returns an honest fallback note so a case
is never blocked and never carries fabricated content.

ADK long-running note: in production the time-based path runs as an ADK
long-running agent. The orchestrator schedules a periodic re-check that loads
open cases, and for any case past its slaDeadline calls draft_for_level for the
next level and persists it. For the demo we expose the same logic as the
callable POST /cases/{id}/check-escalation so a judge can advance it on stage.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional, TypedDict

# Short, configurable for live demos. Set SLA_HOURS very low (even 0) on stage.
SLA_HOURS = float(os.environ.get("SLA_HOURS", "24"))
# Real-time trigger: this many citizens affected forces public escalation.
CITIZENS_THRESHOLD = int(os.environ.get("CITIZENS_THRESHOLD", "5"))
# The merge must be recent (case created within this window) to trigger live.
THRESHOLD_WINDOW_HOURS = float(os.environ.get("THRESHOLD_WINDOW_HOURS", "72"))

LADDER = {
    0: "Filed",
    1: "Reminder sent",
    2: "Publicly escalated",
    3: "RTI drafted",
}
MAX_LEVEL = 3
PUBLIC_LEVEL = 2


class EscalationDraft(TypedDict):
    level: int
    label: str
    draftType: str
    text: str
    generatedAt: str
    grounded: bool


def _strip_dashes(text: str) -> str:
    if not text:
        return text
    cleaned = text.replace("—", " ").replace("–", " ").replace(" - ", " ")
    # Preserve paragraph breaks while collapsing stray runs of spaces.
    lines = [" ".join(line.split()) for line in cleaned.splitlines()]
    return "\n".join(lines).strip()


def initial_sla(created_at: Optional[datetime] = None) -> str:
    """SLA deadline ISO string, SLA_HOURS after creation."""
    base = created_at or datetime.now(timezone.utc)
    return (base + timedelta(hours=SLA_HOURS)).isoformat()


def is_past_sla(sla_deadline: Optional[str]) -> bool:
    if not sla_deadline:
        return False
    try:
        deadline = datetime.fromisoformat(sla_deadline)
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) >= deadline
    except Exception:
        return False


def within_window(created_at: Optional[str]) -> bool:
    """True when the case was created inside the real-time trigger window."""
    if not created_at:
        return True
    try:
        created = datetime.fromisoformat(created_at)
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - created <= timedelta(hours=THRESHOLD_WINDOW_HOURS)
    except Exception:
        return True


def should_threshold_escalate(case: dict, new_affected: int) -> bool:
    """Real-time rule: enough citizens affected, recent, and not already public."""
    if case.get("status") == "verified_resolved":
        return False
    if int(case.get("escalationLevel", 0)) >= PUBLIC_LEVEL:
        return False
    if not within_window(case.get("createdAt")):
        return False
    return new_affected >= CITIZENS_THRESHOLD


# --------------------------------------------------------------------------- #
# Drafting
# --------------------------------------------------------------------------- #
_LEVEL_BRIEF = {
    0: (
        "a formal grievance addressed to the routed department, requesting "
        "repair and acknowledgement"
    ),
    1: (
        "a firmer reminder addressed to the department, noting the service level "
        "deadline has passed without resolution and requesting urgent action"
    ),
    2: (
        "a short public escalation post that names the responsible department, "
        "states the issue and how many citizens are affected, and calls for a "
        "prompt public response. Do not invent any official names or handles"
    ),
    3: (
        "a Right to Information request asking the department for the status, "
        "assigned officer responsibility, and timeline on this specific issue"
    ),
}


def _fallback_text(level: int, case: dict) -> str:
    dept = case.get("routedDept") or "the responsible municipal department"
    ward = (case.get("location") or {}).get("ward") or "the reported ward"
    issue = (case.get("type") or "road issue").replace("_", " ")
    affected = case.get("citizensAffected", 1)
    label = LADDER.get(level, "Update")
    return _strip_dashes(
        f"{label}. Regarding the {issue} reported in {ward}, currently affecting "
        f"{affected} citizens, this matter is directed to {dept} for prompt action "
        f"through the official grievance channel. A timely resolution and "
        f"acknowledgement are requested."
    )


def _client():
    try:
        from google import genai

        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        return genai.Client(api_key=api_key) if api_key else genai.Client()
    except Exception as exc:  # pragma: no cover
        print(f"[escalation_agent] genai client unavailable: {exc}")
        return None


def initial_draft(case: dict) -> EscalationDraft:
    """The level 0 Filed grievance, generated deterministically (no model call)
    so report submission stays fast. The text is grounded in the case facts."""
    now = datetime.now(timezone.utc).isoformat()
    return EscalationDraft(
        level=0,
        label=LADDER[0],
        draftType=LADDER[0],
        text=_fallback_text(0, case),
        generatedAt=now,
        grounded=True,
    )


def draft_for_level(level: int, case: dict) -> EscalationDraft:
    """Generate the grounded drafted text for a ladder level. Never raises."""
    level = max(0, min(MAX_LEVEL, int(level)))
    label = LADDER[level]
    now = datetime.now(timezone.utc).isoformat()

    dept = case.get("routedDept") or "unknown"
    ward = (case.get("location") or {}).get("ward") or "unknown ward"
    zone = case.get("zone") or "unknown zone"
    issue = (case.get("type") or "road issue").replace("_", " ")
    affected = case.get("citizensAffected", 1)
    channel = case.get("grievanceChannel") or "the official public grievance portal"
    description = case.get("description") or ""

    client = _client()
    if client is None:
        return EscalationDraft(
            level=level,
            label=label,
            draftType=label,
            text=_fallback_text(level, case),
            generatedAt=now,
            grounded=True,
        )

    try:
        from google.genai import types

        facts = (
            f"Issue type: {issue}.\n"
            f"Description: {description}.\n"
            f"Ward: {ward}. Zone: {zone}.\n"
            f"Responsible department: {dept}.\n"
            f"Citizens affected: {affected}.\n"
            f"Grievance channel: {channel}.\n"
        )
        instruction = (
            "You draft formal, plain-language civic complaint text for Prahari, "
            "an Indian civic accountability platform. Use only the facts provided. "
            "Do not invent officer names, phone numbers, case numbers, or social "
            "media handles. Keep it concise and respectful but firm. Do not use "
            "dashes of any kind. Do not use emoji. Write only the complaint text, "
            "no preamble."
        )
        prompt = (
            f"Write {_LEVEL_BRIEF[level]}.\n\nGrounded case facts:\n{facts}"
        )

        response = client.models.generate_content(
            model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
            contents=[prompt],
            config=types.GenerateContentConfig(
                system_instruction=instruction,
                temperature=0.4,
            ),
        )
        text = _strip_dashes((response.text or "").strip())
        if not text:
            text = _fallback_text(level, case)

        return EscalationDraft(
            level=level,
            label=label,
            draftType=label,
            text=text,
            generatedAt=now,
            grounded=True,
        )
    except Exception as exc:
        print(f"[escalation_agent] drafting failed at level {level}: {exc}")
        return EscalationDraft(
            level=level,
            label=label,
            draftType=label,
            text=_fallback_text(level, case),
            generatedAt=now,
            grounded=True,
        )


# --------------------------------------------------------------------------- #
# ADK agent declaration (used by the orchestrator graph in later steps).
# In production this is the long-running escalation agent: it re-checks open
# cases on a schedule for the time-based ladder, and reacts to merge events for
# the real-time threshold path. Guarded so an ADK mismatch cannot break the API.
# --------------------------------------------------------------------------- #
escalation_agent = None
try:  # pragma: no cover - declaration only
    from google.adk.agents import Agent

    escalation_agent = Agent(
        name="escalation_agent",
        model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
        description="Sets SLAs and drafts grounded grievances, escalating unresolved cases autonomously.",
        instruction=(
            "You manage civic case escalation. You set service level deadlines and "
            "draft formal grievance text grounded only in the case facts. You climb "
            "an escalation ladder when cases are unresolved. Never invent officials, "
            "contacts, or case numbers. Do not use dashes of any kind. Do not use emoji."
        ),
    )
except Exception as exc:  # pragma: no cover
    print(f"[escalation_agent] ADK agent not declared ({exc}); using direct drafter.")
