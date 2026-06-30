"use client";

import { useEffect, useState } from "react";

/**
 * Live countdown to an ISO deadline. Returns a short formatted remaining string
 * and whether the deadline has passed. Ticks every second.
 */
export function useCountdown(deadlineIso?: string | null): {
  remaining: string;
  isPast: boolean;
} {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!deadlineIso) return { remaining: "", isPast: false };
  const deadline = new Date(deadlineIso).getTime();
  if (Number.isNaN(deadline)) return { remaining: "", isPast: false };

  const diff = deadline - now;
  if (diff <= 0) return { remaining: "SLA passed", isPast: true };

  const secs = Math.floor(diff / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const remaining =
    h > 0 ? `${h}h ${m}m left` : m > 0 ? `${m}m ${s}s left` : `${s}s left`;
  return { remaining, isPast: false };
}
