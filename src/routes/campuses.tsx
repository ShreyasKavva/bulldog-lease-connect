/**
 * /campuses — public campus directory (Q79).
 *
 * SEO surface: one indexable page linking to every /sublease/[slug].
 * Data: campus list + a per-campus active listing count map, both cached
 * via TanStack Query. Filter is fully client-side.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCampuses, fetchActiveListingCountsByCampus, searchCampuses, type Campus } from "@/lib/leaseup/campuses";
import { fetchMajorCampuses } from "@/lib/leaseup/major-campuses";
import { Search, School } from "lucide-react";
import { CampusMark, campusInitials } from "@/components/leaseup/CampusMark";
import { campusShortName, campusFullName } from "@/lib/leaseup/campus-name";


export const Route = createFileRoute("/campuses")({
  head: () => ({
    meta: [
      { title: "Find Student Subleases at Your College | LeaseUp" },
      {
        name: "description",
        content:
          "Find or post a student sublease at your college. Every US campus is in the directory; listings grow as students post. Free to post, and you message the lister directly.",
      },
      { property: "og:title", content: "Find Student Subleases at Your College | LeaseUp" },
      {
        property: "og:description",
        content:
          "Find or post a student sublease at your college. Free to post, and you message the lister directly.",
      },
      {
        name: "twitter:description",
        content:
          "Find or post a student sublease at your college. Free to post, and you message the lister directly.",
      },
      { property: "og:url", content: "https://leasup.co/campuses" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://leasup.co/campuses" }],
  }),
  component: CampusDirectoryPage,
});

function CampusDirectoryPage() {
  const { data: campuses = [], isLoading } = useQuery({
    queryKey: ["campuses"],
    queryFn: fetchCampuses,
    staleTime: 5 * 60 * 1000,
  });
  const { data: counts = {} } = useQuery({
    queryKey: ["active-listing-counts-by-campus"],
    queryFn: fetchActiveListingCountsByCampus,
    staleTime: 60 * 1000,
  });

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 200);
    return () => window.clearTimeout(t);
  }, [query]);

  // Q179 — the grid shows campuses with live inventory; typing searches every
  // accredited US school server-side so nobody hits a dead end.
  const { data: searchResults = [], isFetching } = useQuery({
    queryKey: ["campus-search", debounced.trim().toLowerCase(), "directory"],
    queryFn: () => searchCampuses(debounced, 30),
    enabled: debounced.trim().length > 0,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  // Q279 — the browsable set of major US schools, shown under the campuses
  // that already have subleases so the directory isn't a dozen cards long.
  const { data: majors = [] } = useQuery({
    queryKey: ["major-campuses"],
    queryFn: fetchMajorCampuses,
    staleTime: 10 * 60 * 1000,
  });

  const sorted = useMemo(() => {
    const base = debounced.trim() ? searchResults : campuses;
    return [...base].sort((a, b) => {
      const ca = counts[a.id] ?? a.listing_count ?? 0;
      const cb = counts[b.id] ?? b.listing_count ?? 0;
      if (cb !== ca) return cb - ca;
      return a.name.localeCompare(b.name);
    });
  }, [campuses, searchResults, counts, debounced]);

  // Only the schools that aren't already in the grid above, alphabetical.
  // Rendered in chunks so ~3,900 cards don't all mount at once.
  const CHUNK = 300;
  const [visibleCount, setVisibleCount] = useState(CHUNK);
  const moreSchools = useMemo(() => {
    if (debounced.trim()) return [];
    const shown = new Set(sorted.map((c) => c.id));
    return majors.filter((c) => !shown.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [majors, sorted, debounced]);
  const visibleSchools = moreSchools.slice(0, visibleCount);

  const total = campuses.length;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <header className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Find subleases at your school
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            LeaseUp is live at {total || "dozens of"} colleges — and searchable at every
            accredited US school. Free to post, and you message the lister directly.
          </p>
          <div className="relative mt-6">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your school…"
              className="h-12 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-sm outline-none focus:border-primary"
              aria-label="Search campuses"
            />
          </div>
        </header>

        {isLoading || (debounced.trim() && isFetching && sorted.length === 0) ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-surface" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="mx-auto mt-14 max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
            <School className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No campuses found for <span className="font-semibold text-foreground">"{query}"</span>.
            </p>
            <p className="mt-1 text-sm">
              Is your school not listed?{" "}
              <Link to="/ambassador" className="font-semibold text-primary hover:underline">
                Apply to bring LeaseUp to your campus →
              </Link>
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((c) => (
              <CampusCard key={c.id} campus={c} count={counts[c.id] ?? 0} />
            ))}
          </div>
        )}

        {visibleSchools.length > 0 && (
          <section className="mt-14">
            <h2 className="text-lg font-black tracking-tight sm:text-xl">
              More schools on LeaseUp
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every US school in our directory — four-year universities and community colleges. Be
              the first to list at yours.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleSchools.map((c) => (
                <CampusCard key={c.id} campus={c} count={counts[c.id] ?? 0} />
              ))}
            </div>
            {visibleCount < moreSchools.length && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + CHUNK)}
                  className="rounded-full border border-border bg-surface px-6 py-2.5 text-sm font-semibold text-primary transition hover:border-primary hover:shadow-card"
                >
                  Show more schools ({(moreSchools.length - visibleCount).toLocaleString("en-US")} remaining)
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function CampusCard({ campus: c, count }: { campus: Campus; count: number }) {
  const has = count > 0;
  // Q500 — the row always leads with the full readable name (CSS-clamped,
  // full text in a title), never the bare acronym or a sliced "…" string.
  // The short name is a secondary label only when it adds something: not a
  // repeat of the full name, not the badge's initials, not a truncation.
  const full = campusFullName(c);
  const short = campusShortName(c);
  const norm = (t: string) => t.replace(/[^a-z0-9]/gi, "").toUpperCase();
  const secondary =
    short &&
    !short.endsWith("…") &&
    norm(short) !== norm(full) &&
    norm(short) !== norm(campusInitials(c)) &&
    !norm(full).startsWith(norm(short))
      ? short
      : null;
  return (
    <Link
      to="/sublease/$slug"
      params={{ slug: c.slug }}
      className="group flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-card"
    >
      <div>
        <div className="flex items-start gap-3">
          <CampusMark campus={c} className="h-11 w-11 text-xs" />
          <div className="min-w-0">
            <div title={full} className="line-clamp-2 break-words text-base font-bold text-foreground group-hover:text-primary">
              {full}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {c.city}
              {c.state ? `, ${c.state}` : ""}
              {secondary ? ` · ${secondary}` : null}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`inline-block h-2 w-2 rounded-full ${has ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
            aria-hidden
          />
          <span className={has ? "font-semibold text-foreground" : "text-muted-foreground"}>
            {has ? `${count} listing${count === 1 ? "" : "s"}` : "No listings yet"}
          </span>
        </div>
        <span className="text-xs font-semibold text-primary group-hover:underline">
          {has ? `Browse ${secondary ?? "listings"} →` : "Be the first →"}
        </span>
      </div>
    </Link>
  );
}
