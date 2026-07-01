import type { Severity } from "@/lib/api";

/**
 * Small severity tag. High severity carries a clear red alert; medium and low
 * stay quiet so the eye goes to what is dangerous.
 */
export function SeverityTag({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    high: "border-danger/40 bg-danger/10 text-danger",
    medium: "border-line bg-ink text-primary",
    low: "border-line bg-ink text-muted",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-body text-[11px] font-medium uppercase tracking-[0.08em] ${styles[severity]}`}
    >
      {severity}
    </span>
  );
}
