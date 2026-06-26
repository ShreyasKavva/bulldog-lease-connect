import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { BottomNav } from "@/components/leaseup/BottomNav";
import { TopBar } from "@/components/leaseup/TopBar";
import type { Listing } from "@/lib/leaseup/types";
import { LayoutGrid, Flame, Search, Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NEIGHBORHOODS } from "@/lib/leaseup/constants";

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
    enabled: !!user,
  });
  const { data: savedIds = new Set<string>() } = useQuery({
    queryKey: ["saved", user?.id],
    queryFn: () => fetchSavedIds(user!.id),
    enabled: !!user?.id,
  });

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
  const [matchOpen, setMatchOpen] = useState(false);
  const [leaseOpen, setLeaseOpen] = useState(false);
  const [pinned, setPinned] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

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

  const filtered = useMemo(() => {
    let r = listings.filter((l) =>
      (!search || l.title.toLowerCase().includes(search.toLowerCase()) || (l.area ?? "").toLowerCase().includes(search.toLowerCase())) &&
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
    if (!user) { navigate({ to: "/auth", search: { mode: "in" } }); return; }
    if (listing.user_id === user.id) { toast("That's your own listing"); return; }
    const id = await getOrCreateConversation(user.id, listing.user_id, listing.id);
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

  if (sessionLoading || !user) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <TopBar onOpenMessages={() => { setActiveConv(null); setMessagesOpen(true); }} />

      <div className="pt-14">
        {/* Search + filters */}
        <div className="sticky top-14 z-20 border-b bg-surface">
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
              <div className="text-xs text-muted-foreground">{filtered.length} listing{filtered.length !== 1 ? "s" : ""}</div>
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-7xl px-4 py-5">
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl bg-surface p-12 text-center shadow-card">
              <div className="text-5xl">🏠</div>
              <h3 className="mt-3 text-lg font-bold">No listings match your filters</h3>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  saved={savedIds.has(l.id)}
                  onSave={() => handleSave(l)}
                  onOpen={() => setSelected(l)}
                  pinned={pinnedSet.has(l.id)}
                  onPin={() => togglePin(l)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <BottomNav
        onPost={() => setPosting(true)}
        onChat={() => { setActiveConv(null); setMessagesOpen(true); }}
        onProfile={() => setProfileViewId(user.id)}
      />

      <ListingDetailSheet
        listing={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onMessage={handleMessage}
        onViewProfile={(id) => { setSelected(null); setProfileViewId(id); }}
      />
      <PostListingDialog open={posting} onOpenChange={setPosting} />
      <ProfileSheet
        userId={profileViewId}
        open={!!profileViewId}
        onOpenChange={(o) => !o && setProfileViewId(null)}
        onMessage={startConvWith}
      />
      <MessagesSheet open={messagesOpen} onOpenChange={setMessagesOpen} initialConversationId={activeConv} />
      <LeaseAnalysisDialog open={leaseOpen} onOpenChange={setLeaseOpen} />
      <FindMyMatchDialog open={matchOpen} onOpenChange={setMatchOpen} onOpenListing={(l) => setSelected(l)} />

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
