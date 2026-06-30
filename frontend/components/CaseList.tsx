"use client";

import { Case, ISSUE_LABEL, timeAgo } from "@/lib/api";
import { SeverityTag } from "./SeverityTag";
import { RoutedDept } from "./RoutedDept";

export function CaseList({
  cases,
  loading,
  onVerify,
  onRemove,
  onClear,
}: {
  cases: Case[];
  loading: boolean;
  onVerify: (c: Case) => void;
  onRemove: (c: Case) => void;
  onClear: () => void;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface shadow-soft">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-display text-xl font-semibold tracking-tightish text-primary">
          Recent cases
        </h2>
        <div className="flex items-center gap-4">
          <span className="font-body text-xs tabular-nums text-muted">
            {cases.length} open
          </span>
          {cases.length > 0 ? (
            <button
              onClick={onClear}
              className="font-body text-xs font-medium text-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-primary"
            >
              Clear all
            </button>
          ) : null}
        </div>
      </header>

      {loading && cases.length === 0 ? (
        <div className="px-5 py-10">
          <p className="font-body text-sm text-muted">Loading cases.</p>
        </div>
      ) : cases.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="font-display text-lg text-primary">No cases yet.</p>
          <p className="mt-1 font-body text-sm text-muted">
            Submit the first report.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {cases.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-body text-sm font-medium text-primary">
                    {ISSUE_LABEL[c.type]}
                  </span>
                  {c.severity === "high" && c.status !== "verified_resolved" ? (
                    <SeverityTag severity="high" />
                  ) : null}
                  {c.status === "verified_resolved" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-positive/40 bg-positive/10 px-2 py-0.5 font-body text-[11px] font-medium uppercase tracking-[0.08em] text-positive">
                      <span className="h-1.5 w-1.5 rounded-full bg-positive" />
                      Resolved
                    </span>
                  ) : (c.escalationLevel ?? 0) >= 1 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 font-body text-[11px] font-medium uppercase tracking-[0.08em] text-accent">
                      {(c.escalationLevel ?? 0) >= 2 ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-soft" />
                      ) : null}
                      {c.escalationLabel ?? "Escalated"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate font-body text-xs text-muted">
                  {c.description}
                </p>
                <p className="mt-1 font-body text-xs tabular-nums">
                  <span
                    className={
                      (c.citizensAffected ?? 1) > 1
                        ? "font-medium text-accent"
                        : "text-muted"
                    }
                  >
                    {c.citizensAffected ?? 1}
                  </span>{" "}
                  <span className="text-muted">
                    {(c.citizensAffected ?? 1) === 1
                      ? "citizen affected"
                      : "citizens affected"}
                  </span>
                </p>
                <div className="mt-1.5">
                  <RoutedDept caseItem={c} compact />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {c.status !== "verified_resolved" ? (
                  <button
                    onClick={() => onVerify(c)}
                    className="rounded-md border border-line px-2.5 py-1 font-body text-xs font-medium text-primary transition-colors hover:border-accent/60"
                  >
                    Verify
                  </button>
                ) : null}
                <button
                  onClick={() => onRemove(c)}
                  title="Remove this case"
                  className="rounded-md border border-line px-2.5 py-1 font-body text-xs font-medium text-muted transition-colors hover:border-line hover:text-primary"
                >
                  Remove
                </button>
                <span className="font-body text-xs tabular-nums text-muted">
                  {timeAgo(c.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
