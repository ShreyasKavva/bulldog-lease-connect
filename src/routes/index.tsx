import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchListings, fetchSavedIds, toggleSaved, getOrCreateConversation } from "@/lib/leaseup/queries";
import { useSession } from "@/lib/leaseup/use-session";
import { Nav } from "@/components/leaseup/Nav";
import { ListingCard } from "@/components/leaseup/ListingCard";
import { ListingDetailSheet } from "@/components/leaseup/ListingDetailSheet";
import { PostListingDialog } from "@/components/leaseup/PostListingDialog";
import { ProfileSheet } from "@/components/leaseup/ProfileSheet";
import { MessagesSheet } from "@/components/leaseup/MessagesSheet";
import { MapView } from "@/components/leaseup/MapView";
import { LeaseAnalysisDialog } from "@/components/leaseup/LeaseAnalysisDialog";
import { FindMyMatchDialog } from "@/components/leaseup/FindMyMatchDialog";
import type { Listing } from "@/lib/leaseup/types";
import { LayoutGrid, Map as MapIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NEIGHBORHOODS } from "@/lib/leaseup/constants";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LeaseUp — Student Subleases at UGA" },
      { name: "description", content: "Browse and post student subleases in Athens, GA. Built for UGA students." },
      { property: "og:title", content: "LeaseUp — Student Subleases at UGA" },
      { property: "og:description", content: "The trusted student lease marketplace at UGA." },
    ],
  }),
  component: Home,
});

type View = "grid" | "map";
type Sort = "newest" | "price_asc" | "price_desc";

function Home() {
  const navigate = useNavigate();
  const { user } = useSession();
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

  const [view, setView] = useState<View>("grid");
  const [sort, setSort] = useState<Sort>("newest");
  const [search, setSearch] = useState("");
  const [maxPrice, setMaxPrice] = useState(2500);
  const [area, setArea] = useState<string>("");
  const [furnishedOnly, setFurnishedOnly] = useState(false);

  const [selected, setSelected] = useState<Listing | null>(null);
  const [posting, setPosting] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [leaseOpen, setLeaseOpen] = useState(false);

  // Open listing via ?listing= URL param
  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("listing");
    if (id && listings.length) {
      const l = listings.find(x => x.id === id);
      if (l) setSelected(l);
    }
  }, [listings]);

  const filtered = useMemo(() => {
    let r = listings.filter(l =>
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
    try {
      const id = await getOrCreateConversation(user.id, listing.user_id, listing.id);
      setActiveConv(id);
      setMessagesOpen(true);
      setSelected(null);
    } catch (e: any) { toast.error(e.message); }
  }

  async function startConvWith(otherId: string) {
    if (!user) return;
    const id = await getOrCreateConversation(user.id, otherId, null);
    setActiveConv(id);
    setMessagesOpen(true);
    setProfileId(null);
  }

  function handlePost() {
    if (!user) { navigate({ to: "/auth", search: { mode: "in" } }); return; }
    setPosting(true);
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <Nav
        onPost={handlePost}
        onOpenMessages={() => user ? (setActiveConv(null), setMessagesOpen(true)) : navigate({ to: "/auth", search: { mode: "in" } })}
        onOpenProfile={() => user ? setProfileId(user.id) : navigate({ to: "/auth", search: { mode: "in" } })}
        onOpenMatch={() => setMatchOpen(true)}
        onOpenLease={() => user ? setLeaseOpen(true) : navigate({ to: "/auth", search: { mode: "in" } })}
        search={search}
        onSearch={setSearch}
      />

      {/* Hero / filters bar */}
      <div className="border-b bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-background p-1">
            <button onClick={() => setView("grid")} className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold", view === "grid" && "bg-surface shadow")}>
              <LayoutGrid className="h-3.5 w-3.5" />Grid
            </button>
            <button onClick={() => setView("map")} className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold", view === "map" && "bg-surface shadow")}>
              <MapIcon className="h-3.5 w-3.5" />Map
            </button>
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-8 rounded-md border bg-surface px-2 text-xs font-semibold">
            <option value="newest">Newest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
          </select>
          <select value={area} onChange={(e) => setArea(e.target.value)} className="h-8 rounded-md border bg-surface px-2 text-xs font-semibold">
            <option value="">All areas</option>
            {NEIGHBORHOODS.map(n => <option key={n.name}>{n.name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs font-semibold">
            Max ${maxPrice}
            <input type="range" min={300} max={3000} step={50} value={maxPrice} onChange={(e) => setMaxPrice(parseInt(e.target.value))} />
          </label>
          <label className="flex items-center gap-1.5 text-xs font-semibold">
            <input type="checkbox" checked={furnishedOnly} onChange={(e) => setFurnishedOnly(e.target.checked)} />
            Furnished
          </label>
          <div className="ml-auto text-xs text-muted-foreground">{filtered.length} listing{filtered.length !== 1 ? "s" : ""}</div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-5">
        {view === "map" ? (
          <MapView listings={filtered} onSelect={setSelected} />
        ) : isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-surface p-12 text-center shadow-card">
            <div className="text-5xl">🏠</div>
            <h3 className="mt-3 text-lg font-bold">No listings yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Be the first to post a sublease at UGA.</p>
            <button onClick={handlePost} className="mt-4 inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-dark">
              <Plus className="h-4 w-4" />Post a listing
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(l => (
              <ListingCard
                key={l.id} listing={l} saved={savedIds.has(l.id)}
                onSave={() => handleSave(l)}
                onOpen={() => setSelected(l)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating post button on mobile */}
      <button onClick={handlePost} className="fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-card-lg hover:bg-primary-dark sm:hidden">
        <Plus className="h-6 w-6" />
      </button>

      <ListingDetailSheet
        listing={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onMessage={handleMessage}
        onViewProfile={(id) => { setSelected(null); setProfileId(id); }}
      />

      <PostListingDialog open={posting} onOpenChange={setPosting} />

      <ProfileSheet
        userId={profileId}
        open={!!profileId}
        onOpenChange={(o) => !o && setProfileId(null)}
        onMessage={startConvWith}
      />

      <MessagesSheet
        open={messagesOpen}
        onOpenChange={setMessagesOpen}
        initialConversationId={activeConv}
      />
    </div>
  );
}
