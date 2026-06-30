"use client";

import { motion } from "framer-motion";
import { Case, ESCALATION_LADDER, ISSUE_LABEL } from "@/lib/api";

/**
 * A clean modal showing the grounded drafted text for each escalation level the
 * case has reached. The drafts are real formal civic complaints, transparent
 * and inspectable, so the autonomy is never a black box.
 */
export function DraftModal({
  caseItem,
  onClose,
}: {
  caseItem: Case;
  onClose: () => void;
}) {
  const drafts = (caseItem.escalations ?? [])
    .slice()
    .sort((a, b) => a.level - b.level);
  const current = caseItem.escalationLevel ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/85 p-4 backdrop-blur-sm md:items-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl rounded-lg border border-line bg-surface shadow-soft"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <p className="font-body text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Escalation drafts
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tightish text-primary">
              {ISSUE_LABEL[caseItem.type]}
            </h2>
            <p className="mt-1 font-body text-sm text-muted">
              Routed to {caseItem.routedDept || "an unverified department"}.
              Current stage {ESCALATION_LADDER[current] ?? "Filed"}.
            </p>
          </div>
          <button
            onClick={onClose}
            className="font-body text-xs uppercase tracking-[0.12em] text-muted hover:text-primary"
          >
            Close
          </button>
        </header>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-6">
          {drafts.length === 0 ? (
            <p className="font-body text-sm text-muted">
              No drafts yet. The first grievance is filed when the case is created.
            </p>
          ) : (
            <ol className="space-y-5">
              {drafts.map((d) => (
                <li key={`${d.level}-${d.generatedAt}`}>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        d.level >= 2 ? "bg-accent" : "bg-muted"
                      }`}
                    />
                    <span className="font-body text-xs font-medium uppercase tracking-[0.12em] text-muted">
                      Level {d.level}. {d.label}
                    </span>
                  </div>
                  <div className="mt-2 whitespace-pre-line rounded-lg border border-line bg-ink p-4 font-body text-sm leading-relaxed text-primary">
                    {d.text}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </motion.div>
    </div>
  );
}
