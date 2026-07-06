import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchListings, fetchSavedIds, toggleSaved, getOrCreateConversation } from "@/lib/leaseup/queries";
import { useSession } from "@/lib/leaseup/use-session";
import { ListingCard } from "@/components/leaseup/ListingCard";
import { ListingDetailSheet } from "@/components/leaseup/ListingDetailSheet";
import { PostListingDialog } from "@/components/leaseup/PostListingDialog";
import { ProfileSheet } from "@/components/leaseup/ProfileSheet";
import { MessagesSheet } from "@/components/leaseup/MessagesSheet";
import { ScrollView } from "@/components/leaseup/ScrollView";
import { LeaseAnalysisDialog } from "@/components/leaseup/LeaseAnalysisDialog";
import { FindMyMatchDialog } from "@/components/leaseup/FindMyMatchDialog";
import { CompareBar } from "@/components/leaseup/CompareBar";
import { CompareSheet } from "@/components/leaseup/CompareSheet";

import type { Listing } from "@/lib/leaseup/types";
import { LayoutGrid, Flame, Search, Sparkles, ShieldCheck, Bell } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NEIGHBORHOODS } from "@/lib/leaseup/constants";
import { SaveSearchDialog } from "@/components/leaseup/SaveSearchDialog";
import { TrendingCarousel } from "@/components/leaseup/TrendingCarousel";
import { fetchTrendingIds } from "@/lib/leaseup/referral.queries";
import { useMyProfile } from "@/lib/leaseup/use-session";
import { fetchCampuses } from "@/lib/leaseup/campuses";

export const Route = createFileRoute("/browse")({
  head: () => ({
    meta: [
      { title: "Browse subleases — LeaseUp" },
      { name: "description", content: "Browse every active student sublease as a grid or full-screen scroll." },
    ],
  }),
  component: Browse,
});

type View = "grid" | "scroll";
type Sort = "newest" | "price_asc" | "price_desc";

function Browse() {
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();
  const qc = useQueryClient();

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

  const [view, setView] = useState<View>("grid");
  const [sort, setSort] = useState<Sort>("newest");
  const [search, setSearch] = useState("");
  const [maxPrice, setMaxPrice] = useState(2500);
  const [area, setArea] = useState<string>("");
  const [furnishedOnly, setFurnishedOnly] = useState(false);

  const [selected, setSelected] = useState<Listing | null>(null);
  const [posting, setPosting] = useState(false);
  const [profileViewId, setProfileViewId] = useState<string | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [msgDraft, setMsgDraft] = useState<string | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [leaseOpen, setLeaseOpen] = useState(false);
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let r = listings.filter((l) =>
      (!search ||
        l.title.toLowerCase().includes(q) ||
        (l.area ?? "").toLowerCase().includes(q) ||
        (l.description ?? "").toLowerCase().includes(q)) &&
      l.price <= maxPrice &&
      (!area || l.area === area) &&
      (!furnishedOnly || l.furnished)
    );
    if (sort === "price_asc") r = [...r].sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") r = [...r].sort((a, b) => b.price - a.price);
    return r;
  }, [listings, search, maxPrice, area, furnishedOnly, sort]);

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
            <Link to="/looking-for" className="rounded-full bg-background px-3 py-1.5 text-muted-foreground hover:text-foreground">🔍 Looking For</Link>
            <Link to="/roommates" className="rounded-full bg-background px-3 py-1.5 text-muted-foreground hover:text-foreground">👥 Roommates</Link>
          </div>
        </div>

        {/* Search + filters */}
        <div className="sticky top-[6.5rem] z-20 border-b bg-surface">
          <div className="mx-auto max-w-7xl space-y-2 px-4 py-3">
            <div className="flex items-center gap-2 rounded-full bg-background px-4 h-10">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subleases, neighborhoods…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg bg-background p-1">
                <button onClick={() => setView("grid")} className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold", view === "grid" && "bg-surface shadow")}>
                  <LayoutGrid className="h-3.5 w-3.5" />Grid
                </button>
                <button onClick={() => setView("scroll")} className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold", view === "scroll" && "bg-surface shadow")}>
                  <Flame className="h-3.5 w-3.5" />Scroll
                </button>
              </div>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-8 rounded-md border bg-surface px-2 text-xs font-semibold">
                <option value="newest">Newest</option>
                <option value="price_asc">Price ↑</option>
                <option value="price_desc">Price ↓</option>
              </select>
              <select value={area} onChange={(e) => setArea(e.target.value)} className="h-8 rounded-md border bg-surface px-2 text-xs font-semibold">
                <option value="">All areas</option>
                {NEIGHBORHOODS.map((n) => <option key={n.name}>{n.name}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs font-semibold">
                Max ${maxPrice}
                <input type="range" min={300} max={3000} step={50} value={maxPrice} onChange={(e) => setMaxPrice(parseInt(e.target.value))} />
              </label>
              <label className="flex items-center gap-1.5 text-xs font-semibold">
                <input type="checkbox" checked={furnishedOnly} onChange={(e) => setFurnishedOnly(e.target.checked)} />
                Furnished
              </label>
              <button onClick={() => setMatchOpen(true)} className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary-light px-3 py-1.5 text-xs font-bold text-primary-dark hover:bg-primary/20">
                <Sparkles className="h-3.5 w-3.5" />Find My Match
              </button>
              <button onClick={() => setLeaseOpen(true)} className="inline-flex items-center gap-1 rounded-full bg-primary-light px-3 py-1.5 text-xs font-bold text-primary-dark hover:bg-primary/20">
                <ShieldCheck className="h-3.5 w-3.5" />Lease Bot
              </button>
              <button onClick={() => setSaveSearchOpen(true)} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-dark">
                <Bell className="h-3.5 w-3.5" />Save search
              </button>
              <div className="text-xs text-muted-foreground">{filtered.length} listing{filtered.length !== 1 ? "s" : ""}</div>
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-7xl px-4 py-5">
          {view === "grid" && (
            <TrendingCarousel
              listings={trendingListings}
              campusName={myCampus?.name}
              onOpen={setSelected}
            />
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">

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
            <div className="rounded-xl bg-surface p-12 text-center shadow-card">
              <div className="text-5xl">🏠</div>
              <h3 className="mt-3 text-lg font-bold">No listings match your filters</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
      <LeaseAnalysisDialog open={leaseOpen} onOpenChange={setLeaseOpen} />
      <FindMyMatchDialog open={matchOpen} onOpenChange={setMatchOpen} onOpenListing={(l) => setSelected(l)} />

      <SaveSearchDialog
        open={saveSearchOpen}
        onOpenChange={setSaveSearchOpen}
        filters={{ area, maxPrice, furnishedOnly, keyword: search }}
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
