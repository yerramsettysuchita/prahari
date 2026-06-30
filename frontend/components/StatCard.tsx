"use client";

import { useCountUp } from "./useCountUp";

type StatCardProps = {
  label: string;
  value: number;
  /** Optional unit/suffix, e.g. "days". */
  suffix?: string;
  decimals?: number;
  /** The one accent metric per view. Renders the figure in amber. */
  accent?: boolean;
  /** Resolved/positive metric. Renders the figure in green. */
  positive?: boolean;
  /** Small contextual note under the figure. */
  caption?: string;
};

export function StatCard({
  label,
  value,
  suffix,
  decimals = 0,
  accent = false,
  positive = false,
  caption,
}: StatCardProps) {
  const display = useCountUp(value, { decimals });

  const figureColor = accent
    ? "text-accent"
    : positive
    ? "text-positive"
    : "text-primary";

  return (
    <div className="rounded-lg border border-line bg-surface p-6 shadow-soft">
      <p className="font-body text-xs font-medium uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <div className="mt-4 flex items-baseline gap-2">
        <span
          className={`font-display text-5xl font-semibold tabular-nums tracking-tightish ${figureColor}`}
        >
          {display}
        </span>
        {suffix ? (
          <span className="font-body text-sm font-medium text-muted">
            {suffix}
          </span>
        ) : null}
      </div>
      {caption ? (
        <p className="mt-3 font-body text-sm text-muted">{caption}</p>
      ) : null}
    </div>
  );
}
