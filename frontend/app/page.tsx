"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Case,
  clearAllCases,
  deleteCase,
  fetchCases,
  fetchInsights,
  WardInsight,
} from "@/lib/api";
import { Nav } from "@/components/Nav";
import { ReportPanel } from "@/components/ReportPanel";
import { CaseMap } from "@/components/CaseMap";
import { CaseList } from "@/components/CaseList";
import { VerifyPanel } from "@/components/VerifyPanel";

const CACHE_KEY = "prahari_cases_v1";
const CACHE_INSIGHTS = "prahari_insights_v1";

export default function Home() {
  const [cases, setCases] = useState<Case[]>([]);
  const [insights, setInsights] = useState<WardInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<Case | null>(null);

  const load = useCallback(async () => {
    try {
      const [next, ins] = await Promise.all([fetchCases(), fetchInsights()]);
      setCases(next);
      setInsights(ins);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        localStorage.setItem(CACHE_INSIGHTS, JSON.stringify(ins));
      } catch {}
    } catch {
      // Backend may be waking (free tier cold start); keep whatever we have.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Paint instantly from the last known data, then refresh in the background.
    try {
      const c = localStorage.getItem(CACHE_KEY);
      const i = localStorage.getItem(CACHE_INSIGHTS);
      if (c) {
        setCases(JSON.parse(c));
        setLoading(false);
      }
      if (i) setInsights(JSON.parse(i));
    } catch {}
    load();
    const id = setInterval(load, 10000); // keep the board live
    return () => clearInterval(id);
  }, [load]);

  // Optimistically show a freshly created case, then reconcile on next poll.
  const handleCreated = useCallback((c: Case) => {
    setCases((prev) => [c, ...prev.filter((p) => p.id !== c.id)]);
  }, []);

  // Replace a case in place when a verification updates it (the amber to
  // green flip). The modal stays open to show the verdict.
  const handleVerified = useCallback((updated: Case) => {
    setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }, []);

  // Remove a single case, optimistically.
  const handleRemove = useCallback(async (c: Case) => {
    setCases((prev) => prev.filter((p) => p.id !== c.id));
    try {
      await deleteCase(c.id);
    } catch {
      // Reconcile on the next poll if the delete failed.
      load();
    }
  }, [load]);

  // Clear the whole board after a confirm.
  const handleClear = useCallback(async () => {
    if (!window.confirm("Remove all cases from the board? This cannot be undone.")) {
      return;
    }
    setCases([]);
    try {
      await clearAllCases();
    } catch {
      load();
    }
  }, [load]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      {/* Header */}
      <Nav />
      <h1 className="mt-10 max-w-3xl font-display text-5xl font-semibold leading-[1.0] tracking-tightish text-primary md:text-6xl">
        Watching the city, one road at a time.
      </h1>
      <p className="mt-5 max-w-xl font-body text-lg leading-relaxed text-muted">
        Report a pothole with a photo and a location. An agent classifies it and
        it appears here at once.
      </p>

      {/* Workspace. On mobile the report panel comes first so the primary
          action is reachable; on desktop it sits to the right and stays in view. */}
      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Map + list */}
        <div className="order-2 flex flex-col gap-6 lg:order-1">
          <CaseMap
            cases={cases}
            insights={insights}
            onVerify={setVerifying}
            onUpdated={handleVerified}
          />
          <CaseList
            cases={cases}
            loading={loading}
            onVerify={setVerifying}
            onRemove={handleRemove}
            onClear={handleClear}
          />
        </div>
        {/* Report panel */}
        <div className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-8">
            <ReportPanel onCreated={handleCreated} />
          </div>
        </div>
      </div>

      {verifying ? (
        <VerifyPanel
          caseItem={
            cases.find((c) => c.id === verifying.id) ?? verifying
          }
          onClose={() => setVerifying(null)}
          onVerified={handleVerified}
        />
      ) : null}
    </main>
  );
}
