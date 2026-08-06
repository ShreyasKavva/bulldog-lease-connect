import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchListings, fetchSavedIds, toggleSaved, getOrCreateConversation } from "@/lib/leaseup/queries";
import { useSession } from "@/lib/leaseup/use-session";
import { RenterFeedbackPrompt } from "@/components/leaseup/RenterFeedbackPrompt";
import { ListingCard } from "@/components/leaseup/ListingCard";
import { ListingDetailSheet } from "@/components/leaseup/ListingDetailSheet";
import { PostListingDialog } from "@/components/leaseup/PostListingDialog";
import { ProfileSheet } from "@/components/leaseup/ProfileSheet";
import { MessagesSheet } from "@/components/leaseup/MessagesSheet";
import { ScrollView } from "@/components/leaseup/ScrollView";
import { CompareBar } from "@/components/leaseup/CompareBar";
import { CompareSheet } from "@/components/leaseup/CompareSheet";
import { BrowseFilterBar, type BrowseFilterValues } from "@/components/leaseup/BrowseFilterBar";


import type { Listing } from "@/lib/leaseup/types";
import { LayoutGrid, Flame, Bell, Map as MapIcon } from "lucide-react";
import { BrowseMapView } from "@/components/leaseup/BrowseMapView";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SaveSearchDialog } from "@/components/leaseup/SaveSearchDialog";
import { TrendingCarousel } from "@/components/leaseup/TrendingCarousel";
import { fetchTrendingIds } from "@/lib/leaseup/referral.queries";
import { useMyProfile } from "@/lib/leaseup/use-session";
import { fetchCampuses } from "@/lib/leaseup/campuses";
import { CampusPills } from "@/components/leaseup/CampusPills";

type Sort = "newest" | "price_asc" | "price_desc" | "popular";

const SORT_VALUES: Sort[] = ["newest", "price_asc", "price_desc", "popular"];
const BED_VALUES = ["0", "1", "2", "3+"] as const;
type BedKey = (typeof BED_VALUES)[number];

type BrowseSearch = {
  q?: string;
  campus?: string;
  area?: string;
  min_price?: number;
  max_price?: number;
  bedrooms?: string; // csv "1,2"
  baths?: number;
  from?: string; // ISO date yyyy-mm-dd
  to?: string;
  furnished?: 1;
  utilities?: 1;
  parking?: 1;
  pets?: 1;
  wifi?: 1;
  laundry?: 1;
  sort?: Sort;
  view?: "grid" | "map";
  // Q96 — params emitted by hero/nav search + homepage category pills
  tenants?: number;
  type?: string;
  maxDuration?: number;
  availableSoon?: 1;
  postedToday?: 1;
  nearCampus?: 1;
  openFilters?: 1;
  hostId?: string;
};


function parseInt2(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}
function parseStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function parseFlag(v: unknown): 1 | undefined {
  return v === 1 || v === "1" || v === true || v === "true" ? 1 : undefined;
}
function parseBeds(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const parts = v.split(",").map((s) => s.trim()).filter((s) => (BED_VALUES as readonly string[]).includes(s));
  return parts.length ? parts.join(",") : undefined;
}
/** Accepts internal values plus the friendly aliases used by search links. */
function parseSort(v: unknown): Sort | undefined {
  if (typeof v !== "string") return undefined;
  if (v === "lowest") return "price_asc";
  if (v === "highest") return "price_desc";
  if (v === "trending") return "popular";
  return (SORT_VALUES as string[]).includes(v) ? (v as Sort) : undefined;
}
function parseType(v: unknown): string | undefined {
  const t = parseStr(v);
  return t && ["studio", "private_room", "entire", "shared"].includes(t) ? t : undefined;
}

