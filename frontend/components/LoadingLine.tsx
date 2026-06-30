"use client";

import { motion } from "framer-motion";

/**
 * A subtle indeterminate amber line. Our replacement for a spinner: a thin
 * segment that glides across a hairline track while work is in flight.
 */
export function LoadingLine({ label }: { label?: string }) {
  return (
    <div className="w-full">
      {label ? (
        <p className="mb-2 font-body text-xs uppercase tracking-[0.14em] text-muted">
          {label}
        </p>
      ) : null}
      <div className="relative h-px w-full overflow-hidden bg-line">
        <motion.div
          className="absolute inset-y-0 w-1/3 bg-accent"
          initial={{ x: "-100%" }}
          animate={{ x: "300%" }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            ease: [0.4, 0, 0.6, 1],
          }}
        />
      </div>
    </div>
  );
}
