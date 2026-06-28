import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchListings, getOrCreateConversation, fetchSavedIds, toggleSaved } from "@/lib/leaseup/queries";
import { fetchCampuses, type Campus } from "@/lib/leaseup/campuses";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";

import { ScrollView } from "@/components/leaseup/ScrollView";
import { MapHome } from "@/components/leaseup/MapHome";
import { BottomNav } from "@/components/leaseup/BottomNav";
import { TopBar } from "@/components/leaseup/TopBar";
import { StoriesBar } from "@/components/leaseup/StoriesBar";
import { ListingDetailSheet } from "@/components/leaseup/ListingDetailSheet";
import { PostListingDialog } from "@/components/leaseup/PostListingDialog";
import { ProfileSheet } from "@/components/leaseup/ProfileSheet";
import { MessagesSheet } from "@/components/leaseup/MessagesSheet";
import { MapCampusSelector } from "@/components/leaseup/MapCampusSelector";
import { MapFilters, DEFAULT_FILTERS, type MapFiltersValue } from "@/components/leaseup/MapFilters";
import { MapEmptyState } from "@/components/leaseup/MapEmptyState";
import { GuestRibbon } from "@/components/leaseup/GuestRibbon";
import { ProfileCompletionBanner } from "@/components/leaseup/ProfileCompletionBanner";
import { UGA_CENTER } from "@/lib/leaseup/constants";
import type { Listing } from "@/lib/leaseup/types";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LeaseUp — Live map of subleases at your campus" },
      { name: "description", content: "Open the app, see every sublease pinned on the map of your campus. Real students, verified listings, instant messaging." },
      { property: "og:title", content: "LeaseUp — Map-first student subleases" },
      { property: "og:description", content: "Snapchat-style map of student subleases. Verified .edu students. SafeScore on every listing." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Home,
});

const GUEST_CAMPUS_KEY = "leaseup_guest_campus_id";

