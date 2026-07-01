import { LiveIndicator } from "@/components/LiveIndicator";

export const metadata = {
  title: "Prahari, autonomous civic accountability infrastructure",
  description:
    "Prahari turns a citizen photo into a tracked, routed, and vision verified municipal case, then ranks departments by how fast they actually fix things.",
};

export default function Landing() {
  return (
    <main className="bg-ink">
      <LandingNav />
      <Hero />
      <Problem />
      <HowItWorks />
      <Differentiators />
      <AgentNetwork />
      <GoogleTech />
      <FinalCta />
      <Footer />
    </main>
  );
}

/* --------------------------------------------------------------------------- */
/* Navigation                                                                  */
/* --------------------------------------------------------------------------- */
function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="flex items-center gap-2.5">
          <span className="h-6 w-[3px] rounded-full bg-accent" />
          <span className="font-display text-2xl font-semibold tracking-tightish text-primary">
            Prahari
          </span>
        </a>
        <nav className="flex items-center gap-5">
          <a
            href="/scoreboard"
            className="hidden font-body text-sm text-muted transition-colors hover:text-primary sm:inline"
          >
            Scoreboard
          </a>
          <a
            href="/dashboard"
            className="rounded-lg bg-accent px-4 py-2 font-body text-sm font-semibold text-ink transition-opacity hover:opacity-90"
          >
            Open the command center
          </a>
        </nav>
      </div>
    </header>
  );
}

/* --------------------------------------------------------------------------- */
/* Hero                                                                        */
/* --------------------------------------------------------------------------- */
function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 md:pt-24">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1">
            <LiveIndicator label="LIVE IN BENGALURU" />
          </div>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-[0.98] tracking-tightish text-primary md:text-7xl">
            Make the city answer for its roads.
          </h1>
          <p className="mt-6 max-w-xl font-body text-lg leading-relaxed text-muted">
            The same pothole gets reported forty times and ignored forty times.
            Prahari turns a single citizen photo into a tracked, routed, and
            vision verified municipal case, then ranks departments by how fast
            they actually fix things.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/dashboard"
              className="rounded-lg bg-accent px-5 py-3 font-body text-sm font-semibold text-ink transition-opacity hover:opacity-90"
            >
              Open the command center
            </a>
            <a
              href="/scoreboard"
              className="rounded-lg border border-line bg-surface px-5 py-3 font-body text-sm font-semibold text-primary transition-colors hover:border-accent/60"
            >
              See the scoreboard
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
            <Stat value="7" label="AI agents" />
            <Stat value="1 city" label="One vertical, potholes" />
            <Stat value="Vision" label="Proof of resolution" />
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-semibold tracking-tightish text-primary">
        {value}
      </div>
      <div className="font-body text-xs uppercase tracking-[0.12em] text-muted">
        {label}
      </div>
    </div>
  );
}

/** A faux verified case card, a preview of the real product. */
function HeroVisual() {
  return (
    <div className="relative">
      <div className="rounded-lg border border-line bg-surface p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <span className="font-body text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Case, Indiranagar
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-positive/40 bg-positive/10 px-2 py-0.5 font-body text-[11px] font-semibold uppercase tracking-[0.08em] text-positive">
            <span className="h-1.5 w-1.5 rounded-full bg-positive" />
            Verified resolved
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <FrameMock label="Before" tone="danger" />
          <FrameMock label="After" tone="positive" />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className="font-display text-lg font-semibold tracking-tightish text-primary">
            Pothole
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand/10 px-2 py-0.5 font-body text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">
            <Check className="h-2.5 w-2.5" />
            Source verified
          </span>
        </div>
        <p className="mt-2 font-body text-sm text-muted">
          Routed to BBMP Road Infrastructure Engineering wing, East zone.
        </p>
        <div className="mt-4 border-t border-line pt-3">
          <p className="font-body text-[11px] uppercase tracking-[0.12em] text-muted">
            Accountability clock
          </p>
          <p className="mt-1 font-body text-sm font-medium tabular-nums text-positive">
            Resolved in 1d 6h
          </p>
        </div>
      </div>
      {/* Floating agent chip */}
      <div className="absolute -bottom-4 -left-4 hidden rounded-lg border border-line bg-surface px-3 py-2 shadow-soft sm:block">
        <p className="font-body text-[11px] uppercase tracking-[0.12em] text-muted">
          Escalation agent
        </p>
        <p className="font-body text-sm font-medium text-accent">
          Publicly escalated on its own
        </p>
      </div>
    </div>
  );
}

