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
import { fetchCampusListingCounts } from "@/lib/leaseup/queries";
import { Link, useNavigate } from "@tanstack/react-router";
import { MapPin, Flame, Sparkles, ArrowRight, Search, ChevronDown } from "lucide-react";
import type { Listing, LookingForPost } from "@/lib/leaseup/types";
import type { Campus } from "@/lib/leaseup/campuses";
import { SearchPill, EMPTY_SEARCH, type SearchState } from "./SearchPill";
import { buildBrowseSearch } from "@/lib/leaseup/search-params";
import { ListingRail } from "./ListingRail";
import { ListingCard } from "./ListingCard";
import { ListingCardSkeletonRow } from "./ListingCardSkeleton";
import { SmartSections, ScrollRow } from "./SmartSections";
import { cn } from "@/lib/utils";
import { useLastCampusSlug } from "@/lib/leaseup/last-campus";
import { useRecentViews } from "@/lib/leaseup/recent-views";
import { openSignIn } from "./SignInModal";
import { HomeSmartBanner } from "./HomeSmartBanner";


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
const CAMPUS_EMOJI: Record<string, string> = {
  uga: "🐾", "university-of-georgia": "🐾",
  uf: "🐊", "university-of-florida": "🐊",
  alabama: "🐘", "university-of-alabama": "🐘",
  auburn: "🐯", "auburn-university": "🐯",
  "clemson-university": "🐅",
  "duke-university": "😈",
  "florida-state-university": "🍢",
  "georgia-tech": "🐝",
  "ohio-state-university": "🌰",
  "university-of-texas-at-austin": "🤘",
  "university-of-michigan": "〽️",
  "penn-state-university": "🦁",
  "vanderbilt-university": "⭐",
};

