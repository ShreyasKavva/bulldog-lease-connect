import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchListings, getOrCreateConversation } from "@/lib/leaseup/queries";
import { fetchCampuses, type Campus } from "@/lib/leaseup/campuses";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";

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
  const { user, loading: sessionLoading } = useSession();
  const { data: profile } = useMyProfile();

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

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <MapHome
        listings={filteredListings}
        center={center}
        onSelectListing={setSelected}
        onMessageListing={handleMessage}
        hotThreshold={hotThreshold}
      />

      <TopBar
        transparent
        onOpenMessages={() => user ? (setActiveConv(null), setMessagesOpen(true)) : gotoAuth("in")}
      />

      {/* Overlay column: campus selector + filters + stories */}
      <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex flex-col items-center gap-2 px-3 pt-2">
        <MapCampusSelector
          activeId={activeCampusId}
          onSelect={(c) => {
            if (user) {
              // Authenticated users: deep-link to the campus SEO page for now;
              // they can change their primary campus from Profile.
              navigate({ to: "/sublease/$slug", params: { slug: c.slug } });
            } else {
              handleGuestPickCampus(c);
            }
          }}
        />
        <div className="w-full max-w-md">
          <MapFilters value={filters} onChange={setFilters} />
        </div>
        <div className="w-full">
          <StoriesBar
            campusId={activeCampusId}
            meId={user?.id ?? ""}
            onAddYourStory={() => user ? setPosting(true) : gotoAuth("up")}
            onSelectStudent={setProfileViewId}
          />
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
          onPost={() => user ? setPosting(true) : gotoAuth("up")}
        />
      )}

      {showFilteredEmpty && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center px-4">
          <div className="pointer-events-auto rounded-2xl bg-surface/95 px-4 py-3 text-center shadow-card-md backdrop-blur">
            <div className="text-sm font-bold">No matches</div>
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="mt-1 text-xs font-semibold text-primary hover:underline"
            >
              Reset filters
            </button>
          </div>
        </div>
      )}

      <BottomNav
        onPost={() => user ? setPosting(true) : gotoAuth("up")}
        onChat={() => user ? (setActiveConv(null), setMessagesOpen(true)) : gotoAuth("in")}
        onProfile={() => user ? setProfileViewId(user.id) : gotoAuth("in")}
      />

      {!user && <GuestRibbon />}

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