function Home() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading: sessionLoading } = useSession();
  const { data: profile } = useMyProfile();

  // First-run onboarding gate. Send authenticated users who haven't finished
  // the welcome flow to /onboarding before showing the home feed.
  useEffect(() => {
    if (user && profile && profile.onboarding_completed === false) {
      navigate({ to: "/onboarding" });
    }
  }, [user, profile?.onboarding_completed, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: savedIds = new Set<string>() } = useQuery({
    queryKey: ["saved", user?.id],
    queryFn: () => fetchSavedIds(user!.id),
    enabled: !!user?.id,
  });

  const { data: listings = [] } = useQuery({
    queryKey: ["listings"],
    queryFn: fetchListings,
  });
  const { data: campuses = [] } = useQuery({
    queryKey: ["campuses"],
    queryFn: fetchCampuses,
    staleTime: Infinity,
  });

  // For guests, remember campus choice in localStorage. For users, follow their profile.
  const [guestCampusId, setGuestCampusId] = useState<string | null>(null);
  useEffect(() => {
    if (user) return;
    try {
      const v = localStorage.getItem(GUEST_CAMPUS_KEY);
      if (v) setGuestCampusId(v);
    } catch {}
  }, [user]);

  const activeCampusId = user ? profile?.campus_id ?? null : guestCampusId;
  const activeCampus = useMemo(
    () => campuses.find((c) => c.id === activeCampusId) ?? null,
    [campuses, activeCampusId],
  );
  const center: [number, number] = activeCampus
    ? [activeCampus.lat, activeCampus.lng]
    : UGA_CENTER;

  // Filter listings to the active campus when one is set.
  const campusListings = useMemo(() => {
    if (!activeCampusId) return listings;
    return listings.filter((l) => l.campus_id === activeCampusId);
  }, [listings, activeCampusId]);

  // Hot deal threshold: 15% below average price on this campus
  const hotThreshold = useMemo(() => {
    if (campusListings.length < 4) return undefined;
    const avg = campusListings.reduce((s, l) => s + l.price, 0) / campusListings.length;
    return avg * 0.85;
  }, [campusListings]);

  // Floating filters
  const [filters, setFilters] = useState<MapFiltersValue>(DEFAULT_FILTERS);
  const filteredListings = useMemo(() => {
    return campusListings.filter((l) => {
      if (filters.type !== "all" && l.type !== filters.type) return false;
      if (filters.maxPrice != null && l.price > filters.maxPrice) return false;
      if (filters.minBeds != null && l.beds < filters.minBeds) return false;
      if (filters.hotOnly && (hotThreshold == null || l.price > hotThreshold)) return false;
      return true;
    });
  }, [campusListings, filters, hotThreshold]);

  const [selected, setSelected] = useState<Listing | null>(null);
  const [posting, setPosting] = useState(false);
  const [profileViewId, setProfileViewId] = useState<string | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [activeConv, setActiveConv] = useState<string | null>(null);

  // Open listing via ?listing= URL param
  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("listing");
    if (id && listings.length) {
      const l = listings.find((x) => x.id === id);
      if (l) setSelected(l);
    }
  }, [listings]);

  // Cross-component "open this listing" event (used by People also saved)
  useEffect(() => {
    function onOpen(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      const l = listings.find((x) => x.id === id);
      if (l) setSelected(l);
    }
    window.addEventListener("lu:open-listing", onOpen as EventListener);
    return () => window.removeEventListener("lu:open-listing", onOpen as EventListener);
  }, [listings]);

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
    setProfileViewId(null);
  }

  async function handleSave(listing: Listing) {
    if (!user) { gotoAuth("up"); return; }
    const isSaved = savedIds.has(listing.id);
    try {
      await toggleSaved(user.id, listing.id, !isSaved);
      qc.invalidateQueries({ queryKey: ["saved", user.id] });
    } catch (e: any) { toast.error(e.message); }
  }

  function handleGuestPickCampus(c: Campus) {
    setGuestCampusId(c.id);
    try { localStorage.setItem(GUEST_CAMPUS_KEY, c.id); } catch {}
  }

  function gotoAuth(mode: "in" | "up") {
    navigate({ to: "/auth", search: { mode } });
  }

  if (sessionLoading) return <div className="min-h-screen bg-background" />;

  const showEmpty = campusListings.length === 0 && !!activeCampus;
  const showFilteredEmpty =
    !showEmpty && campusListings.length > 0 && filteredListings.length === 0;

  // Logged-in users: full-screen snap-scroll feed (TikTok/Reels-style).
  if (user) {
    const feedListings = campusListings.length ? campusListings : listings;
    return (
      <div className="relative h-[100dvh] w-screen overflow-hidden bg-black">
        {feedListings.length > 0 ? (
          <ScrollView
            fullBleed
            listings={feedListings}
            savedIds={savedIds}
            onSave={handleSave}
            onMessage={handleMessage}
            onOpen={setSelected}
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-primary to-primary-dark px-6 text-center text-white">
            <div>
              <div className="animate-bounce text-7xl">🏠</div>
              <h2 className="mt-4 text-2xl font-bold">No listings yet</h2>
              <p className="mt-1 text-sm text-white/80">Be the first to post a sublease on your campus.</p>
              <button
                onClick={() => setPosting(true)}
                className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-bold text-primary shadow-lg hover:scale-105 transition-transform"
              >
                Post a listing
              </button>
            </div>
          </div>
        )}

        {/* Top: wordmark + bell only (transparent) */}
        <TopBar
          transparent
          onOpenMessages={() => { setActiveConv(null); setMessagesOpen(true); }}
        />

        {/* Floating Stories bar below the top bar */}
        <div className="pointer-events-none absolute inset-x-0 top-14 z-20 px-3 pt-2">
          <div className="pointer-events-auto rounded-2xl bg-black/30 px-3 py-2 backdrop-blur">
            <StoriesBar
              campusId={activeCampusId}
              meId={user.id}
              onAddYourStory={() => setPosting(true)}
              onSelectStudent={setProfileViewId}
            />
          </div>
          <div className="pointer-events-auto mt-2">
            <ProfileCompletionBanner />
          </div>
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
        <MessagesSheet
          open={messagesOpen}
          onOpenChange={setMessagesOpen}
          initialConversationId={activeConv}
        />
      </div>
    );
  }

  // Guests: map-first experience with campus picker.
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <MapHome
        listings={filteredListings}
        center={center}
        onSelectListing={setSelected}
        onMessageListing={handleMessage}
        hotThreshold={hotThreshold}
      />

      <TopBar transparent onOpenMessages={() => gotoAuth("in")} />

      <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex flex-col items-center gap-2 px-3 pt-2">
        <MapCampusSelector
          activeId={activeCampusId}
          onSelect={(c) => handleGuestPickCampus(c)}
        />
        <div className="w-full max-w-md">
          <MapFilters value={filters} onChange={setFilters} />
        </div>
        {filteredListings.length > 0 && (
          <span className="pointer-events-none rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-bold text-foreground shadow-card-sm backdrop-blur">
            {filteredListings.length} {filteredListings.length === 1 ? "listing" : "listings"}
            {activeCampus ? ` near ${activeCampus.short_name ?? activeCampus.name}` : ""}
          </span>
        )}
      </div>

      {showEmpty && (
        <MapEmptyState
          campusName={activeCampus.short_name ?? activeCampus.name}
          onPost={() => gotoAuth("up")}
        />
      )}

      {showFilteredEmpty && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center px-4">
          <div className="pointer-events-auto rounded-2xl bg-surface/95 px-4 py-3 text-center shadow-card-md backdrop-blur">
            <div className="text-sm font-bold">No matches</div>
            <button onClick={() => setFilters(DEFAULT_FILTERS)} className="mt-1 text-xs font-semibold text-primary hover:underline">
              Reset filters
            </button>
          </div>
        </div>
      )}

      <BottomNav
        onPost={() => gotoAuth("up")}
        onChat={() => gotoAuth("in")}
        onProfile={() => gotoAuth("in")}
      />

      <GuestRibbon />

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
      <MessagesSheet
        open={messagesOpen}
        onOpenChange={setMessagesOpen}
        initialConversationId={activeConv}
      />
    </div>
  );
}
