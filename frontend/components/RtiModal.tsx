"use client";

import { motion } from "framer-motion";
import { Case, ISSUE_LABEL, RtiDraft } from "@/lib/api";

/**
 * Displays the generated Right to Information request as a clean, inspectable
 * document, clearly labeled as a citizen-fileable draft. Styled to match the
 * escalation draft panel. Read only, transparent, and grounded in case facts.
 */
export function RtiModal({
  caseItem,
  rti,
  onClose,
}: {
  caseItem: Case;
  rti: RtiDraft;
  onClose: () => void;
}) {
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
              Right to Information draft
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tightish text-primary">
              {ISSUE_LABEL[caseItem.type]}
            </h2>
            <p className="mt-1 font-body text-sm text-muted">
              A formal RTI request a citizen can file. Grounded in this case,
              with blanks for your personal details.
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
          <div className="whitespace-pre-line rounded-lg border border-line bg-ink p-5 font-body text-sm leading-relaxed text-primary">
            {rti.text}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
