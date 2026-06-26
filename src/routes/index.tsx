import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchListings, getOrCreateConversation } from "@/lib/leaseup/queries";
import { fetchCampuses } from "@/lib/leaseup/campuses";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { LandingPage } from "@/components/leaseup/LandingPage";
import { MapHome } from "@/components/leaseup/MapHome";
import { BottomNav } from "@/components/leaseup/BottomNav";
import { TopBar } from "@/components/leaseup/TopBar";
import { StoriesBar } from "@/components/leaseup/StoriesBar";
import { ListingDetailSheet } from "@/components/leaseup/ListingDetailSheet";
import { PostListingDialog } from "@/components/leaseup/PostListingDialog";
import { ProfileSheet } from "@/components/leaseup/ProfileSheet";
import { MessagesSheet } from "@/components/leaseup/MessagesSheet";
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

  const myCampus = useMemo(
    () => campuses.find((c) => c.id === profile?.campus_id),
    [campuses, profile?.campus_id],
  );
  const center: [number, number] = myCampus ? [myCampus.lat, myCampus.lng] : UGA_CENTER;

  // Filter listings to user's campus when possible, so the map matches the center.
  const campusListings = useMemo(() => {
    if (!profile?.campus_id) return listings;
    return listings.filter((l) => l.campus_id === profile.campus_id);
  }, [listings, profile?.campus_id]);

  // Hot deal threshold: 15% below average price on this campus
  const hotThreshold = useMemo(() => {
    if (campusListings.length < 4) return undefined;
    const avg = campusListings.reduce((s, l) => s + l.price, 0) / campusListings.length;
    return avg * 0.85;
  }, [campusListings]);

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

  if (sessionLoading) return <div className="min-h-screen bg-background" />;
  if (!user) return <LandingPage />;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <MapHome
        listings={campusListings}
        center={center}
        onSelectListing={setSelected}
        onMessageListing={handleMessage}
        hotThreshold={hotThreshold}
      />

      <TopBar transparent onOpenMessages={() => { setActiveConv(null); setMessagesOpen(true); }} />

      {/* Stories bar floats over the map */}
      <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center px-2">
        <StoriesBar
          campusId={profile?.campus_id ?? null}
          meId={user.id}
          onAddYourStory={() => setPosting(true)}
          onSelectStudent={setProfileViewId}
        />
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
