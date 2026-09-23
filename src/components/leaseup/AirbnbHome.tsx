/**
 * Airbnb-style public homepage.
 *
 * Structure (top → bottom):
 *   1. Minimal top bar (auth controls only)
 *   2. Hero — centered wordmark + big search pill + subtitle
 *   3. Category filter strip (horizontal scroll)
 *   4. Three listing rails: Near Campus · Best Deals · Just Posted
 *   5. Campus spotlights (2×2 grid)
 *   6. Blue CTA strip ("Got a sublease to post?")
 *   7. Footer
 *
 * Everyone (guest + logged-in) sees this exact page. Auth is only required
 * for save / message / post — those actions call the callbacks passed in
 * from src/routes/index.tsx which route to /auth?next=... .
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { fetchCampusListingCounts, publicLocationLabel } from "@/lib/leaseup/queries";
import { campusShortName } from "@/lib/leaseup/campus-name";
import { Link, useNavigate } from "@tanstack/react-router";
import { MapPin, Flame, Sparkles, ArrowRight, Search, SlidersHorizontal, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import type { Listing, LookingForPost } from "@/lib/leaseup/types";
import type { Campus } from "@/lib/leaseup/campuses";
import { SearchPill, EMPTY_SEARCH, type SearchState } from "./SearchPill";
import { buildBrowseSearch } from "@/lib/leaseup/search-params";
import { ListingRail } from "./ListingRail";
import { ListingCard } from "./ListingCard";
import { ListingCardSkeletonRow } from "./ListingCardSkeleton";
import { SmartSections, ScrollRow } from "./SmartSections";
import { cn } from "@/lib/utils";
import { CampusMark } from "@/components/leaseup/CampusMark";
import { useLastCampusSlug } from "@/lib/leaseup/last-campus";
import { useRecentViews } from "@/lib/leaseup/recent-views";

/** Q279 — the "Recently viewed" rail appears only after 4 listings viewed. */
const RECENT_RAIL_MIN = 4;
const PRICE_CEILING = 3000;
const PRICE_BUCKETS = 24;
import { useNearestCampus } from "@/lib/leaseup/use-nearest-campus";

import { openSignIn } from "./SignInModal";
import { CountUp } from "./CountUp";
import { useSession } from "@/lib/leaseup/use-session";
import { posterName, posterFirstName, profileDisplayName } from "@/lib/leaseup/display-name";
import { UserAvatar } from "@/components/leaseup/UserAvatar";


type Cat =
  | "all" | "near-campus" | "furnished" | "studio"
  | "private-room" | "short-term" | "best-deals" | "new-today";

const CATEGORIES: { k: Cat; label: string; emoji: string }[] = [
  { k: "all", label: "All", emoji: "🏠" },
  { k: "near-campus", label: "Near Campus", emoji: "📍" },
  { k: "furnished", label: "Furnished", emoji: "🛋️" },
  { k: "studio", label: "Studio", emoji: "🏢" },
  { k: "private-room", label: "Private Room", emoji: "🛏" },
  { k: "short-term", label: "Short-term", emoji: "🌿" },
  { k: "best-deals", label: "Best Deal", emoji: "💰" },
  { k: "new-today", label: "New Today", emoji: "🆕" },
];

// Emoji mascots for campus spotlights (falls back to 🎓)

function matchesCategory(l: Listing, cat: Cat, medianForCampusBeds: (id: string, beds: number) => number | null): boolean {
  if (cat === "all") return true;
  const now = Date.now();
  const ageMs = now - new Date(l.created_at).getTime();
  const area = (l.area ?? "").toLowerCase();
  switch (cat) {
    case "near-campus":
      return /campus|near|walking|walk to/.test(area);
    case "best-deals": {
      const median = medianForCampusBeds(l.campus_id, l.beds);
      return median !== null ? l.price <= median : false;
    }
    case "new-today":
      return ageMs < 1000 * 60 * 60 * 24;
    case "furnished":
      return !!l.furnished;
    case "studio":
      return l.beds === 0;
    case "short-term": {
      if (!l.available_from || !l.available_to) return false;
      const span = new Date(l.available_to).getTime() - new Date(l.available_from).getTime();
      return span > 0 && span <= 1000 * 60 * 60 * 24 * 120;
    }
    case "private-room":
      return l.beds === 1;
  }
}


