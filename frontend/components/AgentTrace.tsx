"use client";

import { motion } from "framer-motion";
import type { TraceStep } from "@/lib/api";

/**
 * The visible agent trace. Shows the multi-agent graph working through a report
 * step by step, naming each agent and its decision. The steps reveal in a
 * staggered sequence so it reads as the agents acting one after another, which
 * makes the agentic depth inspectable rather than hidden.
 */
export function AgentTrace({ steps }: { steps: TraceStep[] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="rounded-lg border border-line bg-ink p-5">
      <p className="font-body text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Agent trace
      </p>
      <ol className="mt-4 space-y-0">
        {steps.map((step, i) => {
          const accent =
            step.status === "alert"
              ? "text-accent"
              : step.status === "flagged"
              ? "text-accent"
              : step.status === "unknown"
              ? "text-muted"
              : "text-primary";
          const dot =
            step.status === "alert" || step.status === "flagged"
              ? "bg-accent"
              : step.status === "unknown"
              ? "bg-muted"
              : "bg-primary";
          const last = i === steps.length - 1;

          return (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.35, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex gap-3 pb-4 last:pb-0"
            >
              {/* Rail and node */}
              <div className="flex flex-col items-center">
                <span className={`mt-1 inline-block h-2 w-2 rounded-full ${dot}`} />
                {!last ? (
                  <span className="mt-1 w-px flex-1 bg-line" aria-hidden="true" />
                ) : null}
              </div>

              <div className="min-w-0 pb-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-body text-sm font-semibold text-primary">
                    {step.agent}
                  </span>
                  <span className="font-body text-xs text-muted">
                    {step.action}
                  </span>
                </div>
                <p className={`mt-0.5 font-body text-sm ${accent}`}>
                  {step.result}
                </p>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