export const Route = createFileRoute("/browse")({
  validateSearch: (raw: Record<string, unknown>): BrowseSearch => ({
    q: parseStr(raw.q),
    campus: parseStr(raw.campus),
    area: parseStr(raw.area),
    min_price: parseInt2(raw.min_price ?? raw.minPrice),
    max_price: parseInt2(raw.max_price ?? raw.maxPrice),
    bedrooms: parseBeds(raw.bedrooms),
    baths: parseInt2(raw.baths),
    from: parseStr(raw.from ?? raw.availableFrom),
    to: parseStr(raw.to ?? raw.availableTo),
    furnished: parseFlag(raw.furnished),
    utilities: parseFlag(raw.utilities),
    parking: parseFlag(raw.parking),
    pets: parseFlag(raw.pets),
    wifi: parseFlag(raw.wifi),
    laundry: parseFlag(raw.laundry),
    sort: parseSort(raw.sort),
    view: raw.view === "map" ? "map" : undefined,
    tenants: parseInt2(raw.tenants),
    type: parseType(raw.type),
    maxDuration: parseInt2(raw.maxDuration),
    availableSoon: parseFlag(raw.availableSoon),
    postedToday: parseFlag(raw.postedToday),
    nearCampus: parseFlag(raw.nearCampus),
    openFilters: parseFlag(raw.openFilters),
    hostId: parseStr(raw.hostId),
  }),
  head: () => ({
    meta: [
      { title: "Browse subleases — LeaseUp" },
      { name: "description", content: "Browse student subleases at any campus. Verified .edu emails, real listings, no fees." },
      { property: "og:title", content: "Browse subleases — LeaseUp" },
      { property: "og:description", content: "Browse student subleases at any campus. Verified .edu emails, real listings, no fees." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Browse,
});

type View = "grid" | "scroll";

function Browse() {
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();
  const qc = useQueryClient();

  // Q78: Toast + strip the "?notice=" flag left by the /lease-analysis 301.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("notice") === "lease-analysis-gone") {
      toast.message("Lease analysis isn't available yet — browse listings instead.");
      url.searchParams.delete("notice");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["listings"],
    queryFn: fetchListings,
  });
  const { data: savedIds = new Set<string>() } = useQuery({
    queryKey: ["saved", user?.id],
    queryFn: () => fetchSavedIds(user!.id),
    enabled: !!user?.id,
  });
  const { data: profile } = useMyProfile();
  const { data: campuses = [] } = useQuery({ queryKey: ["campuses"], queryFn: fetchCampuses, staleTime: Infinity });
  const myCampus = campuses.find(c => c.id === profile?.campus_id);
  const { data: trendingIds = [] } = useQuery({
    queryKey: ["trending-ids", profile?.campus_id ?? "all"],
    queryFn: () => fetchTrendingIds(profile?.campus_id ?? null, 5),
    staleTime: 5 * 60 * 1000,
  });
  const trendingListings = useMemo(
    () => trendingIds.map(id => listings.find(l => l.id === id)).filter(Boolean) as Listing[],
    [trendingIds, listings],
  );

  // URL-driven filters — shareable, back/forward safe, refresh-safe.
  const s = Route.useSearch();
  const sort: Sort = s.sort ?? "newest";
  const maxPrice = s.max_price ?? undefined;
  const minPrice = s.min_price ?? undefined;
  const area = s.area ?? "";
  const furnishedOnly = s.furnished === 1;
  const bedSet = useMemo(
    () => new Set<BedKey>(((s.bedrooms ?? "").split(",").filter(Boolean) as BedKey[])),
    [s.bedrooms],
  );
  const fromDate = s.from ? new Date(s.from) : null;
  const toDate = s.to ? new Date(s.to) : null;
  const campusSlug = s.campus ?? null;
  // Accepts either a campus slug (shareable links) or a raw campus id (search bar).
  const campusId = campusSlug
    ? campuses.find((c) => c.slug === campusSlug)?.id ?? (campuses.some((c) => c.id === campusSlug) ? campusSlug : null)
    : null;

  // Debounced text search — local state, flushes to URL after 300ms.
  const [searchInput, setSearchInput] = useState(s.q ?? "");
  useEffect(() => { setSearchInput(s.q ?? ""); }, [s.q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if ((searchInput || "") === (s.q ?? "")) return;
      navigate({
        to: "/browse",
        search: (prev: BrowseSearch) => ({ ...prev, q: searchInput.trim() || undefined }),
        replace: true,
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function patchSearch(patch: Partial<BrowseSearch>) {
    navigate({ to: "/browse", search: (prev: BrowseSearch) => ({ ...prev, ...patch }) });
  }

  const [view, setView] = useState<View>("grid");
  const mapView = s.view === "map";

  const [selected, setSelected] = useState<Listing | null>(null);
  const [posting, setPosting] = useState(false);
  const [profileViewId, setProfileViewId] = useState<string | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [msgDraft, setMsgDraft] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [saveSearchOpen, setSaveSearchOpen] = useState(false);

  const pinnedSet = useMemo(() => new Set(pinned), [pinned]);
  const pinnedListings = useMemo(
    () => pinned.map(id => listings.find(l => l.id === id)).filter(Boolean) as Listing[],
    [pinned, listings],
  );

  function togglePin(l: Listing) {
    setPinned((prev) => {
      if (prev.includes(l.id)) return prev.filter((id) => id !== l.id);
      if (prev.length >= 3) { toast("Compare up to 3 listings at a time"); return prev; }
      return [...prev, l.id];
    });
  }

  // Hot-deal computation: 15%+ below campus average for same bed count
  const hotIds = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const l of listings) {
      const key = `${l.campus_id ?? ""}|${l.beds}`;
      const arr = groups.get(key) ?? [];
      arr.push(l.price); groups.set(key, arr);
    }
    const avg = new Map<string, number>();
    for (const [k, v] of groups) avg.set(k, v.reduce((a, b) => a + b, 0) / v.length);
    const ids = new Set<string>();
    for (const l of listings) {
      const a = avg.get(`${l.campus_id ?? ""}|${l.beds}`);
      if (a && l.price <= a * 0.85) ids.add(l.id);
    }
    return ids;
  }, [listings]);

  function matchesBeds(l: Listing): boolean {
    if (bedSet.size === 0) return true;
    const b = l.beds ?? 0;
    if (bedSet.has("3+") && b >= 3) return true;
    return bedSet.has(String(b) as BedKey);
  }

  const filtered = useMemo(() => {
    const qLower = (s.q ?? "").toLowerCase();
    let r = listings.filter((l) => {
      if (qLower && !(
        l.title.toLowerCase().includes(qLower) ||
        (l.area ?? "").toLowerCase().includes(qLower) ||
        (l.description ?? "").toLowerCase().includes(qLower)
      )) return false;
      if (s.hostId && l.user_id !== s.hostId) return false;
      if (campusId && l.campus_id !== campusId) return false;
      if (area && l.area !== area) return false;
      if (furnishedOnly && !l.furnished) return false;
      if (s.utilities === 1 && !l.utilities_included) return false;
      if (s.parking === 1 && !l.parking) return false;
      if (s.pets === 1 && !l.pet_friendly) return false;
      if (s.wifi === 1 && !(l as any).wifi_included) return false;
      if (s.laundry === 1 && !(l as any).laundry) return false;
      if (s.baths != null && (l.baths ?? 0) < s.baths) return false;
      if (minPrice != null && (l.price ?? 0) < minPrice) return false;
      if (maxPrice != null && (l.price ?? 0) > maxPrice) return false;
      if (!matchesBeds(l)) return false;
      if (fromDate && l.available_from && new Date(l.available_from) > fromDate) return false;
      if (toDate && l.available_to && new Date(l.available_to) < toDate) return false;

      // Q96 — search-bar / category-pill params
      if (s.tenants != null && (l.beds ?? 0) < Math.ceil(s.tenants / 2)) return false;
      if (s.type === "studio" && (l.beds ?? 0) !== 0) return false;
      if (s.type === "private_room" && (l.beds ?? 0) !== 1) return false;
      if (s.type === "entire" && (l.beds ?? 0) < 1) return false;
      if (s.maxDuration != null) {
        if (!l.available_from || !l.available_to) return false;
        const days = (new Date(l.available_to).getTime() - new Date(l.available_from).getTime()) / 86400000;
        if (!(days > 0 && days <= s.maxDuration)) return false;
      }
      if (s.availableSoon === 1) {
        if (!l.available_from) return false;
        if (new Date(l.available_from).getTime() > Date.now() + 31 * 86400000) return false;
      }
      if (s.postedToday === 1 && Date.now() - new Date(l.created_at).getTime() > 86400000) return false;
      if (s.nearCampus === 1 && !/campus|near|walk/i.test(l.area ?? "")) return false;

      return true;
    });
    if (sort === "price_asc") r = [...r].sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") r = [...r].sort((a, b) => b.price - a.price);
    else if (sort === "popular") r = [...r].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0));
    else r = [...r].sort((a, b) => new Date((b as any).bumped_at ?? b.created_at).getTime() - new Date((a as any).bumped_at ?? a.created_at).getTime());
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, s.q, campusId, area, furnishedOnly, minPrice, maxPrice, bedSet, s.from, s.to, sort,
      s.utilities, s.parking, s.pets, s.wifi, s.laundry, s.baths,
      s.tenants, s.type, s.maxDuration, s.availableSoon, s.postedToday, s.nearCampus]);

  const activeFilterCount =
    (s.q ? 1 : 0) +
    (campusSlug ? 1 : 0) +
    (area ? 1 : 0) +
    (minPrice != null ? 1 : 0) +

    (maxPrice != null ? 1 : 0) +
    (bedSet.size > 0 ? 1 : 0) +
    (s.from ? 1 : 0) +
    (s.to ? 1 : 0) +
    (furnishedOnly ? 1 : 0);

  function clearFilters() {
    navigate({ to: "/browse", search: {} });
    setSearchInput("");
  }


  async function handleSave(listing: Listing) {
    if (!user) { toast.error("Sign in to save listings"); navigate({ to: "/auth", search: { mode: "in" } }); return; }
    const saved = savedIds.has(listing.id);
    qc.setQueryData(["saved", user.id], (prev: Set<string> | undefined) => {
      const s = new Set(prev ?? []);
      if (saved) s.delete(listing.id); else s.add(listing.id);
      return s;
    });
    try { await toggleSaved(user.id, listing.id, saved); }
    catch { qc.invalidateQueries({ queryKey: ["saved", user.id] }); }
  }

  async function handleMessage(listing: Listing) {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "in", next: `/?listing=${listing.id}&message=1` } });
      return;
    }
    if (listing.user_id === user.id) { toast("That's your own listing"); return; }
    const id = await getOrCreateConversation(user.id, listing.user_id, listing.id);
    setMsgDraft(`Hi! I'm interested in ${listing.title}. Is it still available?`);
    setActiveConv(id);
    setMessagesOpen(true);
    setSelected(null);
  }

  async function startConvWith(otherId: string) {
    if (!user) return;
    const id = await getOrCreateConversation(user.id, otherId, null);
    setActiveConv(id);
    setMessagesOpen(true);
    setProfileViewId(null);
  }

  function handlePost() {
    if (!user) { navigate({ to: "/auth", search: { mode: "up", next: "/?post=1" } }); return; }
    setPosting(true);
  }

  if (sessionLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <div>
        {/* Browse sub-tabs */}
        <div className="sticky top-14 z-30 border-b bg-surface">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 text-sm font-bold">
            <span className="rounded-full bg-primary px-3 py-1.5 text-primary-foreground">🏠 Available</span>
            <Link to="/looking" className="rounded-full bg-background px-3 py-1.5 text-muted-foreground hover:text-foreground">🔍 Looking For</Link>
            <Link to="/roommates" className="rounded-full bg-background px-3 py-1.5 text-muted-foreground hover:text-foreground">👥 Rooms &amp; Roommates</Link>
          </div>
        </div>

        {/* Q87 — Airbnb-style sticky search bar + filter modal */}
        <BrowseFilterBar
          values={s as BrowseFilterValues}
          onPatch={(patch) => patchSearch(patch as Partial<BrowseSearch>)}
          onClearAll={clearFilters}
          searchInput={searchInput}
          onSearchInput={setSearchInput}
          resultCount={filtered.length}
          placeLabel={myCampus ? `${myCampus.city}, ${myCampus.state}` : "Search subleases"}
          initialFiltersOpen={s.openFilters === 1}
        />

        <div className="mx-auto max-w-7xl">
          <CampusPills title="Browse by campus" />
        </div>

        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 pt-3">
          <div className={cn("flex rounded-lg bg-background p-1", mapView && "hidden")}>
            <button onClick={() => setView("grid")} className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold", view === "grid" && "bg-surface shadow")}>
              <LayoutGrid className="h-3.5 w-3.5" />Grid
            </button>
            <button onClick={() => setView("scroll")} className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold", view === "scroll" && "bg-surface shadow")}>
              <Flame className="h-3.5 w-3.5" />Scroll
            </button>
          </div>
          <span className="text-xs text-muted-foreground">
            {filtered.length} listing{filtered.length !== 1 ? "s" : ""}
          </span>
          {/* Q90 — grid / map toggle */}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => patchSearch({ view: undefined })}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                mapView ? "border border-border bg-surface text-muted-foreground" : "bg-foreground text-background",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />Grid
            </button>
            <button
              onClick={() => patchSearch({ view: "map" })}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                mapView ? "bg-foreground text-background" : "border border-border bg-surface text-muted-foreground",
              )}
            >
              <MapIcon className="h-3.5 w-3.5" />Map
            </button>
          </div>
          <button
            onClick={() => setSaveSearchOpen(true)}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-dark"
          >
            <Bell className="h-3.5 w-3.5" />Save search
          </button>
        </div>

        {mapView ? (
          <div className="mt-3">
            <BrowseMapView listings={filtered} />
          </div>
        ) : (
        <main className="mx-auto max-w-7xl px-4 py-5">

          {user && <RenterFeedbackPrompt userId={user.id} />}
          {view === "grid" && (
            <TrendingCarousel
              listings={trendingListings}
              campusName={myCampus?.name}
              onOpen={setSelected}
            />
          )}
          {view === "grid" && (
            <Link
              to="/looking"
              className="mb-4 mt-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary-light/40 px-4 py-3 text-sm transition hover:bg-primary-light/70"
            >
              <span className="font-medium text-primary-dark">
                Looking for a sublease? Post your request and let listers come to you.
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-primary">Post a request →</span>
            </Link>
          )}
          {view === "scroll" ? (
            <ScrollView
              listings={filtered}
              savedIds={savedIds}
              onSave={handleSave}
              onMessage={handleMessage}
              onOpen={setSelected}
              pinnedIds={pinnedSet}
              onPin={togglePin}
            />
          ) : isLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 md:gap-5 lg:grid-cols-4 lg:gap-6">

              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-xl bg-surface shadow-card">
                  <div className="lu-shimmer aspect-[4/3] w-full" />
                  <div className="space-y-2 p-3">
                    <div className="lu-shimmer h-5 w-24 rounded" />
                    <div className="lu-shimmer h-4 w-3/4 rounded" />
                    <div className="lu-shimmer h-3 w-1/2 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="text-5xl">🔍</div>
              <h3 className="mt-4 text-xl font-semibold">No subleases match your search</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Try adjusting your filters or searching a different campus.
              </p>
              <button
                onClick={clearFilters}
                className="mt-6 rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-white dark:text-gray-900"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 md:gap-5 lg:grid-cols-4 lg:gap-6">
              {filtered.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  saved={savedIds.has(l.id)}
                  onSave={() => handleSave(l)}
                  onOpen={() => setSelected(l)}
                  pinned={pinnedSet.has(l.id)}
                  onPin={() => togglePin(l)}
                  isHotDeal={hotIds.has(l.id)}
                />
              ))}
            </div>
          )}
        </main>
        )}

      </div>


      <ListingDetailSheet
        listing={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onMessage={handleMessage}
        onViewProfile={(id) => { setSelected(null); setProfileViewId(id); }}
        onSave={handleSave}
        isSaved={selected ? savedIds.has(selected.id) : false}
      />
      <PostListingDialog open={posting} onOpenChange={setPosting} />
      <ProfileSheet
        userId={profileViewId}
        open={!!profileViewId}
        onOpenChange={(o) => !o && setProfileViewId(null)}
        onMessage={startConvWith}
      />
      <MessagesSheet
        open={messagesOpen}
        onOpenChange={(o) => { setMessagesOpen(o); if (!o) setMsgDraft(null); }}
        initialConversationId={activeConv}
        initialDraft={msgDraft}
      />

      <SaveSearchDialog
        open={saveSearchOpen}
        onOpenChange={setSaveSearchOpen}
        filters={{ area, maxPrice: maxPrice ?? 2500, furnishedOnly, keyword: s.q ?? "" }}
      />

      <CompareBar
        listings={pinnedListings}
        onOpen={() => setCompareOpen(true)}
        onClear={() => setPinned([])}
        onRemove={(id) => setPinned((prev) => prev.filter((p) => p !== id))}
      />
      <CompareSheet
        listings={pinnedListings}
        open={compareOpen}
        onOpenChange={setCompareOpen}
        onOpenListing={setSelected}
        onMessage={handleMessage}
        onRemove={(id) => setPinned((prev) => prev.filter((p) => p !== id))}
      />
    </div>
  );
}
