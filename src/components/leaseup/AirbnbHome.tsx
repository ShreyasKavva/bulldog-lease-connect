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
import { MapPin, Flame, Sparkles, ArrowRight, Search } from "lucide-react";
import type { Listing, LookingForPost } from "@/lib/leaseup/types";
import type { Campus } from "@/lib/leaseup/campuses";
import { SearchPill, EMPTY_SEARCH, type SearchState } from "./SearchPill";
import { buildBrowseSearch } from "@/lib/leaseup/search-params";
import { ListingRail } from "./ListingRail";
import { ListingCard } from "./ListingCard";
import { SmartSections } from "./SmartSections";
import { cn } from "@/lib/utils";

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
  userCampusId, feedCampusId, lookingForPosts, recentFilledCount,
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
    const ranked = [...campuses].sort(
      (a, b) => (campusCounts.get(b.id) ?? 0) - (campusCounts.get(a.id) ?? 0),
    );
    const withListings = ranked.filter((c) => (campusCounts.get(c.id) ?? 0) > 0);
    if (withListings.length >= 4) return withListings.slice(0, 4);
    // Top-up with preferred launch campuses so the grid is never half-empty.
    const preferred = ["university-of-georgia", "university-of-florida", "university-of-alabama", "auburn-university"];
    const extras = preferred
      .map((s) => campuses.find((c) => c.slug === s))
      .filter((c): c is Campus => !!c && !withListings.some((w) => w.id === c.id));
    return [...withListings, ...extras, ...ranked].filter(
      (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i,
    ).slice(0, 4);
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

        <LiveCounter />
      </section>

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


      {/* SMART SECTIONS (Q93) — curated, query-backed rows */}
      <div ref={railsRef} className="scroll-mt-20">
        <SmartSections
          campuses={campuses}
          userCampusId={search.campusId ?? userCampusId ?? feedCampusId ?? null}
          savedIds={savedIds}
          onSave={onSave}
          onOpen={onOpen}
          filter={(l: Listing) => matchesCategory(l, cat, medianFor)}
        />

        {inCat.length === 0 && (
          <div className="mx-auto max-w-md px-6 py-16 text-center">
            <div className="text-6xl">🏠</div>
            <h2 className="mt-4 text-xl font-bold">No subleases here yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              LeaseUp is just getting started. Be the first to post — it takes 2 minutes.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => navigate({ to: "/", search: { post: 1 } as any })}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {spotlightCampuses.map((c) => {
            const count = campusCounts.get(c.id) ?? 0;
            return (
              <Link
                key={c.id}
                to="/sublease/$slug"
                params={{ slug: c.slug }}
                className="group flex items-center gap-4 rounded-2xl bg-gray-50 p-5 transition hover:bg-gray-100 dark:bg-background dark:hover:bg-background/70"
              >
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-3xl shadow-sm ring-1 ring-border">
                  {campusEmoji(c)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-bold">{c.short_name ?? c.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{c.city}, {c.state}</div>
                  <div className="mt-1 text-xs font-semibold text-primary">
                    {count} active {count === 1 ? "listing" : "listings"}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
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
  const [stats, setStats] = useState<{ listings: number; campuses: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("listings")
          .select("campus_id")
          .eq("is_active", true)
          .eq("status", "active");
        if (error || !data || cancelled) return;
        setStats({
          listings: data.length,
          campuses: new Set(data.map((r) => r.campus_id)).size,
        });
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!stats || stats.listings === 0) return null;
  return (
    <p className="mt-4 text-center text-sm text-gray-400 dark:text-muted-foreground">
      {stats.listings.toLocaleString()} active sublease{stats.listings === 1 ? "" : "s"} across{" "}
      {stats.campuses} campus{stats.campuses === 1 ? "" : "es"}
    </p>
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