function FrameMock({
  label,
  tone,
}: {
  label: string;
  tone: "danger" | "positive";
}) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-line bg-ink">
      <span className="absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5 font-body text-[10px] font-semibold uppercase tracking-[0.1em] text-ink">
        {label}
      </span>
      <div className="flex h-full items-end">
        <div
          className={`h-1.5 w-full ${
            tone === "danger" ? "bg-danger/70" : "bg-positive/70"
          }`}
        />
      </div>
      <RoadMock tone={tone} />
    </div>
  );
}

function RoadMock({ tone }: { tone: "danger" | "positive" }) {
  return (
    <svg
      viewBox="0 0 120 90"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect width="120" height="90" fill="var(--line)" opacity="0.25" />
      <polygon points="40,90 55,30 65,30 80,90" fill="var(--surface)" />
      <rect x="58" y="40" width="4" height="10" fill="var(--muted)" opacity="0.5" />
      <rect x="57" y="58" width="6" height="12" fill="var(--muted)" opacity="0.5" />
      {tone === "danger" ? (
        <ellipse cx="60" cy="72" rx="12" ry="5" fill="var(--danger)" opacity="0.55" />
      ) : (
        <rect x="46" y="66" width="28" height="14" rx="2" fill="var(--muted)" opacity="0.35" />
      )}
    </svg>
  );
}