function campusEmoji(c: Campus) {
  return CAMPUS_EMOJI[c.slug] ?? CAMPUS_EMOJI[c.short_name?.toLowerCase() ?? ""] ?? "🎓";
}

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
  const railsRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [cat, setCat] = useState<Cat>("all");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);


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

  const inCat = useMemo(
    () => searched.filter((l) => matchesCategory(l, cat, medianFor)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searched, cat, priceMedian],
  );

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
      .slice(0, 12);
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
    // Q119 — a picked campus goes straight to its landing page.
    const picked = state.campusId ? campuses.find((c) => c.id === state.campusId) : null;
    if (picked?.slug) {
      navigate({ to: "/campus/$slug", params: { slug: picked.slug } });
      return;
    }
    navigate({ to: "/browse", search: buildBrowseSearch(state) as any });
  }

  /** Category pills: "All" filters in place, the rest deep-link into /browse. */
  const CAT_SEARCH: Partial<Record<Cat, Record<string, string | number>>> = {
    "near-campus": { nearCampus: 1 },
    furnished: { furnished: 1 },
    studio: { type: "studio" },
    "private-room": { type: "private_room" },
    "short-term": { maxDuration: 90 },
    "best-deals": { sort: "lowest" },
    "new-today": { sort: "newest", postedToday: 1 },
  };

  function pickCategory(k: Cat) {
    setCat(k);
    if (k === "all") {
      setSearch(EMPTY_SEARCH);
      return;
    }
    navigate({ to: "/browse", search: CAT_SEARCH[k] as any });
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
          <Link to="/" className="inline-block text-2xl font-bold tracking-tight text-gray-900 dark:text-foreground">
            LeaseUp
          </Link>
          <h1 className="mt-4 text-4xl font-bold text-gray-900 dark:text-foreground">
            Sublease near your campus.
          </h1>
          <p className="mt-3 text-xl text-gray-500 dark:text-muted-foreground">
            Verified students. Semester-ready dates. No Craigslist drama.
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

        {/* Q150 — quick-post a "Looking For" request without finding the board first */}
        <QuickLookingPost />

        <LiveCounter />
      </section>


      {/* Q160 — signed-in smart banner */}
      <HomeSmartBanner onPost={onPost} />

      {/* Q110 Part C — signed-out welcome strip (tablet+) */}
      <GuestWelcomeStrip />


      {/* CATEGORY PILLS */}
      <div className="sticky top-14 z-20 border-b bg-white/95 backdrop-blur dark:bg-surface/95">
        <div
          className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
        >
          {CATEGORIES.map(({ k, label, emoji }) => {
            const active = cat === k;
            return (
              <button
                key={k}
                onClick={() => pickCategory(k)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition",
                  active
                    ? "border-gray-900 bg-gray-900 font-semibold text-white dark:border-foreground dark:bg-foreground dark:text-background"
                    : "border-gray-200 bg-white font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-surface dark:text-foreground",
                )}
              >
                <span aria-hidden>{emoji}</span>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Q130 — how it works */}
      <HowItWorks />

      {/* Q134 — FAQ accordion */}
      <HomeFaq />


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
          {/* Q111 — "New this week" (hidden unless 3+ fresh listings) */}
          <NewThisWeekSection
            listings={listings}
            campuses={campuses}
            savedIds={savedIds}
            onSave={onSave}
            onOpen={onOpen}
          />
          {/* Q149 — recently viewed */}
          <RecentlyViewedSection savedIds={savedIds} onSave={onSave} onOpen={onOpen} />
        </>
      )}

      {/* Q148 — featured listing hero card */}
      {!loading && <FeaturedListingCard listings={listings} campuses={campuses} onOpen={onOpen} />}


      {/* SMART SECTIONS (Q93) — curated, query-backed rows */}
      <div ref={railsRef} className="scroll-mt-20">
        {!loading && (
          <SmartSections
            campuses={campuses}
            userCampusId={search.campusId ?? userCampusId ?? feedCampusId ?? null}
            savedIds={savedIds}
            onSave={onSave}
            onOpen={onOpen}
            filter={(l: Listing) => matchesCategory(l, cat, medianFor)}
          />
        )}

        {!loading && inCat.length === 0 && (
          <div className="mx-auto max-w-md px-6 py-16 text-center">
            <div className="text-6xl">🏠</div>
            <h2 className="mt-4 text-xl font-bold">No subleases here yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              LeaseUp is just getting started. Be the first to post — it takes 2 minutes.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => navigate({ to: "/post" })}
                className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
              >Post a sublease →</button>
              <button
                onClick={() => { setSearch(EMPTY_SEARCH); setCat("all"); }}
                className="rounded-full bg-foreground px-5 py-2 text-sm font-bold text-background hover:opacity-90"
              >Clear filters</button>
            </div>
          </div>
        )}
      </div>




      {/* LOOKING FOR STRIP (Q66) */}
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
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-2xl shadow-sm ring-1 ring-border sm:h-14 sm:w-14 sm:text-3xl">
                  {campusEmoji(c)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold sm:text-base">{c.short_name ?? c.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{c.city}, {c.state}</div>
                  <div className={`mt-1 text-xs font-semibold ${count > 0 ? "text-primary" : "text-muted-foreground"}`}>
                    {count > 0 ? `${count} active ${count === 1 ? "listing" : "listings"}` : "New"}
                  </div>
                </div>
                <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground sm:block" />

              </Link>
            );
          })}
        </div>
      </section>

      {/* CTA STRIP */}
      <section className="mx-auto mt-10 max-w-7xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-3xl bg-primary px-6 py-10 text-center text-primary-foreground sm:px-10 sm:py-14">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Got a sublease to post?</h2>
          <p className="mt-2 text-sm opacity-90 sm:text-base">
            It takes 2 minutes. Free to post — always.
          </p>
          <button
            onClick={onPost}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-6 py-3 text-sm font-bold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25 sm:text-base"
          >
            Post Your Sublease
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

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
 */
