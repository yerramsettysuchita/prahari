"use client";

import { usePathname } from "next/navigation";
import { LiveIndicator } from "./LiveIndicator";

const LINKS = [
  { href: "/dashboard", label: "Command Center" },
  { href: "/scoreboard", label: "Scoreboard" },
];

/** Shared top navigation: a large display brand on its own line, with the page
 * links sitting on a separate row beneath, evenly spaced. */
export function Nav() {
  const pathname = usePathname();
  return (
    <header>
      {/* Brand row */}
      <div className="flex items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          {/* Brand mark: a quiet amber tick */}
          <span className="h-7 w-[3px] rounded-full bg-accent md:h-8" />
          <span className="font-display text-3xl font-semibold tracking-tightish text-primary md:text-4xl">
            Prahari
          </span>
        </a>
        <LiveIndicator />
      </div>

      {/* Page links row, on the divider line */}
      <nav className="mt-8 flex items-center gap-10 border-b border-line md:mt-10">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <a
              key={l.href}
              href={l.href}
              className={`group relative -mb-px border-b-2 pb-3 font-body text-sm font-medium transition-colors ${
                active
                  ? "border-accent text-primary"
                  : "border-transparent text-muted hover:text-primary"
              }`}
            >
              {l.label}
            </a>
          );
        })}
        {/* City scope, right-aligned on the same divider row */}
        <span className="ml-auto pb-3 font-body text-xs uppercase tracking-[0.16em] text-muted">
          Bengaluru
        </span>
      </nav>
    </header>
  );
}
