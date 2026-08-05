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
import { MapPin, Flame, Sparkles, ArrowRight, Search } from "lucide-react";
import type { Listing, LookingForPost } from "@/lib/leaseup/types";
import type { Campus } from "@/lib/leaseup/campuses";
import { SearchPill, EMPTY_SEARCH, type SearchState } from "./SearchPill";
import { ListingRail } from "./ListingRail";
import { ListingCard } from "./ListingCard";
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
          <p className="mt-1 text-base text-gray-500 dark:text-muted-foreground">
            Find a sublease. Move in easy.
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
                onClick={() => setCat(k)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition",
                  active
                    ? "border-gray-900 bg-gray-50 font-semibold text-gray-900 dark:border-foreground dark:bg-background dark:text-foreground"
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

      {/* LATEST SUBLEASES FEED (Q66) */}
      <LatestFeedSection
        listings={listings}
        campuses={campuses}
        savedIds={savedIds}
        onSave={onSave}
        onOpen={onOpen}
        onPost={onPost}
        userCampusId={userCampusId ?? null}
        feedCampusId={feedCampusId ?? null}
        recentFilledCount={recentFilledCount ?? 0}
      />

      {/* LOOKING FOR STRIP (Q66) */}
      <LookingForStrip posts={lookingForPosts ?? []} />

      {/* HOW IT WORKS (Q66) */}
      <HowItWorks />


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
      <footer className="mx-auto mt-10 max-w-7xl border-t px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-gray-500 dark:text-muted-foreground">
          <span>© {new Date().getFullYear()} LeaseUp</span>
          <span aria-hidden>·</span>
          <Link to="/about" className="hover:text-foreground">About</Link>
          <span aria-hidden>·</span>
          <Link to="/about" hash="how-it-works" className="hover:text-foreground">How it works</Link>
          <span aria-hidden>·</span>
          <Link to="/ambassador" className="hover:text-foreground">Ambassador</Link>
          <span aria-hidden>·</span>
          <Link to="/looking-for" className="hover:text-foreground">Looking For board</Link>
          <span aria-hidden>·</span>
          <a href="mailto:hello@leasup.co" className="hover:text-foreground">Contact</a>
        </div>
      </footer>
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

function LookingForStrip({ posts }: { posts: LookingForPost[] }) {
  if (!posts || posts.length === 0) return null;
  const top = posts.slice(0, 4);
  return (
    <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-xl font-extrabold sm:text-2xl">
          Students actively looking — reach out to them
        </h2>
        <Link to="/looking-for" className="text-sm font-semibold text-primary hover:underline">
          See all →
        </Link>
      </div>
      <div className="mt-4 -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {top.map((p) => (
          <Link
            key={p.id}
            to="/looking-for"
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

function HowItWorks() {
  const renter = [
    "Browse real listings from verified .edu students",
    "Message directly — no middleman",
    "No application fee, ever",
  ];
  const lister = [
    "Post your sublease free in under 2 minutes",
    "Get reached by students already searching",
    "Mark as rented when done",
  ];
  return (
    <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
      <h2 className="text-xl font-extrabold sm:text-2xl">How it works</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-surface p-5 shadow-card">
          <div className="text-xs font-bold uppercase tracking-wide text-primary">For renters</div>
          <ul className="mt-3 space-y-2 text-sm">
            {renter.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-black text-primary">{i + 1}.</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-surface p-5 shadow-card">
          <div className="text-xs font-bold uppercase tracking-wide text-primary">For listers</div>
          <ul className="mt-3 space-y-2 text-sm">
            {lister.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-black text-primary">{i + 1}.</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
