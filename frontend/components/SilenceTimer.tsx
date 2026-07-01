"use client";

import { useEffect, useState } from "react";
import type { Case } from "@/lib/api";

/**
 * The Government Silence Timer. A live, publicly visible clock on every
 * unresolved case showing exactly how long the responsible department has
 * stayed silent since the case was reported. It ticks upward in real time.
 *
 * Pure display over data that already exists (createdAt and resolvedAt). When a
 * case is verified resolved the clock freezes and turns green, so the contrast
 * between silence and resolution is visible. Amber is the only accent used.
 */
export function SilenceTimer({
  caseItem,
  compact = false,
}: {
  caseItem: Case;
  compact?: boolean;
}) {
  const isResolved =
    caseItem.status === "verified_resolved" && !!caseItem.resolvedAt;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (isResolved) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isResolved]);

  const created = new Date(caseItem.createdAt).getTime();
  if (Number.isNaN(created)) return null;

  // Frozen resolved state: how long it took, in restrained green.
  if (isResolved) {
    const end = new Date(caseItem.resolvedAt as string).getTime();
    const label = formatDuration(end - created, false);
    return (
      <div className={compact ? "" : "border-t border-line pt-3"}>
        {!compact ? (
          <p className="font-body text-[11px] uppercase tracking-[0.12em] text-muted">
            Accountability clock
          </p>
        ) : null}
        <p
          className={`mt-1 font-body font-medium tabular-nums text-positive ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          Resolved in {label}
        </p>
      </div>
    );
  }

  // Live upward-ticking silence.
  const elapsed = now - created;
  return (
    <div className={compact ? "" : "border-t border-line pt-3"}>
      {!compact ? (
        <p className="font-body text-[11px] uppercase tracking-[0.12em] text-muted">
          Accountability clock
        </p>
      ) : null}
      <div className="mt-1 flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
        <span
          className={`font-body font-medium tabular-nums text-accent ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          Government silent for {formatDuration(elapsed, true)}
        </span>
      </div>
    </div>
  );
}

/** Format a millisecond span as "3d 4h 12m" and optionally a ticking seconds. */
function formatDuration(ms: number, withSeconds: boolean): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (d > 0 || h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  if (withSeconds) parts.push(`${String(s).padStart(2, "0")}s`);
  return parts.join(" ");
}
