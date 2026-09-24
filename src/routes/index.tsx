/**
 * HOME ("/") — Airbnb-style public browsing experience.
 *
 * Auth model: everyone (guest + logged-in) sees the same discovery
 * homepage. Auth is only required for high-intent actions:
 *   - Post a listing        → /auth?mode=up&next=/?post=1
 *   - Message a poster      → /auth?mode=in&next=/?listing=ID&message=1
 *   - Save a listing        → /auth?mode=up&next=/?listing=ID&save=1
 *
 * After sign-in the browser is redirected back to `next` and the URL
 * intent (?post / ?message / ?save) is replayed by the effects below.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/leaseup/friendly-error";
import { useToggleSave } from "@/lib/leaseup/use-toggle-save";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { openSignIn } from "@/components/leaseup/SignInModal";
import { fetchListings, getOrCreateConversation, fetchSavedIds, fetchLookingFor, fetchRecentFilledCount, fetchCuratedListings } from "@/lib/leaseup/queries";
import { fetchSpotlightCampuses } from "@/lib/leaseup/campuses";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";

import { AirbnbHome } from "@/components/leaseup/AirbnbHome";
import { CampusPills } from "@/components/leaseup/CampusPills";
import { ListingDetailSheet } from "@/components/leaseup/ListingDetailSheet";
import { PostListingDialog } from "@/components/leaseup/PostListingDialog";
import { ProfileSheet } from "@/components/leaseup/ProfileSheet";
import { MessagesSheet } from "@/components/leaseup/MessagesSheet";
import type { Listing } from "@/lib/leaseup/types";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => {
    const title = "LeaseUp — Student Subleases Near Your Campus";
    const description =
      "Find or post a semester sublease near your college campus. Semester-length stays, free to message the poster directly, no fees.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "theme-color", content: "#111827" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "https://leasup.co/" },
        { property: "og:image", content: "https://leasup.co/og-image.png" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: "https://leasup.co/og-image.png" },
      ],
      links: [{ rel: "canonical", href: "https://leasup.co/" }],
    };
  },

  // Q384/Q391 — seed the first-paint queries on the server (same pattern as
  // the /browse loader) so the SSR HTML already contains the listing rails
  // and the "Explore campuses" grid. Same query keys and functions the
  // page's useQuery calls use below; the client hydrates from this data
  // instead of starting empty.
  //
  // Q391 — the "Just posted" / "Under $600/mo" / "Available this month"
  // rails are SmartSections rows, each with its own query keyed
  // ["home-section", id, query] (see SmartSections.tsx). Seed those exact
  // queries too. At first paint the section scope is empty — campus
  // affinity is SSR-null and the profile hasn't loaded — so the keys below
  // match what SmartSections computes on the server and on the first client
  // render; the seeded queryFn is byte-for-byte the section's own.
  loader: ({ context }) => {
    const seedSection = (id: string, query: Parameters<typeof fetchCuratedListings>[0]) =>
      context.queryClient.ensureQueryData({
        queryKey: ["home-section", id, query],
        queryFn: async () => {
          const rows = await fetchCuratedListings(query);
          // Same widen-on-empty fallback the section queryFn applies.
          if (rows.length === 0 && query.campusId) {
            const { campusId: _drop, ...wide } = query;
            return { rows: await fetchCuratedListings(wide), fellBack: true };
          }
          return { rows, fellBack: false };
        },
      });

    const isoDaysFromNow = (days: number) =>
      new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

    return Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: ["listings"],
        queryFn: fetchListings,
      }),
      context.queryClient.ensureQueryData({
        queryKey: ["spotlight-campuses"],
        queryFn: () => fetchSpotlightCampuses(16),
      }),
      seedSection("new", { limit: 12 }),
      seedSection("cheap", { maxPrice: 600, limit: 12 }),
      seedSection("soon", {
        availableBefore: isoDaysFromNow(31),
        orderBy: "available_from" as const,
        ascending: true,
        limit: 12,
      }),
    ]);
  },

  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading: sessionLoading } = useSession();
  const { data: profile } = useMyProfile();

  // Q384 — the session hook starts with loading=true and only clears it in a
  // browser effect, so gating on it during the server pass (or the first
  // client render) renders an empty page and strips all listing/campus
  // markup from the SSR HTML. Arm the blank gate only after mount; before
  // that, server and first client render produce the full page identically.
  const [sessionGateArmed, setSessionGateArmed] = useState(false);
  useEffect(() => setSessionGateArmed(true), []);

  // Onboarding gate for authed users only.
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
  const { data: listings = [], isLoading: listingsLoading } = useQuery({ queryKey: ["listings"], queryFn: fetchListings });
  const { data: campuses = [] } = useQuery({ queryKey: ["spotlight-campuses"], queryFn: () => fetchSpotlightCampuses(16), staleTime: Infinity });

  // "Latest subleases" feed scope: user's campus, else most active campus.
  const userCampusId = profile?.campus_id ?? null;
  const topCampusId = (() => {
    if (userCampusId) return userCampusId;
    const counts = new Map<string, number>();
    for (const l of listings) counts.set(l.campus_id, (counts.get(l.campus_id) ?? 0) + 1);
    let best: string | null = null; let n = -1;
    for (const [id, c] of counts) if (c > n) { best = id; n = c; }
    return best;
  })();

  const { data: lookingFor = [] } = useQuery({
    queryKey: ["home-looking-for", topCampusId],
    queryFn: () => fetchLookingFor(topCampusId ?? null),
    enabled: campuses.length > 0,
  });

  const { data: filledCount = 0 } = useQuery({
    queryKey: ["home-filled-count", topCampusId],
    queryFn: () => fetchRecentFilledCount(topCampusId ?? null),
  });

  const [selected, setSelected] = useState<Listing | null>(null);
  const [posting, setPosting] = useState(false);
  const [profileViewId, setProfileViewId] = useState<string | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [msgDraft, setMsgDraft] = useState<string | null>(null);

  /** Q105 — open the sign-in modal in place, preserving the intent. */
  function requireAuth(intent: "post" | "message" | "save", ctx?: { listingId?: string }) {
    const params = new URLSearchParams();
    if (ctx?.listingId) params.set("listing", ctx.listingId);
    params.set(intent, "1");
    openSignIn(`/?${params.toString()}`);
  }

  async function handleMessage(listing: Listing) {
    if (!user) { requireAuth("message", { listingId: listing.id }); return; }
    if (listing.user_id === user.id) { toast("That's your own listing"); return; }
    try {
      const id = await getOrCreateConversation(user.id, listing.user_id, listing.id);
      setMsgDraft(`Hi! I'm interested in ${listing.title}. Is it still available?`);
      setActiveConv(id);
      setMessagesOpen(true);
      setSelected(null);
    } catch (e: any) { toast.error(friendlyError(e)); }
  }

  const toggleSave = useToggleSave(user?.id);

  function handleSave(listing: Listing) {
    if (!user) { requireAuth("save", { listingId: listing.id }); return; }
    void toggleSave(listing.id);
  }


  function handlePost() {
    if (!user) { requireAuth("post"); return; }
    setPosting(true);
  }

  async function startConvWith(otherId: string) {
    if (!user) return;
    try {
      const id = await getOrCreateConversation(user.id, otherId, null);
      setActiveConv(id);
      setMessagesOpen(true);
      setProfileViewId(null);
    } catch (e) { toast.error(friendlyError(e, "Couldn't open that conversation. Try again.")); }
  }

  // Cross-component "open this listing" event (used by "People also saved" etc.)
  useEffect(() => {
    function onOpen(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      const l = listings.find((x) => x.id === id);
      if (l) setSelected(l);
    }
    window.addEventListener("lu:open-listing", onOpen as EventListener);
    return () => window.removeEventListener("lu:open-listing", onOpen as EventListener);
  }, [listings]);

  // Replay URL intent: ?listing=ID (&message=1 | &save=1) or ?post=1
  useEffect(() => {
    if (listings.length === 0 && !posting) return;
    const url = new URL(window.location.href);
    const listingId = url.searchParams.get("listing");
    const wantsMessage = url.searchParams.get("message") === "1";
    const wantsSave = url.searchParams.get("save") === "1";
    const wantsPost = url.searchParams.get("post") === "1";

    if (listingId) {
      const l = listings.find((x) => x.id === listingId);
      if (l) {
        setSelected(l);
        if (wantsMessage && user) handleMessage(l);
        if (wantsSave && user) handleSave(l);
      }
    }
    if (wantsPost && user) setPosting(true);

    if (wantsMessage || wantsSave || wantsPost) {
      url.searchParams.delete("message");
      url.searchParams.delete("save");
      url.searchParams.delete("post");
      window.history.replaceState({}, "", url.toString());
    }
  }, [listings, user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (sessionGateArmed && sessionLoading) return <div className="min-h-screen bg-background" />;

  return (
    <>
      <AirbnbHome
        listings={listings}
        campuses={campuses}
        savedIds={savedIds}
        onSave={handleSave}
        onOpen={setSelected}
        onMessage={handleMessage}
        onPost={handlePost}
        userCampusId={userCampusId}
        feedCampusId={topCampusId}
        lookingForPosts={lookingFor}
        recentFilledCount={filledCount}
        loading={listingsLoading}
      />

      <CampusPills title="Popular campuses" highlightLast />




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
    </>
  );
}
