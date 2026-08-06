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
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchListings, getOrCreateConversation, fetchSavedIds, toggleSaved, fetchLookingFor, fetchRecentFilledCount } from "@/lib/leaseup/queries";
import { fetchCampuses } from "@/lib/leaseup/campuses";
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
  head: () => ({
    meta: [
      { title: "LeaseUp — Student subleases at your campus" },
      { name: "description", content: "Browse verified student subleases at campuses nationwide. Find your perfect place — no sign-up required." },
      { name: "theme-color", content: "#111827" },
      { property: "og:title", content: "LeaseUp — Student subleases" },
      { property: "og:description", content: "Student subleases at your campus. Verified .edu emails, real listings, no fees." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading: sessionLoading } = useSession();
  const { data: profile } = useMyProfile();

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
  const { data: listings = [] } = useQuery({ queryKey: ["listings"], queryFn: fetchListings });
  const { data: campuses = [] } = useQuery({ queryKey: ["campuses"], queryFn: fetchCampuses, staleTime: Infinity });

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

  /** Redirect to /auth preserving the current URL + an intent flag. */
  function requireAuth(intent: "post" | "message" | "save", ctx?: { listingId?: string }) {
    const params = new URLSearchParams();
    if (ctx?.listingId) params.set("listing", ctx.listingId);
    params.set(intent, "1");
    const next = `/?${params.toString()}`;
    navigate({ to: "/auth", search: { mode: intent === "message" ? "in" : "up", next } });
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
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleSave(listing: Listing) {
    if (!user) { requireAuth("save", { listingId: listing.id }); return; }
    const isSaved = savedIds.has(listing.id);
    try {
      await toggleSaved(user.id, listing.id, !isSaved);
      qc.invalidateQueries({ queryKey: ["saved", user.id] });
    } catch (e: any) { toast.error(e.message); }
  }

  function handlePost() {
    if (!user) { requireAuth("post"); return; }
    setPosting(true);
  }

  async function startConvWith(otherId: string) {
    if (!user) return;
    const id = await getOrCreateConversation(user.id, otherId, null);
    setActiveConv(id);
    setMessagesOpen(true);
    setProfileViewId(null);
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

  if (sessionLoading) return <div className="min-h-screen bg-background" />;

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
      />

      <CampusPills />




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
