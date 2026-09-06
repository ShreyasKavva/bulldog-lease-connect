/**
 * Q185 — the single shared date formatter for LeaseUp.
 *
 * Rule: on a sublease site the YEAR is always material, so every date we show
 * a student carries one. Same-year ranges print the year once at the end
 * ("Aug 31 – Dec 30, 2026"); cross-year ranges print both
 * ("Aug 24, 2026 – May 14, 2027").
 */

/** Date-only ISO strings must not be shifted by the viewer's timezone. */
export function toDate(iso: string): Date {
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
}

function valid(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = toDate(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Aug 31, 2026" */
export function formatDay(iso: string | null | undefined): string | null {
  const d = valid(iso);
  if (!d) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "Aug 2026" — used where a day would be noise (move-in month, member since). */
export function formatMonth(iso: string | null | undefined): string | null {
  const d = valid(iso);
  if (!d) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function dayNoYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Full range with the year always present.
 * One-sided ranges read "From …" / "Until …" — never a bare "?".
 */
export function formatDateRange(
  from: string | null | undefined,
  to: string | null | undefined,
  opts: { fallback?: string | null } = {},
): string | null {
  const fallback = opts.fallback ?? null;
  const a = valid(from);
  const b = valid(to);
  if (a && b) {
    return a.getFullYear() === b.getFullYear()
      ? `${dayNoYear(a)} – ${dayNoYear(b)}, ${b.getFullYear()}`
      : `${formatDay(from)} – ${formatDay(to)}`;
  }
  if (a) return `From ${formatDay(from)}`;
  if (b) return `Until ${formatDay(to)}`;
  return fallback;
}
