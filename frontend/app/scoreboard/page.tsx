"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DeptScore,
  fetchInsights,
  fetchScoreboard,
  Scoreboard,
  WardInsight,
  WardScore,
} from "@/lib/api";
import { Nav } from "@/components/Nav";
import { StatCard } from "@/components/StatCard";

type Tab = "wards" | "departments";

export default function ScoreboardPage() {
  const [board, setBoard] = useState<Scoreboard | null>(null);
  const [insights, setInsights] = useState<WardInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("wards");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [b, i] = await Promise.all([fetchScoreboard(), fetchInsights()]);
      if (!alive) return;
      setBoard(b);
      setInsights(i);
      setLoading(false);
    };
    load();
    const id = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const headline = board?.headline;
  const rows = tab === "wards" ? board?.wards ?? [] : board?.departments ?? [];

  const riskWards = useMemo(
    () =>
      insights
        .filter((w) => w.riskLevel !== "low")
        .sort((a, b) => (a.riskLevel === "high" ? -1 : 1) - (b.riskLevel === "high" ? -1 : 1)),
    [insights]
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <Nav />

      <header className="mt-10">
        <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[1.0] tracking-tightish text-primary md:text-6xl">
          Government responsiveness.
        </h1>
        <p className="mt-5 max-w-2xl font-body text-lg leading-relaxed text-muted">
          A public record of how fast BBMP wards and departments actually resolve
          road issues. Scored on vision verified resolutions only. Nothing counts
          until the fix is seen.
        </p>
      </header>

      {/* Headline metrics */}
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total cases"
          value={headline?.totalCases ?? 0}
          caption="Reported across the city"
        />
        <StatCard
          label="Citizens affected"
          value={headline?.totalCitizensAffected ?? 0}
          accent
          caption="Counted through deduplication"
        />
        <StatCard
          label="Verified resolved"
          value={headline?.verifiedResolvedCount ?? 0}
          positive
          caption="Confirmed by before and after vision"
        />
        <StatCard
          label="Avg resolution time"
          value={headline?.avgResolutionDays ?? 0}
          suffix="days"
          decimals={1}
          caption="Across verified resolutions"
        />
      </div>

      {/* Ranked table */}
      <section className="mt-12 rounded-lg border border-line bg-surface shadow-soft">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="font-display text-xl font-semibold tracking-tightish text-primary">
            Responsiveness ranking
          </h2>
          <div className="flex items-center gap-1 rounded-lg border border-line bg-ink p-1">
            {(["wards", "departments"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1 font-body text-xs font-medium uppercase tracking-[0.1em] transition-colors ${
                  tab === t ? "bg-surface text-primary" : "text-muted hover:text-primary"
                }`}
              >
                {t === "wards" ? "Wards" : "Departments"}
              </button>
            ))}
          </div>
        </header>

        {loading && !board ? (
          <div className="px-5 py-12">
            <p className="font-body text-sm text-muted">Loading the ranking.</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-display text-lg text-primary">No ranking yet.</p>
            <p className="mt-1 font-body text-sm text-muted">
              Verified resolutions populate the board.
            </p>
          </div>
        ) : (
          <ScoreTable rows={rows} kind={tab} />
        )}

        {board?.source ? (
          <p className="border-t border-line px-5 py-3 font-body text-xs text-muted">
            {board.source === "bigquery"
              ? "Ranking powered by a BigQuery warehouse query."
              : "Ranking computed in memory from live case data."}
          </p>
        ) : null}
      </section>

      {/* Predictive risk */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold tracking-tightish text-primary">
          Predictive civic risk
        </h2>
        <p className="mt-2 max-w-2xl font-body text-sm text-muted">
          Grounded in real open case counts per ward. Clusters of unresolved
          drainage raise monsoon flood risk; aging potholes raise road safety
          risk.
        </p>
        {riskWards.length === 0 ? (
          <p className="mt-5 rounded-lg border border-line bg-surface px-5 py-6 font-body text-sm text-muted">
            No elevated risk wards right now.
          </p>
        ) : (
          <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {riskWards.map((w) => (
              <li
                key={w.ward}
                className={`rounded-lg border p-4 ${
                  w.riskLevel === "high"
                    ? "border-accent/40 bg-accent/10"
                    : "border-line bg-surface"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm font-medium text-primary">
                    {w.ward}
                  </span>
                  <span
                    className={`rounded-md border px-2 py-0.5 font-body text-[11px] font-medium uppercase tracking-[0.08em] ${
                      w.riskLevel === "high"
                        ? "border-accent/50 text-accent"
                        : "border-line text-muted"
                    }`}
                  >
                    {w.riskLevel} risk
                  </span>
                </div>
                <p className="mt-2 font-body text-sm leading-relaxed text-muted">
                  {w.riskNote}
                </p>
                <p className="mt-2 font-body text-xs tabular-nums text-muted">
                  {w.openCount} open, {w.avgUnresolvedAgeDays} days average age
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function ScoreTable({
  rows,
  kind,
}: {
  rows: WardScore[] | DeptScore[];
  kind: Tab;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse">
        <thead>
          <tr className="border-b border-line text-left">
            <Th className="w-12">Rank</Th>
            <Th>{kind === "wards" ? "Ward" : "Department"}</Th>
            <Th className="text-right">Score</Th>
            <Th className="text-right">Verified</Th>
            <Th className="text-right">Avg days</Th>
            <Th className="text-right">Open</Th>
            <Th className="text-right">Oldest open</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const name = kind === "wards" ? (r as WardScore).ward : (r as DeptScore).department;
            const slow = r.responsivenessScore < 40;
            const stale = r.oldestOpenAgeDays >= 7;
            return (
              <tr
                key={name}
                className="border-b border-line/70 last:border-0"
              >
                <Td className="font-body tabular-nums text-muted">{r.rank}</Td>
                <Td className="font-body font-medium text-primary">{name}</Td>
                <Td className="text-right">
                  <span
                    className={`font-display text-lg font-semibold tabular-nums ${
                      slow ? "text-accent" : "text-primary"
                    }`}
                  >
                    {r.responsivenessScore}
                  </span>
                </Td>
                <Td className="text-right font-body tabular-nums text-positive">
                  {r.verifiedResolvedCount}
                </Td>
                <Td className="text-right font-body tabular-nums text-muted">
                  {r.avgResolutionDays ?? "n/a"}
                </Td>
                <Td className="text-right font-body tabular-nums text-muted">
                  {r.openCount}
                </Td>
                <Td
                  className={`text-right font-body tabular-nums ${
                    stale ? "text-accent" : "text-muted"
                  }`}
                >
                  {r.oldestOpenAgeDays > 0 ? `${r.oldestOpenAgeDays}d` : "none"}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-5 py-3 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-muted ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-5 py-3 text-sm ${className}`}>{children}</td>;
}
