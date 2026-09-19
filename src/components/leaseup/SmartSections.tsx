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
  // Never default to a specific school: no campus known → no "Near" rail.
  const nearCampus = campuses.find((c) => c.id === userCampusId) ?? null;
  const nearLabel = nearCampus ? `Near ${nearCampus.short_name || nearCampus.name}` : "Near your campus";
  const rowProps = { savedIds, onSave, onOpen, filter };

  const sections = [
    nearCampus
      ? {
          key: "near",
          title: nearLabel,
          seeAll: { campus: nearCampus.slug },
          query: { campusId: nearCampus.id, limit: 12 },
        }
      : null,
    {
      // Q102 — "trending" = most-viewed of the last 30 days. minViews keeps the
      // row hidden on a fresh DB instead of listing everything at "0 views".
      key: "trending",
      title: "Trending this week",
      seeAll: { sort: "trending" },
      minItems: 2,
      query: {
        createdAfter: new Date(Date.now() - 30 * 86400000).toISOString(),
        minViews: 1,
        orderBy: "view_count" as const,
        limit: 12,
      },
    },
    {
      key: "new",
      title: "Just posted",
      seeAll: { sort: "newest" },
      query: { limit: 12 },
    },
    {
      key: "cheap",
      title: "Under $600/mo",
      seeAll: { max_price: 600 },
      query: { maxPrice: 600, limit: 12 },
    },
    {
      key: "soon",
      title: "Available this month",
      seeAll: { from: isoDaysFromNow(31) },
      query: {
        availableBefore: isoDaysFromNow(31),
        orderBy: "available_from" as const,
        ascending: true,
        limit: 12,
      },
    },
  ].filter(Boolean) as Array<{
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
  id, title, seeAll, query, divider, minItems, savedIds, onSave, onOpen, filter,
}: RowProps & {
  id: string;
  title: string;
  minItems?: number;
  seeAll: Record<string, unknown>;
  query: Parameters<typeof fetchCuratedListings>[0];
  divider: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["home-section", id, query],
    queryFn: () => fetchCuratedListings(query),
    staleTime: 60_000,
  });

  const items = (data ?? []).filter((l) => (filter ? filter(l) : true));

  if (isLoading) {
    return (
      <section className="mt-10">
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

  if (items.length < (minItems ?? 1)) return null;

  return (
    <section className={cn("mt-10", divider && "border-b border-gray-100 pb-10 dark:border-border")}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link
          to="/browse"
          search={seeAll as never}
          className="shrink-0 text-sm text-gray-500 hover:underline dark:text-muted-foreground"
        >
          See all
        </Link>
      </div>
      <ScrollRow>
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

export function ScrollRow({ children }: { children: React.ReactNode }) {
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
        className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
        "absolute top-[28%] z-10 hidden h-7 w-7 place-items-center rounded-full border border-gray-100 bg-white shadow-md transition hover:scale-105 md:grid dark:border-border dark:bg-surface",
        side === "left" ? "-left-3" : "-right-3",
      )}
    >
      <Icon className="h-4 w-4 text-gray-700 dark:text-foreground" />
    </button>
  );
}
