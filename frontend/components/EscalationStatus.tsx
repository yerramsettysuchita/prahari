"use client";

import { useState } from "react";
import {
  advanceEscalation,
  Case,
  checkEscalation,
  ESCALATION_LADDER,
} from "@/lib/api";
import { useCountdown } from "./useCountdown";
import { DraftModal } from "./DraftModal";

/**
 * Escalation status for a case: the current ladder stage, a live SLA countdown
 * while open, an inspectable draft viewer, and demo controls. Active escalation
 * carries the amber accent; the public stage pulses to read as live.
 */
export function EscalationStatus({
  caseItem,
  onUpdated,
}: {
  caseItem: Case;
  onUpdated: (c: Case) => void;
}) {
  const [showDrafts, setShowDrafts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const level = caseItem.escalationLevel ?? 0;
  const label = caseItem.escalationLabel ?? ESCALATION_LADDER[level] ?? "Filed";
  const resolved = caseItem.status === "verified_resolved";
  const active = !resolved && level >= 1;
  const isPublic = !resolved && level >= 2;
  const { remaining } = useCountdown(caseItem.slaDeadline);

  const runAdvance = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await advanceEscalation(caseItem.id);
      onUpdated(res.case);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not advance.");
    } finally {
      setBusy(false);
    }
  };

  const runSlaCheck = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await checkEscalation(caseItem.id);
      onUpdated(res.case);
      if (!res.advanced && res.reason) setNote(res.reason);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not run the check.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-line pt-3">
      <p className="font-body text-xs uppercase tracking-[0.12em] text-muted">
        Escalation
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-body text-[11px] font-medium uppercase tracking-[0.08em] ${
            resolved
              ? "border-line bg-surface text-muted"
              : active
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-line bg-surface text-primary"
          }`}
        >
          {isPublic ? (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-accent animate-halo-soft" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent animate-pulse-soft" />
            </span>
          ) : null}
          {label}
        </span>

        {!resolved && remaining ? (
          <span className="font-body text-xs tabular-nums text-muted">
            {remaining}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowDrafts(true)}
          className="rounded-md border border-line bg-ink px-2.5 py-1 font-body text-xs font-medium text-primary transition-colors hover:border-accent/60"
        >
          View draft
        </button>
        {!resolved && level < 3 ? (
          <>
            <button
              onClick={runSlaCheck}
              disabled={busy}
              className="rounded-md border border-line bg-ink px-2.5 py-1 font-body text-xs font-medium text-muted transition-colors hover:border-accent/60 hover:text-primary disabled:opacity-50"
            >
              Run SLA check
            </button>
            <button
              onClick={runAdvance}
              disabled={busy}
              className="rounded-md border border-line bg-ink px-2.5 py-1 font-body text-xs font-medium text-muted transition-colors hover:border-accent/60 hover:text-primary disabled:opacity-50"
            >
              Advance
            </button>
          </>
        ) : null}
      </div>

      {note ? (
        <p className="mt-2 font-body text-xs text-muted">{note}</p>
      ) : null}

      {showDrafts ? (
        <DraftModal caseItem={caseItem} onClose={() => setShowDrafts(false)} />
      ) : null}
    </div>
  );
}
