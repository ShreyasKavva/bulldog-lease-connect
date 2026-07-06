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
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Home, MapPin, Flame, Sparkles, Sofa, CalendarCheck2,
  DoorOpen, Building2, ArrowRight,
} from "lucide-react";
import type { Listing, LookingForPost } from "@/lib/leaseup/types";
import type { Campus } from "@/lib/leaseup/campuses";
import { SearchPill, EMPTY_SEARCH, type SearchState } from "./SearchPill";
import { ListingRail } from "./ListingRail";
import { ListingCard } from "./ListingCard";
import { cn } from "@/lib/utils";

type Cat =
  | "all" | "near-campus" | "best-deals" | "new-today"
  | "furnished" | "available-now" | "private-room" | "full-apt";

const CATEGORIES: { k: Cat; label: string; Icon: typeof Home }[] = [
  { k: "all", label: "All", Icon: Home },
  { k: "near-campus", label: "Near Campus", Icon: MapPin },
  { k: "best-deals", label: "Best Deals", Icon: Flame },
  { k: "new-today", label: "New Today", Icon: Sparkles },
  { k: "furnished", label: "Furnished", Icon: Sofa },
  { k: "available-now", label: "Available Now", Icon: CalendarCheck2 },
  { k: "private-room", label: "Private Room", Icon: DoorOpen },
  { k: "full-apt", label: "Full Apartment", Icon: Building2 },
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
    case "available-now": {
      if (!l.available_from) return true;
      return new Date(l.available_from).getTime() <= now + 1000 * 60 * 60 * 24 * 30;
    }
    case "private-room":
      return l.beds <= 1;
    case "full-apt":
      return l.beds >= 2;
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

  // Live campus counts (from currently active listings we already have)
  const campusCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of listings) m.set(l.campus_id, (m.get(l.campus_id) ?? 0) + 1);
    return m;
  }, [listings]);
  const spotlightCampuses = useMemo(() => {
    const preferred = ["university-of-georgia", "university-of-florida", "university-of-alabama", "auburn-university"];
    const byPref = preferred
      .map((s) => campuses.find((c) => c.slug === s))
      .filter((c): c is Campus => !!c);
    if (byPref.length >= 4) return byPref.slice(0, 4);
    // Fall back to the top campuses by listing count.
    return [...campuses]
      .sort((a, b) => (campusCounts.get(b.id) ?? 0) - (campusCounts.get(a.id) ?? 0))
      .slice(0, 4);
  }, [campuses, campusCounts]);


  function runSearch() {
    const params: Record<string, string> = {};
    if (search.campusId) {
      const c = campuses.find((c) => c.id === search.campusId);
      if (c?.slug) params.campus = c.slug;
    } else if (search.where.trim()) {
      params.q = search.where.trim();
    }
    if (search.from) params.from = search.from.toISOString().slice(0, 10);
    if (search.to) params.to = search.to.toISOString().slice(0, 10);
    navigate({ to: "/browse", search: params as any });
  }

  return (
    <div className="min-h-screen bg-white dark:bg-background">
      {/* HERO */}
      <section className="relative pb-6 pt-8 sm:pt-12">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Link to="/" className="inline-block text-4xl font-black tracking-tight sm:text-5xl">
            <span className="text-primary">Lease</span><span className="text-foreground">Up</span>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            Find a sublease. Find a roommate. Find your people.
          </p>
        </div>

        <div className="mx-auto mt-6 max-w-3xl px-4 sm:px-6">
          <SearchPill value={search} onChange={setSearch} onSearch={runSearch} />
        </div>

        {/* Activity strip — social proof */}
        <ActivityStrip listings={listings} />

        <p className="mx-auto mt-4 max-w-md px-4 text-center text-xs text-muted-foreground">
          Browse verified student subleases — no sign-up required
        </p>
      </section>

      {/* CATEGORY STRIP */}
      <div className="sticky top-14 z-20 border-b bg-white/95 backdrop-blur dark:bg-surface/95">
        <div
          className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
        >
          {CATEGORIES.map(({ k, label, Icon }) => {
            const active = cat === k;
            return (
              <button
                key={k}
                onClick={() => setCat(k)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition",
                  active
                    ? "border-gray-900 bg-gray-900 text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* RAILS */}
      <div ref={railsRef} className="scroll-mt-20">
        <ListingRail
          title={<span className="inline-flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Near Campus</span>}
          listings={nearCampus}
          savedIds={savedIds}
          onSave={onSave}
          onOpen={onOpen}
          onSeeAll={() => navigate({ to: "/browse" })}
        />
        <ListingRail
          title={<span className="inline-flex items-center gap-2"><Flame className="h-5 w-5 text-orange-500" /> Best Deals</span>}
          listings={bestDeals}
          savedIds={savedIds}
          onSave={onSave}
          onOpen={onOpen}
          onSeeAll={() => navigate({ to: "/browse" })}
        />
        <ListingRail
          title={<span className="inline-flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Just Posted</span>}
          listings={justPosted}
          savedIds={savedIds}
          onSave={onSave}
          onOpen={onOpen}
          onSeeAll={() => navigate({ to: "/browse" })}
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

      {/* Footer */}
      <footer className="mx-auto mt-10 max-w-7xl border-t px-4 py-8 text-xs text-muted-foreground sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} LeaseUp — student subleases</div>
          <div className="flex flex-wrap gap-4">
            <Link to="/looking-for" className="hover:text-foreground">Looking For board</Link>
            <Link to="/market" className="hover:text-foreground">Market data</Link>
            <Link to="/lease-analysis" className="hover:text-foreground">Lease bot</Link>
            <Link to="/ambassador" className="hover:text-foreground">Ambassadors</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ActivityStrip({ listings }: { listings: Listing[] }) {
  const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = listings.filter((l) => new Date(l.created_at).getTime() >= week).length;
  const active = new Set(listings.map((l) => l.campus_id)).size;
  if (!recent && !active) return null;
  return (
    <div className="mx-auto mt-4 max-w-3xl px-4 sm:px-6">
      <div className="mx-auto inline-flex w-full items-center justify-center gap-3 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 dark:bg-primary/10 dark:text-primary">
        {recent > 0 && <span>🔥 {recent} sublease{recent === 1 ? "" : "s"} listed this week</span>}
        {recent > 0 && active > 0 && <span className="opacity-40">·</span>}
        {active > 0 && <span>🏫 {active} campus{active === 1 ? "" : "es"} active</span>}
      </div>
    </div>
  );
}