/* --------------------------------------------------------------------------- */
/* Problem                                                                     */
/* --------------------------------------------------------------------------- */
function Problem() {
  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <p className="font-body text-xs font-medium uppercase tracking-[0.16em] text-danger">
          The problem
        </p>
        <h2 className="mt-4 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tightish text-primary md:text-4xl">
          Reporting a civic issue is fragmented, opaque, and forgotten.
        </h2>
        <p className="mt-5 max-w-2xl font-body text-lg leading-relaxed text-muted">
          Complaints pile up with no owner, no deadline, and no proof of
          resolution. Citizens lose trust, and there is no public record of
          which department acted and which one stalled. Most civic apps add to
          the noise. Prahari turns the noise into accountability.
        </p>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------- */
/* How it works                                                                */
/* --------------------------------------------------------------------------- */
const STEPS = [
  { icon: Camera, title: "Report", text: "Photo, note, and a location." },
  { icon: Tag, title: "Classify", text: "Issue type and severity." },
  { icon: Shield, title: "Verify", text: "Confidence cross check." },
  { icon: Merge, title: "Dedup", text: "Merge nearby duplicates." },
  { icon: Signpost, title: "Route", text: "Grounded department." },
  { icon: Bell, title: "Escalate", text: "Autonomous SLA ladder." },
  { icon: Check, title: "Resolve", text: "Before and after vision." },
];

function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <p className="font-body text-xs font-medium uppercase tracking-[0.16em] text-accent">
        How it works
      </p>
      <h2 className="mt-4 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tightish text-primary md:text-4xl">
        One photo runs the whole loop, on its own.
      </h2>
      <p className="mt-4 max-w-2xl font-body text-lg text-muted">
        A network of agents classifies, deduplicates, routes, escalates, and
        verifies resolution, branching on real conditions rather than a fixed
        chain.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {STEPS.map((s, i) => (
          <div
            key={s.title}
            className="rounded-lg border border-line bg-surface p-4 shadow-soft"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent">
                <s.icon className="h-4 w-4" />
              </span>
              <span className="font-body text-[11px] font-semibold tabular-nums text-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <p className="mt-3 font-body text-sm font-semibold text-primary">
              {s.title}
            </p>
            <p className="mt-1 font-body text-xs leading-relaxed text-muted">
              {s.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------- */
/* Differentiators                                                             */
/* --------------------------------------------------------------------------- */
function Differentiators() {
  const cards = [
    {
      tone: "positive",
      icon: Check,
      title: "Vision verified resolution",
      text: "A case is resolved only when a before and after photo proves the fix. Never a manual toggle, so the resolved number means something.",
    },
    {
      tone: "brand",
      icon: Signpost,
      title: "Grounded routing with provenance",
      text: "Every case routes to a real department from a knowledge base, tagged with its source. The system never invents an office or an official.",
    },
    {
      tone: "accent",
      icon: Trophy,
      title: "The government scoreboard",
      text: "A public ranking of wards and departments by verified resolution speed. Prahari gamifies the government, not the citizen.",
    },
  ] as const;

  const tint: Record<string, string> = {
    positive: "text-positive bg-positive/10",
    brand: "text-brand bg-brand/10",
    accent: "text-accent bg-accent/10",
  };

  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <p className="font-body text-xs font-medium uppercase tracking-[0.16em] text-brand">
          Why it is different
        </p>
        <h2 className="mt-4 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tightish text-primary md:text-4xl">
          Honesty is the feature.
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.title}
              className="rounded-lg border border-line bg-ink p-6 shadow-soft"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${tint[c.tone]}`}
              >
                <c.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold tracking-tightish text-primary">
                {c.title}
              </h3>
              <p className="mt-2 font-body text-sm leading-relaxed text-muted">
                {c.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------- */
/* Agent network                                                               */
/* --------------------------------------------------------------------------- */
const AGENTS = [
  { name: "Intake", text: "Classifies the issue, severity, and description from the photo." },
  { name: "Verification", text: "Cross checks confidence and flags weak results for the community." },
  { name: "Dedup", text: "Finds nearby open cases and merges true duplicates." },
  { name: "Routing", text: "Resolves the responsible department from the grounded knowledge base." },
  { name: "Escalation", text: "Sets the SLA, drafts grievances, and climbs the ladder autonomously." },
  { name: "Resolution", text: "Runs the before and after vision comparison that closes the loop." },
  { name: "Insight", text: "Aggregates open cases per ward to surface predictive civic risk." },
];

function AgentNetwork() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <p className="font-body text-xs font-medium uppercase tracking-[0.16em] text-accent">
        The agent network
      </p>
      <h2 className="mt-4 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tightish text-primary md:text-4xl">
        Seven focused agents, one orchestrated graph.
      </h2>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AGENTS.map((a, i) => (
          <div
            key={a.name}
            className="rounded-lg border border-line bg-surface p-5 shadow-soft"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 font-body text-sm font-semibold text-accent">
                {i + 1}
              </span>
              <span className="font-body text-base font-semibold text-primary">
                {a.name} agent
              </span>
            </div>
            <p className="mt-3 font-body text-sm leading-relaxed text-muted">
              {a.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------- */
/* Google tech                                                                 */
/* --------------------------------------------------------------------------- */
const TECH = [
  "Gemini",
  "Agent Development Kit",
  "Firebase Firestore",
  "Cloud Storage",
  "BigQuery",
  "Google Maps",
  "Firebase Hosting",
  "Google Cloud",
];

function GoogleTech() {
  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="font-body text-xs font-medium uppercase tracking-[0.16em] text-brand">
          Built on Google
        </p>
        <h2 className="mt-4 font-display text-3xl font-semibold tracking-tightish text-primary">
          A Google powered stack, end to end.
        </h2>
        <div className="mt-8 flex flex-wrap gap-3">
          {TECH.map((t) => (
            <span
              key={t}
              className="rounded-lg border border-line bg-ink px-4 py-2 font-body text-sm font-medium text-primary"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------- */
/* Final CTA and footer                                                        */
/* --------------------------------------------------------------------------- */
function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 text-center md:py-28">
      <h2 className="mx-auto max-w-3xl font-display text-4xl font-semibold leading-[1.02] tracking-tightish text-primary md:text-6xl">
        The city is being watched.
      </h2>
      <p className="mx-auto mt-5 max-w-xl font-body text-lg text-muted">
        Report an issue, watch the agents act, and see the government ranked on a
        public record of who fixed what, and how fast.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <a
          href="/dashboard"
          className="rounded-lg bg-accent px-6 py-3 font-body text-sm font-semibold text-ink transition-opacity hover:opacity-90"
        >
          Open the command center
        </a>
        <a
          href="/scoreboard"
          className="rounded-lg border border-line bg-surface px-6 py-3 font-body text-sm font-semibold text-primary transition-colors hover:border-accent/60"
        >
          See the scoreboard
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="h-5 w-[3px] rounded-full bg-accent" />
          <span className="font-display text-lg font-semibold tracking-tightish text-primary">
            Prahari
          </span>
        </div>
        <p className="font-body text-sm text-muted">
          Autonomous civic accountability infrastructure for urban India.
        </p>
      </div>
    </footer>
  );
}

/* --------------------------------------------------------------------------- */
/* Inline icons                                                                */
/* --------------------------------------------------------------------------- */
type IconProps = { className?: string };
const base = "stroke-current";

function Camera({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" className={base} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.2" className={base} strokeWidth="1.6" />
    </svg>
  );
}
function Tag({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 4h8l8 8-8 8-8-8z" className={base} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" />
    </svg>
  );
}
function Shield({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6z" className={base} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" className={base} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Merge({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M7 4v4c0 3 2 5 5 5h5" className={base} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 10l3 3-3 3" className={base} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 20v-7" className={base} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function Signpost({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 3v18" className={base} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 7h11l3 2.5L16 12H5z" className={base} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function Bell({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 16V10a6 6 0 1112 0v6l2 2H4z" className={base} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 20a2 2 0 004 0" className={base} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function Check({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 12.5l4.5 4.5L19 7" className={base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Trophy({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M7 4h10v4a5 5 0 01-10 0z" className={base} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 5H4v2a3 3 0 003 3M17 5h3v2a3 3 0 01-3 3M10 14h4M9 20h6M12 14v6" className={base} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
