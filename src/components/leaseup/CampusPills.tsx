/**
 * CampusPills — horizontal row of clickable campus chips shown on the
 * homepage below the main feed (Q79). Sorted by active listing count.
 *
 * Fails gracefully: any fetch error or unexpected data shape returns null
 * rather than throwing — the homepage must never crash because of this
 * secondary discovery section.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchCampuses, fetchActiveListingCountsByCampus } from "@/lib/leaseup/campuses";
import { setLastCampusSlug, useLastCampusSlug } from "@/lib/leaseup/last-campus";
import { ArrowRight } from "lucide-react";

export function CampusPills({
  title,
  slugs,
  highlightLast,
}: {
  title?: string;
  /** Q140 — explicit campus slug order (overrides count sort, no cap). */
  slugs?: string[];
  /** Q148 — visually mark the campus remembered in localStorage. */
  highlightLast?: boolean;
} = {}) {
  const lastSlug = useLastCampusSlug();

  const campusesQ = useQuery({
    queryKey: ["campuses"],
    queryFn: fetchCampuses,
    staleTime: 5 * 60 * 1000,
  });
  const countsQ = useQuery({
    queryKey: ["active-listing-counts-by-campus"],
    queryFn: fetchActiveListingCountsByCampus,
    staleTime: 60 * 1000,
  });

  // Defensive: never throw from render. If either query errored or returned
  // an unexpected shape, just render nothing.
  if (campusesQ.isError || countsQ.isError) return null;

  const campuses = Array.isArray(campusesQ.data) ? campusesQ.data : [];
  const counts: Record<string, number> =
    countsQ.data && typeof countsQ.data === "object" ? countsQ.data : {};

  if (campuses.length === 0) return null;

  const valid = [...campuses].filter(
    (c) => c && typeof c.id === "string" && typeof c.slug === "string",
  );
  const ordered = slugs
    ? slugs.map((s) => valid.find((c) => c.slug === s)).filter(Boolean) as typeof valid
    : valid.sort((a, b) => {
        const ca = counts[a.id] ?? 0;
        const cb = counts[b.id] ?? 0;
        if (cb !== ca) return cb - ca;
        return (a.name ?? "").localeCompare(b.name ?? "");
      });
  const visible = slugs ? ordered : ordered.slice(0, 8);
  if (visible.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-black sm:text-xl">
          {title ?? `LeaseUp is live at ${campuses.length} schools`}
        </h2>
        <Link
          to="/campuses"
          className="text-sm font-semibold text-primary hover:underline"
        >
          View all campuses →
        </Link>
      </div>
      {/* Q184 — no negative-margin bleed: it made the first pill start
          clipped at scrollLeft 0 on some widths. Plain edge-aligned rail. */}
      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.map((c) => {
          const n = counts[c.id] ?? 0;
          const label = c.short_name || c.name || "Campus";
          const isLast = !!highlightLast && lastSlug === c.slug;
          return (
            <Link
              key={c.id}
              to="/campus/$slug"
              params={{ slug: c.slug }}
              onClick={() => setLastCampusSlug(c.slug)}
              aria-disabled={n === 0 || undefined}
              aria-current={isLast ? "true" : undefined}
              tabIndex={n === 0 ? -1 : undefined}
              className={`group flex shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary ${
                isLast
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-foreground"
              } ${n === 0 ? "pointer-events-none opacity-60" : ""}`}
            >

              <span>{label}</span>
              <span
                className={`text-xs font-medium ${n > 0 ? "text-emerald-600" : "text-muted-foreground"}`}
              >
                {n > 0 ? `${n} live` : "New"}
              </span>
              <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