function LiveCounter() {
  const [stats, setStats] = useState<{ listings: number; campuses: number; inquiries: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [{ data, error }, { count: msgCount }] = await Promise.all([
          supabase
            .from("listings")
            .select("campus_id,available_to")
            .eq("is_active", true)
            .eq("status", "active"),
          supabase.from("messages").select("id", { count: "exact", head: true }),
        ]);
        if (cancelled) return;
        if (error || !data) { setLoading(false); return; }
        const live = data.filter((r) => !r.available_to || r.available_to >= today);
        setStats({
          listings: live.length,
          campuses: new Set(live.map((r) => r.campus_id)).size,
          inquiries: msgCount ?? 0,
        });
      } catch { /* noop */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="mt-4 flex items-center justify-center gap-3" aria-hidden>
        {[28, 20, 32].map((w, i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-gray-200 dark:bg-muted" style={{ width: `${w * 3}px` }} />
        ))}
      </div>
    );
  }

  if (!stats || (stats.listings === 0 && stats.campuses === 0 && stats.inquiries === 0)) return null;

  const Num = ({ children }: { children: React.ReactNode }) => (
    <span className="font-semibold text-gray-800 dark:text-foreground">{children}</span>
  );

  return (
    <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 text-center text-sm text-gray-500 dark:text-muted-foreground">
      <span>🏠 <Num>{stats.listings.toLocaleString()}</Num> active sublease{stats.listings === 1 ? "" : "s"}</span>
      <span aria-hidden>·</span>
      <span>🏫 <Num>{stats.campuses}</Num> campus{stats.campuses === 1 ? "" : "es"}</span>
      {stats.inquiries > 0 && (
        <>
          <span aria-hidden>·</span>
          <span>💬 <Num>{stats.inquiries.toLocaleString()}</Num> student inquir{stats.inquiries === 1 ? "y" : "ies"}</span>
        </>
      )}
    </p>
  );
}


/** Q130 — three-step explainer between the hero and the listing rails. */
const HOW_IT_WORKS = [
  { emoji: "🏠", title: "Post your sublease", body: "Takes 2 minutes. Free always." },
  { emoji: "🔍", title: "Students find you", body: "Verified students browse by campus." },
  { emoji: "💬", title: "Connect directly", body: "Message the host. No middleman." },
];

