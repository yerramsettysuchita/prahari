"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Case, ISSUE_LABEL, timeAgo, WardInsight } from "@/lib/api";
import { CITY_CENTER, CITY_ZOOM, PRAHARI_MAP_STYLE } from "./mapStyle";
import { useGoogleMaps } from "./useGoogleMaps";
import { SeverityTag } from "./SeverityTag";
import { useCountUp } from "./useCountUp";
import { RoutedDept } from "./RoutedDept";
import { EscalationStatus } from "./EscalationStatus";

const ACCENT = "#e8b23a";
const POSITIVE = "#6fae7e";

function markerColor(c: Case): string {
  return c.status === "verified_resolved" ? POSITIVE : ACCENT;
}

// Higher impact reads as a larger, more prominent marker.
function markerScale(c: Case): number {
  const affected = c.citizensAffected ?? 1;
  return Math.min(16, 7 + (affected - 1) * 1.5);
}

export function CaseMap({
  cases,
  insights = [],
  onVerify,
  onUpdated,
}: {
  cases: Case[];
  insights?: WardInsight[];
  onVerify: (c: Case) => void;
  onUpdated: (c: Case) => void;
}) {
  const { status } = useGoogleMaps();
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const risksRef = useRef<google.maps.Circle[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Always read the selected case from the latest data so a verdict flip
  // (amber to green) is reflected in the open info panel too.
  const selected = selectedId
    ? cases.find((c) => c.id === selectedId) ?? null
    : null;

  // Initialize the map once the script is ready.
  useEffect(() => {
    if (status !== "ready" || !mapDiv.current || mapRef.current) return;
    mapRef.current = new google.maps.Map(mapDiv.current, {
      center: CITY_CENTER,
      zoom: CITY_ZOOM,
      styles: PRAHARI_MAP_STYLE,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
      backgroundColor: "#0e0f0d",
    });
  }, [status]);

  // Sync markers to the current cases.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<string>();
    let latest: Case | null = null;

    for (const c of cases) {
      seen.add(c.id);
      if (!latest) latest = c; // cases arrive newest first
      const color = markerColor(c);
      const existing = markersRef.current.get(c.id);
      if (existing) {
        existing.setIcon(dotIcon(color, markerScale(c)));
        continue;
      }
      const marker = new google.maps.Marker({
        position: { lat: c.location.lat, lng: c.location.lng },
        map,
        icon: dotIcon(color, markerScale(c)),
        title: ISSUE_LABEL[c.type],
      });
      marker.addListener("click", () => {
        setSelectedId(c.id);
        map.panTo({ lat: c.location.lat, lng: c.location.lng });
      });
      markersRef.current.set(c.id, marker);
    }

    // Remove markers for cases that no longer exist.
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    }
  }, [cases]);

  // Predictive risk layer: a subtle amber ring over the open-case cluster of
  // each elevated-risk ward. The centroid comes from real case positions, so
  // the emphasis sits where the unresolved load actually is.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const circle of risksRef.current) circle.setMap(null);
    risksRef.current = [];

    const risky = insights.filter((w) => w.riskLevel !== "low");
    for (const w of risky) {
      const wardCases = cases.filter(
        (c) =>
          (c.location.ward || "Unassigned") === w.ward &&
          c.status !== "verified_resolved"
      );
      if (wardCases.length === 0) continue;
      const lat =
        wardCases.reduce((s, c) => s + c.location.lat, 0) / wardCases.length;
      const lng =
        wardCases.reduce((s, c) => s + c.location.lng, 0) / wardCases.length;
      const high = w.riskLevel === "high";
      const circle = new google.maps.Circle({
        map,
        center: { lat, lng },
        radius: 220 + w.openCount * 60,
        strokeColor: ACCENT,
        strokeOpacity: high ? 0.7 : 0.4,
        strokeWeight: 1,
        fillColor: ACCENT,
        fillOpacity: high ? 0.12 : 0.06,
        clickable: false,
      });
      risksRef.current.push(circle);
    }
  }, [insights, cases]);

  return (
    <div className="relative h-[460px] w-full overflow-hidden rounded-lg border border-line bg-ink">
      {/* The map canvas */}
      <div ref={mapDiv} className="absolute inset-0" />

      {/* States that replace the map when it cannot render */}
      {status !== "ready" ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          <p className="font-body text-sm text-muted">
            {status === "no-key"
              ? "Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to show the live map."
              : status === "error"
              ? "The map could not load. Check the Maps API key."
              : "Loading the map."}
          </p>
        </div>
      ) : null}

      {/* Styled info panel for the selected case */}
      <AnimatePresence>
        {selected ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-4 left-4 right-4 z-10 max-w-sm rounded-lg border border-line bg-surface p-4 shadow-soft"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-semibold tracking-tightish text-primary">
                  {ISSUE_LABEL[selected.type]}
                </span>
                <SeverityTag severity={selected.severity} />
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="font-body text-xs uppercase tracking-[0.12em] text-muted hover:text-primary"
              >
                Close
              </button>
            </div>
            <p className="mt-2 font-body text-sm leading-relaxed text-muted">
              {selected.description}
            </p>

            <div className="mt-3 flex items-end justify-between">
              <AffectedStat affected={selected.citizensAffected ?? 1} />
              <p className="font-body text-xs tabular-nums text-muted">
                {timeAgo(selected.createdAt)}
              </p>
            </div>

            <div className="mt-3">
              <RoutedDept caseItem={selected} />
            </div>

            <div className="mt-3">
              <EscalationStatus caseItem={selected} onUpdated={onUpdated} />
            </div>

            {selected.status === "verified_resolved" ? (
              <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
                <span className="inline-block h-2 w-2 rounded-full bg-positive" />
                <span className="font-body text-sm font-medium text-positive">
                  Verified resolved
                </span>
              </div>
            ) : (
              <button
                onClick={() => onVerify(selected)}
                className="mt-4 w-full rounded-lg border border-line bg-ink px-4 py-2 font-body text-sm font-medium text-primary transition-colors hover:border-accent/60"
              >
                Verify resolution
              </button>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// Citizens affected, the headline accountability metric. Amber when many,
// and it counts up live when a merge raises the number.
function AffectedStat({ affected }: { affected: number }) {
  const display = useCountUp(affected, { duration: 1.0 });
  const many = affected > 1;
  return (
    <div>
      <span
        className={`font-display text-2xl font-semibold tabular-nums tracking-tightish ${
          many ? "text-accent" : "text-primary"
        }`}
      >
        {display}
      </span>
      <span className="ml-2 font-body text-xs uppercase tracking-[0.12em] text-muted">
        {affected === 1 ? "citizen affected" : "citizens affected"}
      </span>
    </div>
  );
}

// A filled circle marker in the given color and scale, with a soft ink ring.
function dotIcon(color: string, scale: number): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#0e0f0d",
    strokeWeight: 2,
  };
}
