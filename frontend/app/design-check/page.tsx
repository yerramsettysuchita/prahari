"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { LiveIndicator } from "@/components/LiveIndicator";

/**
 * Design-system proof page. Not a feature. It exists only to verify the
 * typographic hierarchy, palette discipline, and motion feel look senior
 * before any feature UI is built.
 */
export default function DesignCheck() {
  // The accent metric ticks up over time to exercise the count-up on change,
  // the way a live command center would receive incoming reports.
  const [reports, setReports] = useState(0);

  useEffect(() => {
    setReports(1247); // initial count-up from 0 on mount
    const id = setInterval(() => {
      setReports((n) => n + Math.floor(Math.random() * 4) + 1);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-20 md:py-28">
      {/* Eyebrow + live status */}
      <div className="flex items-center justify-between">
        <p className="font-body text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Prahari Command Center
        </p>
        <LiveIndicator />
      </div>

      {/* Editorial display headline */}
      <h1 className="mt-10 max-w-3xl font-display text-6xl font-semibold leading-[0.98] tracking-tightish text-primary md:text-7xl">
        The city is being watched.
      </h1>
      <p className="mt-6 max-w-xl font-body text-lg leading-relaxed text-muted">
        Every pothole gets reported, classified, routed, and verified as fixed.
        A public record shows who acted on it, and how fast they moved.
      </p>

      {/* Stat row */}
      <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Reports ingested"
          value={reports}
          accent
          caption="Live across the city today"
        />
        <StatCard
          label="Median time to route"
          value={4.2}
          suffix="min"
          decimals={1}
          caption="Intake to correct department"
        />
        <StatCard
          label="Verified resolved"
          value={318}
          positive
          caption="Confirmed by before/after vision"
        />
      </div>

      {/* Footnote */}
      <p className="mt-20 border-t border-line pt-8 font-body text-sm text-muted">
        Design check for typography (Fraunces and Inter Tight), palette
        discipline, and motion. No feature logic yet.
      </p>
    </main>
  );
}
