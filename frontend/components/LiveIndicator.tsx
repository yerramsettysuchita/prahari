"use client";

/**
 * A soft-pulsing amber "LIVE" indicator for real-time elements (incoming
 * reports, active escalations). The dot pulses; a faint halo radiates out.
 */
export function LiveIndicator({ label = "LIVE" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted">
      <span className="relative flex h-2 w-2 items-center justify-center">
        <span className="absolute inline-flex h-2 w-2 rounded-full bg-accent animate-halo-soft" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent animate-pulse-soft" />
      </span>
      <span className="font-body text-xs font-medium tracking-[0.18em] text-accent">
        {label}
      </span>
    </span>
  );
}