export function AirbnbHome({
  listings, campuses, savedIds, onSave, onOpen, onPost,
  userCampusId, feedCampusId, lookingForPosts, recentFilledCount, loading,
}: {
  listings: Listing[];
  campuses: Campus[];
  savedIds: Set<string>;
  onSave: (l: Listing) => void;
  onOpen: (l: Listing) => void;
  onMessage: (l: Listing) => void;
  onPost: () => void;
  userCampusId?: string | null;
  feedCampusId?: string | null;
  lookingForPosts?: LookingForPost[];
  recentFilledCount?: number;
  loading?: boolean;
}) {
  const navigate = useNavigate();
  /** Q170 — guest-only onboarding CTA. */
  const { user: sessionUser } = useSession();
  const railsRef = useRef<HTMLDivElement>(null);
  /**
   * Q185 — the category pills only filter the listing rails, so they stop
   * sticking to the nav once the rails have scrolled past.
   */
  const [pastRails, setPastRails] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const el = railsRef.current;
      if (!el) return;
      setPastRails(el.getBoundingClientRect().bottom < 80);
    };
    onScroll();
    // The app scrolls <body>, not the window, so listen in the capture phase.
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);


  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [cat, setCat] = useState<Cat>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, PRICE_CEILING]);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  /** Label for a category, with "Near Campus" personalised to the user's school. */
  const catLabel = (k: Cat): string => {
    const c = CATEGORIES.find((x) => x.k === k);
    if (k === "near-campus" && userCampusId) {
      const myCampus = campuses.find((c2) => c2.id === userCampusId);
      if (myCampus) return `Near ${myCampus.short_name || myCampus.name}`;
    }
    return c?.label ?? "All";
  };

  /**
   * Q177 — when we don't know the visitor's campus, ask the browser where they
   * are and personalise around the closest campus instead of a random one.
   */
  const recentIds = useRecentViews();
  const geoCampus = useNearestCampus(campuses, !userCampusId && recentIds.length < 2);
  const homeCampusId = userCampusId ?? geoCampus?.id ?? feedCampusId ?? null;

  /**
   * Q210 — "Near you" and SmartSections' "Near <campus>" row both resolve to
   * the visitor's campus, so on a first visit they rendered the same listings
   * twice in adjacent rails. Suppress "Near you" when it would duplicate; the
   * SmartSections row is strictly richer (12 cards plus a See all link).
   */
  const nearYouCampus = geoCampus ?? campuses.find((c) => c.id === userCampusId) ?? null;
  const nearYouIsDuplicate = !!nearYouCampus && nearYouCampus.id === (search.campusId ?? homeCampusId);



  // Median price per (campus, beds) for the Best Deals filter/badge.
  const priceMedian = useMemo(() => {
    const buckets = new Map<string, number[]>();
    for (const l of listings) {
      const k = `${l.campus_id}:${l.beds}`;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(l.price);
    }
    const out = new Map<string, number>();
    for (const [k, arr] of buckets) {
      arr.sort((a, b) => a - b);
      out.set(k, arr[Math.floor(arr.length / 2)]);
    }
    return out;
  }, [listings]);
  const medianFor = (campusId: string, beds: number) => priceMedian.get(`${campusId}:${beds}`) ?? null;

  // Search filter (Where / dates / guests) — applied before category filter.
  const searched = useMemo(() => {
    return listings.filter((l) => {
      if (search.campusId && l.campus_id !== search.campusId) return false;
      if (!search.campusId && search.where.trim()) {
        const q = search.where.toLowerCase();
        if (!(`${l.title} ${l.area ?? ""}`.toLowerCase().includes(q))) return false;
      }
      if (search.guests > 1 && l.beds < Math.ceil(search.guests / 2)) return false;
      if (search.from && l.available_to && new Date(l.available_to) < search.from) return false;
      if (search.to && l.available_from && new Date(l.available_from) > search.to) return false;
      return true;
    });
  }, [listings, search]);

  const categoryMatches = useMemo(
    () => searched.filter((l) => matchesCategory(l, cat, medianFor)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searched, cat, priceMedian],
  );

  const priceIsActive = priceRange[0] > 0 || priceRange[1] < PRICE_CEILING;
  const inCat = useMemo(
    () => categoryMatches.filter((l) =>
      l.price >= priceRange[0] && (priceRange[1] >= PRICE_CEILING || l.price <= priceRange[1]),
    ),
    [categoryMatches, priceRange],
  );
  const priceHistogram = useMemo(() => {
    const buckets = Array.from({ length: PRICE_BUCKETS }, () => 0);
    for (const listing of categoryMatches) {
      const index = Math.min(
        PRICE_BUCKETS - 1,
        Math.floor((Math.max(0, listing.price) / PRICE_CEILING) * PRICE_BUCKETS),
      );
      buckets[index] += 1;
    }
    return buckets;
  }, [categoryMatches]);
  const tallestPriceBucket = Math.max(1, ...priceHistogram);

  // Rails
  const nearCampus = useMemo(() => {
    const scoped = search.campusId ? inCat.filter((l) => l.campus_id === search.campusId) : inCat;
    const hits = scoped.filter((l) => /campus|near|walking|walk to/.test((l.area ?? "").toLowerCase()));
    return (hits.length >= 4 ? hits : scoped).slice(0, 8);
  }, [inCat, search.campusId]);

  const bestDeals = useMemo(() => {
    const withMedian = inCat
      .map((l) => ({ l, m: medianFor(l.campus_id, l.beds) }))
      .filter(({ l, m }) => m !== null && l.price <= m!)
      .map(({ l }) => l);
    const source = withMedian.length >= 4
      ? withMedian
      : [...inCat].sort((a, b) => a.price - b.price);
    return source.slice(0, 8);
  }, [inCat, priceMedian]); // eslint-disable-line react-hooks/exhaustive-deps

  const justPosted = useMemo(
    () => [...inCat].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ).slice(0, 8),
    [inCat],
  );

  // Q105 — live campus counts straight from the DB (not just the loaded page
  // of listings), so "Explore campuses" never shows a stale number.
  const { data: dbCampusCounts } = useQuery({
    queryKey: ["campus-listing-counts"],
    queryFn: fetchCampusListingCounts,
    staleTime: 60_000,
  });
  const campusCounts = useMemo(() => {
    if (dbCampusCounts && dbCampusCounts.size) return dbCampusCounts;
    const m = new Map<string, number>();
    for (const l of listings) m.set(l.campus_id, (m.get(l.campus_id) ?? 0) + 1);
    return m;
  }, [dbCampusCounts, listings]);

  const campusCount = useMemo(() => {
    let n = 0;
    for (const c of campusCounts.values()) if (c > 0) n++;
    return n;
  }, [campusCounts]);


  const spotlightCampuses = useMemo(() => {
    // Q139 — show up to 12 campuses (3x4 on desktop, 2x6 on mobile). Campuses
    // with live listings rank first by count; the rest render "New".
    return [...campuses]
      .sort((a, b) => {
        const ca = campusCounts.get(a.id) ?? 0;
        const cb = campusCounts.get(b.id) ?? 0;
        if (cb !== ca) return cb - ca;
        return (a.name ?? "").localeCompare(b.name ?? "");
      })
      .slice(0, 16);
  }, [campuses, campusCounts]);




  function runSearch() {
    // If the user typed a campus name but never picked from the dropdown,
    // resolve it here so the search button always applies a real filter.
    let state = search;
    if (!state.campusId && state.where.trim()) {
      const q = state.where.trim().toLowerCase();
      const hit =
        campuses.find((c) => (c.short_name ?? "").toLowerCase() === q) ??
        campuses.find((c) => c.name.toLowerCase() === q) ??
        campuses.find(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.short_name ?? "").toLowerCase().includes(q) ||
            c.city.toLowerCase().includes(q),
        );
      if (hit) state = { ...state, campusId: hit.id, where: hit.short_name ?? hit.name };
    }
    // Q177 — searching always lands on /browse. When we know the campus we open
    // the map centered on it (Airbnb-style), with the filter chips on top.
    const picked = state.campusId ? campuses.find((c) => c.id === state.campusId) : null;
    navigate({
      to: "/browse",
      search: {
        ...(buildBrowseSearch(state) as Record<string, unknown>),
        ...(picked ? { view: "map" } : {}),
      } as any,
    });
  }


  function pickCategory(k: Cat) {
    if (k === "near-campus") {
      // "Near Campus" means near YOUR campus — which every account sets during
      // onboarding. Signed out → sign in; signed in without one → onboarding.
      if (!sessionUser) { openSignIn("/onboarding"); return; }
      if (!userCampusId) { navigate({ to: "/onboarding" }); return; }
      setCat(k);
      const mine = campuses.find((c) => c.id === userCampusId);
      setSearch((current) => ({
        ...current,
        campusId: userCampusId,
        where: mine?.short_name ?? mine?.name ?? current.where,
      }));
      return;
    }
    setCat(k);
    if (k === "all") {
      setSearch(EMPTY_SEARCH);
      return;
    }
  }

  const chipLabel = [
    search.where.trim() || "Anywhere",
    search.from
      ? `${search.from.toLocaleDateString(undefined, { month: "short", day: "numeric" })}${search.to ? ` – ${search.to.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}`
      : "Any dates",
    search.guests <= 1 ? "1 student" : `${search.guests} students`,
  ].join(" · ");

  return (
    <div className="min-h-screen bg-white dark:bg-background">
      {/* HERO — search first */}
      <section className="bg-white py-12 dark:bg-background">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h1 className="mt-4 text-4xl font-bold text-gray-900 dark:text-foreground">
            Sublease near your campus.
          </h1>
          <p className="mt-3 text-xl text-gray-500 dark:text-muted-foreground">
            Campus subleases. Semester-ready dates. No Craigslist drama.
          </p>
        </div>

        {/* Desktop / tablet: full Where · When · Who bar */}
        <div className="mx-auto mt-8 hidden max-w-3xl px-4 sm:block sm:px-6">
          <SearchPill value={search} onChange={setSearch} onSearch={runSearch} />
        </div>

        {/* Mobile: compact chip that expands into the search panel */}
        <div className="mx-auto mt-6 max-w-3xl px-4 sm:hidden">
          {mobileSearchOpen ? (
            <div className="rounded-3xl border border-gray-100 bg-white p-3 shadow-xl dark:border-border dark:bg-surface">
              <SearchPill
                value={search}
                onChange={setSearch}
                onSearch={() => { setMobileSearchOpen(false); runSearch(); }}
              />
              <button
                onClick={() => setMobileSearchOpen(false)}
                className="mt-2 w-full py-2 text-xs font-semibold text-muted-foreground"
              >
                Close
              </button>
            </div>
          ) : (
            <button
              onClick={() => setMobileSearchOpen(true)}
              className="flex w-full items-center gap-2 rounded-full border border-gray-100 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-xl dark:border-border dark:bg-surface dark:text-foreground"
            >
              <Search className="h-4 w-4 shrink-0 text-gray-500" />
              <span className="truncate">{chipLabel}</span>
            </button>
          )}
        </div>


        <LiveCounter />
      </section>

      {/* (Removed large dark "Got a sublease to post?" CTA — duplicate of the
          thin yellow HomeSmartBanner below. Keep nav button + yellow banner.) */}




      {/* Q174 — removed the signed-in "views total" smart banner */}


      {/* Q110 Part C — signed-out welcome strip (tablet+) */}
      <GuestWelcomeStrip />


      {/* CATEGORY FILTER — single Filters button on the right; the pills live
          inside its popover instead of sprawling across the page. */}
      <div className={cn("z-50 border-b border-gray-200 bg-white dark:bg-surface", pastRails ? "relative" : "sticky top-14")}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="truncate text-lg font-bold text-foreground">
            {cat === "all" ? "Subleases" : catLabel(cat)}
          </span>
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Filters"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition",
                  cat !== "all" || priceIsActive
                    ? "border-gray-900 bg-gray-900 font-semibold text-white dark:border-foreground dark:bg-foreground dark:text-background"
                    : "border-gray-200 bg-white font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-surface dark:text-foreground",
                )}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                {cat === "all" && !priceIsActive ? "Filters" : "Filters · Active"}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={10} className="w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-2xl p-0 shadow-card-lg">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-base font-bold text-foreground">Filters</h2>
              </div>

              <div className="max-h-[65vh] overflow-y-auto px-5 py-5">
                <section>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-foreground">Monthly price</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {inCat.length > 0
                          ? `${inCat.length} sublease${inCat.length === 1 ? "" : "s"} in this range`
                          : "No subleases in this range"}
                      </p>
                    </div>
                    {priceIsActive && (
                      <button
                        type="button"
                        onClick={() => setPriceRange([0, PRICE_CEILING])}
                        className="shrink-0 text-sm font-semibold text-foreground underline underline-offset-4"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  <div className="mt-5 flex h-20 items-end gap-0.5" aria-hidden="true">
                    {priceHistogram.map((count, index) => {
                      const bucketMin = (index / PRICE_BUCKETS) * PRICE_CEILING;
                      const bucketMax = ((index + 1) / PRICE_BUCKETS) * PRICE_CEILING;
                      const selected = bucketMax >= priceRange[0] && bucketMin <= priceRange[1];
                      return (
                        <span
                          key={index}
                          className={cn("min-h-1 flex-1 rounded-t-sm", selected ? "bg-foreground" : "bg-border")}
                          style={{ height: `${Math.max(5, (count / tallestPriceBucket) * 100)}%` }}
                        />
                      );
                    })}
                  </div>
                  <Slider
                    className="-mt-0.5"
                    value={priceRange}
                    min={0}
                    max={PRICE_CEILING}
                    step={50}
                    minStepsBetweenThumbs={1}
                    onValueChange={(value) => setPriceRange([value[0] ?? 0, value[1] ?? PRICE_CEILING])}
                    aria-label="Monthly price range"
                  />
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border px-3 py-2">
                      <span className="block text-xs text-muted-foreground">Minimum</span>
                      <span className="text-sm font-semibold text-foreground">${priceRange[0].toLocaleString()}</span>
                    </div>
                    <div className="rounded-xl border border-border px-3 py-2">
                      <span className="block text-xs text-muted-foreground">Maximum</span>
                      <span className="text-sm font-semibold text-foreground">
                        {priceRange[1] >= PRICE_CEILING ? `$${PRICE_CEILING.toLocaleString()}+` : `$${priceRange[1].toLocaleString()}`}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="mt-6 border-t border-border pt-5">
                  <h3 className="mb-3 font-bold text-foreground">Type of place</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(({ k, label: baseLabel, emoji }) => {
                      const active = cat === k;
                      const myCampus = k === "near-campus" && userCampusId
                        ? campuses.find((c) => c.id === userCampusId)
                        : null;
                      const label = myCampus ? `Near ${myCampus.short_name || myCampus.name}` : baseLabel;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => pickCategory(k)}
                          className={cn(
                            "grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition",
                            active
                              ? "border-foreground bg-foreground font-semibold text-background"
                              : "border-border font-medium text-foreground hover:border-foreground",
                          )}
                        >
                          <span aria-hidden>{emoji}</span>
                          <span className="min-w-0 truncate">{label}</span>
                          {active && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-t border-border p-4">
                <button
                  type="button"
                  onClick={() => { pickCategory("all"); setPriceRange([0, PRICE_CEILING]); }}
                  className="min-h-11 px-2 text-sm font-semibold text-foreground underline underline-offset-4"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="min-h-11 rounded-lg bg-foreground px-4 text-sm font-bold text-background"
                >
                  {inCat.length > 0
                    ? `Show ${inCat.length} sublease${inCat.length === 1 ? "" : "s"}`
                    : "Adjust filters"}
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Q167 — "Listed today" rail */}
      {!loading && (() => {
        const today = new Date().toISOString().slice(0, 10);
        const visibleIds = new Set(inCat.map((listing) => listing.id));
        const todayListings = listings
          .filter((l) => String(l.created_at ?? "").slice(0, 10) >= today)
          .filter((l) => !search.campusId || l.campus_id === search.campusId)
          .filter((l) => visibleIds.has(l.id))
          .slice(0, 6);
        if (todayListings.length < 2) return null;
        return (
          <section className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 className="mb-2 mt-4 text-base font-semibold text-gray-800 dark:text-foreground">🆕 Listed today</h2>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              {todayListings.map((l) => {
                const c = campuses.find((x) => x.id === l.campus_id);
                return (
                  <div
                    key={l.id}
                    onClick={() => onOpen(l)}
                    className="relative w-40 flex-shrink-0 cursor-pointer overflow-hidden rounded-xl border border-gray-100 bg-white transition hover:shadow-md dark:border-border dark:bg-surface sm:w-44"
                  >
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] text-white">Today</span>
                    {l.photo_urls?.[0] ? (
                      <img src={l.photo_urls[0]} alt={l.title} className="h-24 w-full object-cover" />
                    ) : (
                      <div className="grid h-24 w-full place-items-center bg-gray-100 text-2xl dark:bg-muted">🏠</div>
                    )}
                    <div className="px-2 py-1.5">
                      <div className="text-sm font-bold">${l.price}/mo</div>
                      <div className="truncate text-xs text-gray-400">{c?.short_name ?? c?.name ?? "Near campus"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}



      {/* Q165 — smart results summary (only with an active filter) */}
      {!loading &&
        (cat !== "all" || priceIsActive || !!search.campusId || !!search.where.trim() || search.guests > 1) && (
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            {inCat.length === 0 ? (
              <p className="mb-2 px-1 text-sm text-gray-400">
                No subleases found — try adjusting your filters
              </p>
            ) : (
            <p className="mb-2 px-1 text-sm text-gray-500">
              {`Showing ${inCat.length} sublease${inCat.length !== 1 ? "s" : ""}`}
              {inCat.length > 1
                ? ` · avg $${Math.round(
                    inCat.reduce((s, l) => s + (l.price ?? 0), 0) / inCat.length,
                  ).toLocaleString()}/mo`
                : ""}
              {search.campusId
                ? ` near ${
                    campuses.find((c) => c.id === search.campusId)?.short_name ??
                    campuses.find((c) => c.id === search.campusId)?.name ??
                    ""
                  }`
                : ""}
            </p>
            )}
          </div>
        )}





      {/* Q114 — skeleton rails while the listings query is loading */}
      {loading ? (
        <>
          {["New this week", "Just listed"].map((heading) => (
            <section key={heading} className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-foreground">{heading}</h2>
              <ListingCardSkeletonRow count={4} />
            </section>
          ))}
        </>
      ) : (
        <>
          {/* Q279 — once a visitor has viewed 4+ listings, "Recently viewed"
              is always the first rail on the homepage. */}
          {recentIds.length >= RECENT_RAIL_MIN && (
            <RecentlyViewedSection
              savedIds={savedIds}
              onSave={onSave}
              onOpen={onOpen}
              filter={(listing) =>
                matchesCategory(listing, cat, medianFor) &&
                listing.price >= priceRange[0] &&
                (priceRange[1] >= PRICE_CEILING || listing.price <= priceRange[1])
              }
            />
          )}
          {/* Q177 — "Near you", based on campus/location */}
          <NearYouSection
            listings={inCat}
            campus={nearYouIsDuplicate ? null : nearYouCampus}
            savedIds={savedIds}
            onSave={onSave}
            onOpen={onOpen}
          />
          {/* Q111 — "New this week" (hidden unless 3+ fresh listings) */}
          <NewThisWeekSection
            listings={inCat}
            campuses={campuses}
            savedIds={savedIds}
            onSave={onSave}
            onOpen={onOpen}
          />
        </>
      )}

      {/* Q148 — featured listing hero card, scoped to the visitor's campus */}
      {!loading && (
        <FeaturedListingCard
          listings={inCat}
          campuses={campuses}
          onOpen={onOpen}
          campusId={search.campusId ?? userCampusId ?? geoCampus?.id ?? null}
        />
      )}


      {/* SMART SECTIONS (Q93) — curated, query-backed rows */}
      <div ref={railsRef} className="scroll-mt-20">
        {!loading && (
          <SmartSections
            campuses={campuses}
            userCampusId={search.campusId ?? userCampusId ?? geoCampus?.id ?? null}

            savedIds={savedIds}
            onSave={onSave}
            onOpen={onOpen}
            filter={(l: Listing) =>
              matchesCategory(l, cat, medianFor) &&
              l.price >= priceRange[0] &&
              (priceRange[1] >= PRICE_CEILING || l.price <= priceRange[1])
            }
          />
        )}

        {!loading && inCat.length === 0 && (
          <div className="mx-auto max-w-md px-6 py-16 text-center">
            <div className="text-6xl">🏠</div>
            <h2 className="mt-4 text-xl font-bold">No listings with these filters</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Try changing the price range or type of place.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => navigate({ to: "/post" })}
                className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
              >Post a sublease →</button>
              <button
                onClick={() => { setSearch(EMPTY_SEARCH); setCat("all"); setPriceRange([0, PRICE_CEILING]); }}
                className="rounded-full bg-foreground px-5 py-2 text-sm font-bold text-background hover:opacity-90"
              >Clear filters</button>
            </div>
          </div>
        )}
      </div>




      {/* ROOMMATE SEARCH STRIP (Q66) */}
      <LookingForStrip posts={lookingForPosts ?? []} />



      {/* CAMPUS SPOTLIGHTS */}
      <section className="mx-auto mt-10 max-w-7xl px-4 sm:px-6">
        <h2 className="mb-4 text-xl font-extrabold sm:text-2xl">Explore campuses</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {spotlightCampuses.map((c) => {
            const count = campusCounts.get(c.id) ?? 0;
            return (
              <Link
                key={c.id}
                to="/sublease/$slug"
                params={{ slug: c.slug }}
                className="group flex items-center gap-3 rounded-2xl bg-gray-50 p-4 transition hover:bg-gray-100 sm:gap-4 sm:p-5 dark:bg-background dark:hover:bg-background/70"
              >
                <CampusMark campus={c} className="h-11 w-11 text-xs shadow-sm sm:h-14 sm:w-14 sm:text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold leading-tight sm:text-base">{campusShortName(c)}</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="sm:hidden">{c.state}</span>
                    <span className="hidden sm:inline">{c.city}, {c.state}</span>
                  </div>
                  <div className={`mt-1 text-xs font-semibold ${count > 0 ? "text-primary" : "text-muted-foreground"}`}>
                    {count > 0 ? `${count} listing${count === 1 ? "" : "s"}` : "Be the first"}
                  </div>
                </div>
                <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground sm:block" />

              </Link>
            );
          })}
        </div>
      </section>

      {/* Q170 — guest onboarding CTA (signed-out visitors only) */}
      {!sessionUser && (
        <section className="mx-auto mt-10 max-w-7xl px-4 sm:px-6">
          <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-10 text-center">
            <h2 className="text-2xl font-bold text-white">Find your perfect sublease 🎓</h2>
            <p className="mb-5 mt-1 text-sm text-indigo-100">
              {/* Q445 — the hero stat already states the live-campus number; this
                  band stays on the value proposition so the page never says it twice. */}
              Free to use, no broker fees. Message any poster directly.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/browse"
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
              >
                Browse subleases →
              </Link>
              <button
                type="button"
                onClick={onPost}
                className="rounded-xl border border-white px-5 py-2.5 text-sm text-white hover:bg-white/10"
              >
                Post a sublease
              </button>
            </div>
          </div>
        </section>
      )}




      {/* Q106 — footer now lives globally in src/components/leaseup/Footer.tsx */}

    </div>
  );
}


/* ---------------- Q66 sections ---------------- */

function LatestFeedSection({
  listings, campuses, savedIds, onSave, onOpen, onPost,
  userCampusId, feedCampusId, recentFilledCount,
}: {
  listings: Listing[];
  campuses: Campus[];
  savedIds: Set<string>;
  onSave: (l: Listing) => void;
  onOpen: (l: Listing) => void;
  onPost: () => void;
  userCampusId: string | null;
  feedCampusId: string | null;
  recentFilledCount: number;
}) {
  const navigate = useNavigate();
  const scopedId = feedCampusId;
  const campus = scopedId ? campuses.find((c) => c.id === scopedId) : null;
  const campusLabel = campus?.short_name ?? campus?.name;

  const heading = campusLabel
    ? `Subleases near ${campusLabel}`
    : "Subleases near Athens, GA";


  const feed = useMemo(() => {
    const src = scopedId ? listings.filter((l) => l.campus_id === scopedId) : listings;
    return [...src]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6);
  }, [listings, scopedId]);

  const empty = feed.length === 0;

  return (
    <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground">{heading}</h2>
        {!empty && (
          <button
            onClick={() =>
              navigate({ to: "/browse", search: (campus ? { campus: campus.slug } : {}) as any })
            }
            className="text-sm font-semibold text-primary hover:underline"
          >
            View all →
          </button>
        )}
      </div>

      {recentFilledCount > 0 && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          🎉 {recentFilledCount} sublease{recentFilledCount === 1 ? "" : "s"} found their renter this month
          {campusLabel ? ` at ${campusLabel}` : ""}
        </div>
      )}

      {empty ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <div className="text-5xl">🏠</div>
          <h3 className="mt-3 text-lg font-bold">
            No subleases posted{campusLabel ? ` at ${campusLabel}` : ""} yet.
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first — post yours and help a fellow student find housing.
          </p>
          <button
            onClick={onPost}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
          >
            Post the first sublease{campusLabel ? ` at ${campusLabel}` : ""} →
          </button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 md:gap-5 lg:grid-cols-4 lg:gap-6">
          {feed.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              saved={savedIds.has(l.id)}
              onSave={() => onSave(l)}
              onOpen={() => onOpen(l)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Q104 — live supply counter under the hero search.
 * Fire-and-forget: renders nothing while loading or on any failure.
 *
 * Q192 — exact active-listing count (same filters as /browse), no rounding;
 * inquiries shown only when credible (>= 25), otherwise "Free to message".
 * Campuses count stays on the broader active-listing set (do not touch it).
 */
function LiveCounter() {
  const [stats, setStats] = useState<{ listings: number; campuses: number; inquiries: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [
          { data: exactData, error: exactErr },
          { count: msgCount },
          lookers,
          savers,
        ] = await Promise.all([
          // Q192 — match fetchListings exactly so the hero never disagrees with /browse.
          supabase
            .from("listings")
            .select("campus_id")
            .eq("is_active", true)
            .eq("status", "active")
            .or(`available_to.is.null,available_to.gte.${today}`),
          supabase.from("messages").select("id", { count: "exact", head: true }),
          supabase.from("looking_for_posts").select("user_id"),
          supabase.from("saved_listings").select("user_id"),
        ]);
        if (cancelled) return;
        if (exactErr || !exactData) { setStats(null); setLoading(false); return; }
        const listings = exactData.length;
        const distinct = new Set<string>();
        for (const r of lookers.data ?? []) if (r?.user_id) distinct.add(`l:${r.user_id}`);
        for (const r of savers.data ?? []) if (r?.user_id) distinct.add(`s:${r.user_id}`);
        const rawInquiries = (msgCount ?? 0) + distinct.size;
        setStats({
          listings,
          // Q445 — campuses that actually have a live, unexpired sublease right
          // now (same row set as the listings stat). Derived live: it rises as
          // real listings are posted at new schools. Never the directory total.
          campuses: new Set(exactData.map((r) => r?.campus_id).filter(Boolean)).size,
          inquiries: rawInquiries,
        });
      } catch { if (!cancelled) setStats(null); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="mt-6 flex divide-x divide-gray-200 dark:divide-border" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 px-2 text-center">
            <div className="mx-auto h-7 w-16 animate-pulse rounded bg-gray-200 dark:bg-muted" />
            <div className="mx-auto mt-2 h-3 w-24 animate-pulse rounded bg-gray-200 dark:bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats || stats.listings === 0) return null;

  const showInquiryNumber = stats.inquiries >= 25;
  const blocks: { emoji: string; value?: number; text?: string; label: string }[] = [
    { emoji: "\ud83c\udfe0", value: stats.listings, label: "subleases posted" },
    // Q445 — never print "0 campuses": degrade to a truthful non-numeric stat.
    stats.campuses > 0
      ? { emoji: "\ud83c\udf93", value: stats.campuses, label: stats.campuses === 1 ? "campus with live subleases" : "campuses with live subleases" }
      : { emoji: "\ud83c\udf93", text: "Nationwide", label: "post at any US campus" },
    showInquiryNumber
      ? { emoji: "\ud83d\udcac", value: stats.inquiries, label: "student inquiries" }
      : { emoji: "\ud83d\udcac", text: "Free", label: "to message a poster" },
  ];

  return (
    <div className="mt-6">
      <div className="flex divide-x divide-gray-200 dark:divide-border">
        {blocks.map((b) => (
          <div key={b.label} className="flex-1 px-2 text-center">
            <p className="text-2xl font-bold text-indigo-700 dark:text-primary">
              {b.emoji}{" "}
              {b.text ? (
                b.text
              ) : (
                <CountUp value={b.value ?? 0} duration={1500} />
              )}
            </p>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-muted-foreground">{b.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}





function LookingForStrip({ posts }: { posts: LookingForPost[] }) {
  if (!posts || posts.length === 0) return null;
  const top = posts.slice(0, 4);
  return (
    <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-xl font-extrabold sm:text-2xl">
          Students actively looking — reach out to them
        </h2>
        <Link to="/looking" className="text-sm font-semibold text-primary hover:underline">
          See all →
        </Link>
      </div>
      <div className="mt-4 -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {top.map((p) => (
          <Link
            key={p.id}
            to="/looking"
            className="min-w-[260px] max-w-[280px] shrink-0 snap-start rounded-2xl bg-surface p-4 shadow-card hover:shadow-card-md"
          >
            <div className="flex items-center gap-2">
              <UserAvatar
                name={posterName(p, "A student")}
                avatarUrl={p.profile?.avatar_url}
                color={p.profile?.banner_color ?? null}
                className="h-9 w-9"
                textClassName="text-sm"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">
                  {posterName(p, "A student")}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {p.budget_max ? `Up to $${Number(p.budget_max).toLocaleString("en-US")}/mo` : "Budget flexible"}
                  {p.move_in_date ? ` · ${new Date(p.move_in_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
                </div>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-foreground/80">{p.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}


/**
 * Q110 Part C — friendly strip for signed-out visitors: one tap into the
 * authenticated experience. Disappears entirely once signed in.
 */
function GuestWelcomeStrip() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setSignedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  if (signedIn !== false) return null;

  return (
    <div className="mx-auto hidden max-w-7xl px-4 pb-2 sm:block sm:px-6">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 dark:border-border dark:bg-surface">
        <p className="text-sm text-gray-700 dark:text-foreground">
          👋 Exploring LeaseUp? Browse real listings or
        </p>
        <button
          onClick={() => openSignIn(typeof window !== "undefined" ? window.location.pathname : undefined)}
          className="shrink-0 rounded-full bg-gray-900 px-4 py-2 text-sm text-white hover:bg-black dark:bg-foreground dark:text-background"
        >
          Sign in with Google →
        </button>
      </div>
    </div>
  );
}

/* ---------------- Q148 — featured listing hero card ---------------- */

function FeaturedListingCard({
  listings, campuses, onOpen, campusId,
}: {
  listings: Listing[];
  campuses: Campus[];
  onOpen: (l: Listing) => void;
  /** Q177 — the spotlight is always scoped to one campus, never a random one. */
  campusId?: string | null;
}) {
  const active = useMemo(
    () =>
      listings.filter(
        (l) =>
          (l.status ?? "active") === "active" &&
          (!campusId || l.campus_id === campusId) &&
          (l.photo_urls?.length || l.photos?.length),
      ),
    [listings, campusId],
  );
  const featured = useMemo(() => {
    if (!campusId || active.length < 5) return null;
    return [...active].sort(
      (a, b) =>
        ((b.view_count ?? 0) * 0.4 + (b.saves_count ?? 0) * 0.6) -
        ((a.view_count ?? 0) * 0.4 + (a.saves_count ?? 0) * 0.6),
    )[0];
  }, [active, campusId]);

  if (!featured) return null;
  const campus = campuses.find((c) => c.id === featured.campus_id);
  const photo = (featured.photo_urls?.length ? featured.photo_urls : featured.photos)?.[0];


  return (
    <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-foreground">
        Most popular {campus ? `near ${campus.short_name ?? campus.name}` : "this week"}
      </h2>

      <button
        type="button"
        onClick={() => onOpen(featured)}
        className="group block w-full overflow-hidden rounded-3xl border border-border bg-card text-left transition hover:shadow-card-md"
      >
        <div className="relative w-full overflow-hidden bg-muted">
          {photo ? (
            <img
              src={photo}
              alt={featured.title}
              loading="lazy"
              className="max-h-64 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-5xl">🏠</div>
          )}
          <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-gray-900 shadow-sm">
            ⭐ Featured
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {campus && (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {campus.short_name || campus.name}
                </span>
              )}
              <span className="text-xs font-medium text-muted-foreground">
                {featured.beds === 0 ? "Studio" : `${featured.beds} bed`} · {featured.baths} bath
              </span>
            </div>
            <h3 className="mt-1.5 truncate text-lg font-bold sm:text-xl">{featured.title}</h3>
            <p className="text-sm font-semibold text-foreground">
              ${featured.price.toLocaleString()}<span className="font-normal text-muted-foreground"> / month</span>
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition group-hover:opacity-90">
            View listing <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </button>
    </section>
  );
}

/* ---------------- Q111 / Q148 — New this week (campus-personalised) ---------------- */

function NewThisWeekSection({
  listings, campuses, savedIds, onSave, onOpen,
}: {
  listings: Listing[];
  campuses: Campus[];
  savedIds: Set<string>;
  onSave: (l: Listing) => void;
  onOpen: (l: Listing) => void;
}) {
  const lastSlug = useLastCampusSlug();
  const lastCampus = lastSlug ? campuses.find((c) => c.slug === lastSlug) ?? null : null;

  // Q148 — when we know a campus, pull its 4 newest active listings directly.
  const { data: campusFresh } = useQuery({
    queryKey: ["home-near-you", lastCampus?.id],
    enabled: !!lastCampus,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("campus_id", lastCampus!.id)
        .eq("is_active", true)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return await publicLocationLabel((data ?? []) as unknown as Listing[]);
    },
  });

  const fresh = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return listings
      .filter(
        (l) =>
          (l.status ?? "active") === "active" &&
          new Date(l.created_at).getTime() >= cutoff,
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6);
  }, [listings]);

  const personalised = lastCampus && campusFresh && campusFresh.length > 0;
  const visibleIds = new Set(listings.map((listing) => listing.id));
  const items = personalised ? (campusFresh ?? []).filter((listing) => visibleIds.has(listing.id)) : fresh;
  const label = lastCampus?.short_name || lastCampus?.name;

  if (!personalised && fresh.length < 3) return null;

  return (
    <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground">
          {personalised ? `New near ${label}` : "New this week"}
        </h2>
        <Link
          to="/browse"
          search={{ sort: "newest" } as any}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Just listed →
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


/* ---------------- Q149/Q279 — Recently viewed ---------------- */

function RecentlyViewedSection({
  savedIds, onSave, onOpen, filter,
}: {
  savedIds: Set<string>;
  onSave: (l: Listing) => void;
  onOpen: (l: Listing) => void;
  filter: (l: Listing) => boolean;
}) {
  const recentIds = useRecentViews();

  const { data: recent = [] } = useQuery({
    queryKey: ["home-recently-viewed", recentIds.join(",")],
    enabled: recentIds.length >= RECENT_RAIL_MIN,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").in("id", recentIds);
      if (error) throw error;
      const rows = await publicLocationLabel((data ?? []) as unknown as Listing[]);
      // Preserve newest-first order from localStorage.
      return recentIds.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as Listing[];
    },
  });

  const visibleRecent = recent.filter(filter);

  if (recentIds.length < RECENT_RAIL_MIN || visibleRecent.length === 0) return null;


  return (
    <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-foreground">Recently viewed</h2>
      <ScrollRow>
        {visibleRecent.map((l) => (
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


/* ---------------- Q177 — "Near you" (first-visit fallback) ---------------- */

/**
 * Shown instead of "Recently viewed" when a visitor has no history: we use the
 * campus closest to their browser location so the first row is relevant rather
 * than an arbitrary listing from across the country.
 */
function NearYouSection({
  listings, campus, savedIds, onSave, onOpen,
}: {
  listings: Listing[];
  campus: Campus | null;
  savedIds: Set<string>;
  onSave: (l: Listing) => void;
  onOpen: (l: Listing) => void;
}) {
  const items = useMemo(() => {
    if (!campus) return [];
    return listings
      .filter(
        (l) =>
          l.campus_id === campus.id &&
          (l.status ?? "active") === "active" &&
          (l.photo_urls?.length || l.photos?.length),
      )
      .slice(0, 8);
  }, [listings, campus]);

  if (!campus || items.length < 3) return null;

  return (
    <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
      <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-foreground">
        Near you — {campus.short_name ?? campus.name}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Based on your location. Pick a different campus any time.
      </p>
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
