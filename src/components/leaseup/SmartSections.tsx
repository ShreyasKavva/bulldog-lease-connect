/**
 * SmartSections (Q93) — curated, query-backed homepage rows.
 *
 * Each row runs its own narrow Supabase query (see fetchCuratedListings),
 * renders the shared ListingCard, hides itself when empty, and shows a
 * 4-card skeleton while loading. Category pills from the hero are applied
 * as an extra client-side filter via the optional `filter` prop.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchCuratedListings } from "@/lib/leaseup/queries";
import { useAffinityCampusId } from "@/lib/leaseup/campus-affinity";
import { ListingCard } from "./ListingCard";
import type { Campus } from "@/lib/leaseup/campuses";
import type { Listing } from "@/lib/leaseup/types";


function isoDaysFromNow(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

type RowProps = {
  savedIds: Set<string>;
  onSave: (l: Listing) => void;
  onOpen: (l: Listing) => void;
  filter?: (l: Listing) => boolean;
};

export function SmartSections({
  campuses, userCampusId, savedIds, onSave, onOpen, filter,
}: RowProps & { campuses: Campus[]; userCampusId?: string | null }) {
  /**
   * Q280 — recommendation base. Profile/geo campus is the starting point for a
   * new user; once they keep opening listings at one school, that campus takes
   * over. Never default to a specific school when nothing is known.
   */
  const affinityId = useAffinityCampusId();
  const activeId = (affinityId && campuses.some((c) => c.id === affinityId) ? affinityId : null) ?? userCampusId ?? null;
  const campus = campuses.find((c) => c.id === activeId) ?? null;
  const at = campus ? ` at ${campus.short_name || campus.name}` : "";
  const scope = campus ? { campusId: campus.id } : {};
  const seeAllCampus = campus ? { campus: campus.slug } : {};
  const rowProps = { savedIds, onSave, onOpen, filter };

  const sections = [
    {
      key: "new",
      title: `Just posted${at}`,
      seeAll: { ...seeAllCampus, sort: "newest" },
      query: { ...scope, limit: 12 },
    },
    {
      key: "cheap",
      title: `Under $600/mo${at}`,
      seeAll: { ...seeAllCampus, max_price: 600 },
      query: { ...scope, maxPrice: 600, limit: 12 },
    },
    {
      key: "soon",
      title: `Available this month${at}`,
      // Q486 — the link must describe the window the rail's query actually
      // shows: available from today through today+31 (the same isoDaysFromNow
      // value the query's availableBefore uses). Was `from: +31`, which made
      // "See all" a start-date-31-days-out search and pulled in listings the
      // rail excludes.
      seeAll: { ...seeAllCampus, from: isoDaysFromNow(0), to: isoDaysFromNow(31) },
      query: {
        ...scope,
        availableBefore: isoDaysFromNow(31),
        orderBy: "available_from" as const,
        ascending: true,
        limit: 12,
      },
    },
  ] as Array<{
    key: string;
    title: string;
    minItems?: number;
    seeAll: Record<string, unknown>;
    query: Parameters<typeof fetchCuratedListings>[0];
  }>;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      {sections.map((s, i) => (
        <Section
          key={s.key}
          id={s.key}
          title={s.title}
          fallbackTitle={s.title.replace(at, "")}
          seeAll={s.seeAll}
          query={s.query}
          minItems={s.minItems}
          divider={i < sections.length - 1}
          {...rowProps}
        />
      ))}
    </div>
  );
}

