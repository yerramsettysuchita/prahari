"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Case } from "@/lib/api";

/**
 * Grounded routing display. Shows the responsible department and, when the
 * routing came from a real knowledge-base match, an understated "Source
 * verified" chip that reveals the provenance string on tap or hover. When no
 * verified mapping exists, it says so honestly rather than naming a department.
 *
 * The chip is a trust signal, so it stays quiet. Green is reserved for verified
 * resolution; the chip uses restrained ink tones.
 */
export function RoutedDept({
  caseItem,
  compact = false,
}: {
  caseItem: Case;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const matched = caseItem.routingMatched && caseItem.routedDept && caseItem.routedDept !== "unknown";
  const provenance = caseItem.provenance || "";

  if (!matched) {
    return (
      <div className={compact ? "" : "border-t border-line pt-3"}>
        <p className="font-body text-xs uppercase tracking-[0.12em] text-muted">
          Routing
        </p>
        <button
          type="button"
          onClick={() => provenance && setOpen((v) => !v)}
          title={provenance}
          className="mt-1 inline-flex items-center gap-2 text-left"
        >
          <span className="font-body text-sm text-muted">
            No verified routing yet
          </span>
          {provenance ? (
            <span className="font-body text-[11px] uppercase tracking-[0.1em] text-muted/70 underline decoration-dotted underline-offset-2">
              why
            </span>
          ) : null}
        </button>
        <AnimatePresence>
          {open && provenance ? (
            <Provenance text={provenance} />
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={compact ? "" : "border-t border-line pt-3"}>
      {!compact ? (
        <p className="font-body text-xs uppercase tracking-[0.12em] text-muted">
          Routed to
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="font-body text-sm font-medium text-primary">
          {caseItem.routedDept}
        </span>
        <VerifiedChip
          onClick={() => setOpen((v) => !v)}
          title={provenance}
        />
      </div>
      {caseItem.zone || caseItem.grievanceChannel ? (
        <p className="mt-1 font-body text-xs text-muted">
          {caseItem.zone ? `${caseItem.zone} zone` : ""}
          {caseItem.zone && caseItem.grievanceChannel ? ". " : ""}
          {caseItem.grievanceChannel || ""}
        </p>
      ) : null}
      <AnimatePresence>
        {open && provenance ? <Provenance text={provenance} /> : null}
      </AnimatePresence>
    </div>
  );
}

function VerifiedChip({
  onClick,
  title,
}: {
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand/10 px-2 py-0.5 font-body text-[11px] font-medium uppercase tracking-[0.08em] text-brand transition-colors hover:bg-brand/15"
    >
      <CheckMark />
      Source verified
    </button>
  );
}

function CheckMark() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="text-brand"
    >
      <path
        d="M2.5 6.5l2.2 2.2L9.5 3.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Provenance({ text }: { text: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mt-2 overflow-hidden rounded-md border border-line bg-ink px-3 py-2 font-body text-xs leading-relaxed text-muted"
    >
      {text}
    </motion.p>
  );
}