function HowItWorks() {
  return (
    <section className="mx-auto mt-12 max-w-5xl px-4 sm:px-6">
      <h2 className="mb-6 text-center text-xl font-extrabold sm:text-2xl">How LeaseUp works</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {HOW_IT_WORKS.map((s) => (
          <div
            key={s.title}
            className="rounded-2xl bg-gray-50 p-6 text-center dark:bg-surface"
          >
            <div className="text-3xl" aria-hidden>{s.emoji}</div>
            <h3 className="mt-3 text-base font-bold">{s.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// Q134 — homepage FAQ
const FAQS: { q: string; a: string }[] = [
  {
    q: "Is LeaseUp free to use?",
    a: "Yes — completely free to post a sublease and free to browse. No subscription, no listing fees, no middlemen taking a cut.",
  },
  {
    q: "How are listings verified?",
    a: "Every user signs up with a .edu email address, so you know you're talking to a real student. Verified listings show a ✓ Verified badge.",
  },
  {
    q: "How do I contact a host?",
    a: "Click \u201CMessage Host \u2192\u201D on any listing to start a direct conversation. No phone number required — messages stay within LeaseUp until you're ready to connect.",
  },
  {
    q: "What lease lengths are available?",
    a: "Most subleases are one semester (Fall or Spring). Full-year and summer subleases are also supported — filter by dates on the browse page.",
  },
  {
    q: "Which campuses is LeaseUp available at?",
    a: "We're currently live at University of Georgia, Ohio State, UT Austin, Georgia Tech, Auburn, Clemson, Duke, FSU, Florida, Michigan, Penn State, and Vanderbilt — and adding new campuses every semester.",
  },
  {
    q: "I need housing — how do I post a \u201CLooking For\u201D request?",
    a: "Click \u201CLooking for a place?\u201D in the nav. Post your budget, move-in dates, and preferences. Hosts with available subleases can message you directly.",
  },
];

function HomeFaq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mx-auto mt-14 max-w-3xl px-4 sm:px-6">
      <h2 className="mb-6 text-center text-xl font-extrabold sm:text-2xl">
        Frequently asked questions
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} className={i > 0 ? "border-t border-border" : undefined}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-sm font-semibold sm:text-base">{f.q}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <p className="px-5 pb-5 -mt-1 text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
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
              <div
                className="grid h-9 w-9 place-items-center rounded-full text-base"
                style={{ background: p.profile?.banner_color ?? "#2563EB" }}
              >
                {p.profile?.avatar_emoji ?? "🙂"}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">
                  {p.profile?.name ?? "A student"}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {p.budget_max ? `Up to $${p.budget_max}/mo` : "Budget flexible"}
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
  listings, campuses, onOpen,
}: {
  listings: Listing[];
  campuses: Campus[];
  onOpen: (l: Listing) => void;
}) {
  const active = useMemo(
    () => listings.filter((l) => (l.status ?? "active") === "active"),
    [listings],
  );
  const featured = useMemo(() => {
    if (active.length < 5) return null;
    return [...active].sort(
      (a, b) =>
        ((b.view_count ?? 0) * 0.4 + (b.saves_count ?? 0) * 0.6) -
        ((a.view_count ?? 0) * 0.4 + (a.saves_count ?? 0) * 0.6),
    )[0];
  }, [active]);

  if (!featured) return null;
  const campus = campuses.find((c) => c.id === featured.campus_id);
  const photo = featured.photos?.[0];

  return (
    <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
      <button
        type="button"
        onClick={() => onOpen(featured)}
        className="group block w-full overflow-hidden rounded-3xl border border-border bg-card text-left transition hover:shadow-card-md"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {photo ? (
            <img
              src={photo}
              alt={featured.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
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
      return (data ?? []) as unknown as Listing[];
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
  const items = personalised ? campusFresh! : fresh;
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


/* ---------------- Q149 — Recently viewed ---------------- */

function RecentlyViewedSection({
  savedIds, onSave, onOpen,
}: {
  savedIds: Set<string>;
  onSave: (l: Listing) => void;
  onOpen: (l: Listing) => void;
}) {
  const recentIds = useRecentViews();

  const { data: recent = [] } = useQuery({
    queryKey: ["home-recently-viewed", recentIds.join(",")],
    enabled: recentIds.length >= 2,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").in("id", recentIds);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Listing[];
      // Preserve newest-first order from localStorage.
      return recentIds.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as Listing[];
    },
  });

  if (recentIds.length < 2 || recent.length < 2) return null;

  return (
    <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-foreground">Recently viewed</h2>
      <ScrollRow>
        {recent.map((l) => (
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

/* ---------------- Q150 — homepage quick-post to the Looking Board ---------------- */

function QuickLookingPost() {
  const navigate = useNavigate();
  const [text, setText] = useState("");

  function post() {
    const v = text.trim();
    if (!v) return;
    navigate({ to: "/looking", search: { prefill: v.slice(0, 300) } });
  }

  return (
    <div className="mx-auto mt-5 max-w-3xl px-4 sm:px-6">
      <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm dark:border-border dark:bg-surface">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 300))}
          onKeyDown={(e) => { if (e.key === "Enter") post(); }}
          placeholder="What are you looking for? (e.g. 'UGA studio Aug–Dec under $700')"
          aria-label="Post a looking-for request"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={post}
          disabled={!text.trim()}
          className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
        >
          Post →
        </button>
      </div>
    </div>
  );
}