function Section({
  id, title, fallbackTitle, seeAll, query, divider, minItems, savedIds, onSave, onOpen, filter,
}: RowProps & {
  id: string;
  title: string;
  fallbackTitle?: string;
  minItems?: number;
  seeAll: Record<string, unknown>;
  query: Parameters<typeof fetchCuratedListings>[0];
  divider: boolean;
}) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["home-section", id, query],
    staleTime: 60_000,
    queryFn: async () => {
      const rows = await fetchCuratedListings(query);
      // Campus with nothing to show → widen rather than leave a blank homepage.
      if (rows.length === 0 && query.campusId) {
        const { campusId: _drop, ...wide } = query;
        return { rows: await fetchCuratedListings(wide), fellBack: true };
      }
      return { rows, fellBack: false };
    },
  });

  const items = (data?.rows ?? []).filter((l) => (filter ? filter(l) : true));
  const heading = data?.fellBack ? (fallbackTitle ?? title) : title;
  const seeAllSearch = data?.fellBack ? (({ campus: _c, ...rest }) => rest)(seeAll as any) : seeAll;

  if (isLoading) {
    return (
      <section className="mt-10" aria-busy="true" aria-label={`${title} — loading`}>
        <span className="sr-only" role="status">Loading {title.toLowerCase()}…</span>
        <div className="h-6 w-48 animate-pulse rounded-lg bg-gray-100 dark:bg-muted" />
        <div className="mt-4 flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-[260px] shrink-0 sm:w-[280px]">
              <div className="aspect-[4/3] animate-pulse rounded-2xl bg-gray-100 dark:bg-muted" />
              <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-muted" />
              <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-muted" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Q520 — a failed read used to vanish silently; say so and offer a retry.
  if (isError && !data) {
    return (
      <section className="mt-10" aria-labelledby={`home-rail-${id}`}>
        <h2 id={`home-rail-${id}`} className="text-lg font-semibold">{title}</h2>
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-4 text-sm text-foreground">
          <span>We couldn't load these subleases.</span>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="min-h-11 rounded-full bg-[#4F46E5] px-4 text-sm font-semibold text-white hover:bg-[#4338CA] disabled:opacity-60 outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
          >
            {isFetching ? "Retrying…" : "Try again"}
          </button>
        </div>
      </section>
    );
  }

  if (items.length < (minItems ?? 1)) return null;

  return (
    <section aria-labelledby={`home-rail-${id}`} className={cn("mt-10", divider && "border-b border-gray-100 pb-10 dark:border-border")}>
      <div className="flex items-center justify-between gap-4">
        <h2 id={`home-rail-${id}`} className="text-lg font-semibold">{heading}</h2>
        {/* Q478 — 44px tap target on phones (was a 20px-tall text link). */}
        <Link
          to="/browse"
          search={seeAllSearch as never}
          aria-label={`See all: ${heading}`}
          className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded text-sm text-gray-600 hover:underline dark:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
        >
          See all
        </Link>
      </div>
      <ScrollRow label={heading}>
        {items.map((l) => (
          <div key={l.id} className="w-[260px] shrink-0 snap-start sm:w-[280px]">
            <ListingCard
              listing={l}
              saved={savedIds.has(l.id)}
              onSave={() => onSave(l)}
              onOpen={() => onOpen(l)}
            />
          </div>
        ))}
      </ScrollRow>
    </section>
  );
}

export function ScrollRow({ children, label = "Listings" }: { children: React.ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, children]);

  function scrollBy(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 280), behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={measure}
        // Q520 — a named, focusable region: arrow keys scroll it, and Tab
        // moves card to card (the browser scrolls each card into view).
        role="region"
        aria-label={label}
        tabIndex={0}
        className="mt-4 flex snap-x rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2  snap-mandatory gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      {!atStart && (
        <ArrowBtn side="left" onClick={() => scrollBy(-1)} />
      )}
      {!atEnd && (
        <ArrowBtn side="right" onClick={() => scrollBy(1)} />
      )}
    </div>
  );
}

function ArrowBtn({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      className={cn(
        "absolute top-[28%] z-10 hidden h-11 w-11 place-items-center outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 rounded-full border border-gray-100 bg-white shadow-md transition hover:scale-105 md:grid dark:border-border dark:bg-surface",
        side === "left" ? "-left-3" : "-right-3",
      )}
    >
      <Icon className="h-4 w-4 text-gray-700 dark:text-foreground" />
    </button>
  );
}
