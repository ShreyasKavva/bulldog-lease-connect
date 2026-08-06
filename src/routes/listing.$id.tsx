/**
 * Public listing detail page — /listing/$id.
 *
 * Airbnb-style layout: full-width photo gallery, two-column details + sticky
 * poster card on desktop, single column + sticky mobile CTA on mobile.
 *
 * Kept intentionally lean vs. ListingDetailSheet — this page's job is
 * conversion + shareable URL + SEO. Power-user features (reactions, secure
 * deposit, tour booking, report) stay in the slide-in sheet.
 */
import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";
import { openSignIn } from "@/components/leaseup/SignInModal";
import { openSaveToCollection } from "@/components/leaseup/SaveToCollectionModal";
import { ListingCard } from "@/components/leaseup/ListingCard";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { markListingFilled, toggleSaved, fetchSavedIds, fetchLookingForMatchesForListing, getOrCreateConversation, bumpListing } from "@/lib/leaseup/queries";
import { fetchListingDailyStats, fetchListingMessageStats } from "@/lib/leaseup/analytics.queries";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ShareSheet } from "@/components/leaseup/ShareSheet";
import { ScrollRow } from "@/components/leaseup/SmartSections";
import { ListingRatingSummary, ListingReviewsSection } from "@/components/leaseup/ListingReviews";
import { AvailabilityCalendar } from "@/components/leaseup/AvailabilityCalendar";
import { HostProfileCard } from "@/components/leaseup/HostProfileCard";
import { timeAgo } from "@/lib/leaseup/constants";
import type { Listing, LookingForPost, Profile } from "@/lib/leaseup/types";
import {
  Home, Bed, Bath, MapPin, Calendar, BadgeCheck, Eye, Bookmark, Clock,
  Sofa, Snowflake, Car, WashingMachine, PawPrint, Zap, Wifi as WifiIcon, X as XIcon,
  ChevronLeft, ChevronRight, ArrowRight, Pencil, CheckCircle2, Heart, Share2, ArrowUp,
  MoreHorizontal, Flag, Grid2x2, Loader2,
} from "lucide-react";
import { ReportListingDialog } from "@/components/leaseup/ReportListingDialog";
import { InlinePriceBadge } from "@/components/leaseup/PriceBadge";
import { ListerFeedbackModal } from "@/components/leaseup/ListerFeedbackModal";
import {
  buildDiscordText, buildGroupMeText, copyToClipboard, recordShare,
  shareToDiscord, shareToGroupMe, withUtm,
} from "@/lib/leaseup/share";




export const Route = createFileRoute("/listing/$id")({
  head: ({ params, loaderData }) => {
    const l = (loaderData as { listing?: Listing & { campus?: { name: string; short_name: string } | null } } | undefined)?.listing;
    const url = `https://leasup.co/listing/${params.id}`;
    if (!l) {
      return {
        meta: [{ title: "Listing — LeaseUp" }, { name: "robots", content: "noindex" }],
      };
    }
    const bedStr = l.beds === 0 ? "Studio" : `${l.beds}BR`;
    const baStr = `${Number(l.baths)}BA`;
    const where = [l.area, (l as any).campus?.short_name].filter(Boolean).join(", ");
    const fmtDate = (iso: string | null) =>
      iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
    const range = l.available_from && l.available_to
      ? ` · Available ${fmtDate(l.available_from)}–${fmtDate(l.available_to)}`
      : "";
    const desc = `${bedStr}/${baStr}${where ? ` in ${where}` : ""} · $${l.price}/mo${range}`;
    const title = `${l.title} — LeaseUp`;
    const img = l.photo_urls?.[0];
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: img ? "summary_large_image" : "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: desc },
    ];
    if (img) {
      meta.push({ property: "og:image", content: img });
      meta.push({ name: "twitter:image", content: img });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
    };
  },

  loader: async ({ params }) => {
    const result = await fetchListingDetail(params.id);
    if (!result) throw notFound({ data: { reason: "deleted" } });
    if (result.reason) throw notFound({ data: { reason: result.reason } });
    return { listing: result.listing };
  },
  notFoundComponent: ({ data }) => {
    const reason = (data as { reason?: "expired" | "rented" | "deleted" } | undefined)?.reason ?? "deleted";
    const copy =
      reason === "expired"
        ? {
            title: "This sublease has expired.",
            body: "The listing period has passed. Browse active subleases instead.",
          }
        : reason === "rented"
        ? {
            title: "This sublease has been rented.",
            body: "The lister found a renter. Browse other available subleases.",
          }
        : {
            title: "This listing is no longer available.",
            body: "It may have been removed, or the link is broken.",
          };
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-[60vh] max-w-md items-center px-6 py-16">
          <div className="w-full rounded-2xl border border-border bg-card p-8 text-center shadow-card">
            <h1 className="text-2xl font-black leading-tight">{copy.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
            <Link
              to="/browse"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary-dark"
            >
              Browse active subleases →
            </Link>
          </div>
        </div>
      </div>
    );
  },
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="mb-2 text-2xl font-black">Couldn't load this listing</h1>
        <p className="mb-6 text-sm text-muted-foreground">{error.message}</p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  ),
  pendingMs: 200,
  pendingComponent: () => (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="h-6 w-40 animate-pulse rounded bg-gray-200 dark:bg-muted" />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="aspect-[4/3] animate-pulse rounded-2xl bg-gray-200 dark:bg-muted" />
          <div className="hidden aspect-[4/3] animate-pulse rounded-2xl bg-gray-200 sm:block dark:bg-muted" />
        </div>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <div className="h-7 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-muted" />
            <div className="h-24 w-full animate-pulse rounded bg-gray-200 dark:bg-muted" />
          </div>
          <div className="h-56 animate-pulse rounded-2xl bg-gray-200 dark:bg-muted" />
        </div>
      </div>
    </div>
  ),
  component: ListingDetailPage,
});

// ---------------- data ----------------

type PublicPoster = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  avatar_emoji: string | null;
  banner_color: string | null;
  verified_email: boolean;
  year: string | null;
  campus_name: string | null;
  active_listing_count: number;
  created_at: string | null;
  last_seen?: string | null;
};

type ListingWithCampus = Listing & { campus?: { name: string; short_name: string; slug: string } | null };
type ListingLoadResult =
  | { listing: ListingWithCampus; reason?: undefined }
  | { listing?: undefined; reason: "expired" | "rented" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchListingDetail(id: string): Promise<ListingLoadResult | null> {
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as any;
  if (row.status === "filled") return { reason: "rented" };
  const today = new Date().toISOString().slice(0, 10);
  if (row.available_to && row.available_to < today) return { reason: "expired" };
  if (row.is_active === false) return null;
  const all: string[] = row.photos ?? [];
  const isUrl = (p: string) => /^https?:\/\//i.test(p);
  const paths = all.filter((p) => !isUrl(p));
  let photo_urls: string[] = [];
  if (all.length) {
    const { data: signed } = paths.length
      ? await supabase.storage.from("listing-photos").createSignedUrls(paths, 60 * 60 * 24 * 7)
      : { data: null };
    photo_urls = all
      .map((p) => (isUrl(p) ? p : signed?.find((sg) => sg.path === p)?.signedUrl ?? ""))
      .filter(Boolean);
  }
  const { data: campus } = await supabase
    .from("campuses")
    .select("name, short_name, slug")
    .eq("id", row.campus_id)
    .maybeSingle();
  return { listing: { ...row, photo_urls, campus: campus ?? null } };
}

async function fetchPoster(userId: string): Promise<PublicPoster | null> {
  const { data, error } = await supabase.rpc("get_public_profile", { _uid: userId });
  if (error) throw error;
  return (data as any) ?? null;
}

async function fetchSavedCount(id: string): Promise<number> {
  const { data } = await supabase
    .from("saved_listing_counts" as any)
    .select("save_count")
    .eq("listing_id", id)
    .maybeSingle();
  return ((data as any)?.save_count as number | undefined) ?? 0;
}

/**
 * Q100 — "Similar subleases": up to 6 other active listings that share the
 * campus (ideally within 30% of the price) or the property type. Fails
 * silently: a query error returns [] rather than crashing the detail page.
 */
async function fetchSimilar(l: Listing): Promise<Listing[]> {
  try {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("is_active", true)
      .eq("status", "active")
      .neq("id", l.id)
      .or(`campus_id.eq.${l.campus_id},type.eq.${l.type}`)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) return [];
    const rows = (data ?? []) as any[];
    const lo = l.price * 0.7;
    const hi = l.price * 1.3;
    const rank = (r: any) => {
      const sameCampus = r.campus_id === l.campus_id;
      if (sameCampus && r.price >= lo && r.price <= hi) return 0;
      if (sameCampus) return 1;
      return 2;
    };
    rows.sort((a, b) => {
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
      return String(b.created_at).localeCompare(String(a.created_at));
    });
    const trimmed = rows.slice(0, 6);
    const paths = trimmed.flatMap((r) => r.photos ?? []);
    const urlMap = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from("listing-photos")
        .createSignedUrls(paths, 60 * 60 * 24 * 7);
      signed?.forEach((s) => { if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl); });
    }
    return trimmed.map((r) => ({
      ...r,
      photo_urls: (r.photos ?? [])
        .map((p: string) => (/^https?:\/\//i.test(p) ? p : urlMap.get(p) ?? ""))
        .filter(Boolean),
    })) as Listing[];
  } catch {
    return [];
  }
}


// ---------------- component ----------------

function ListingDetailPage() {
  const { listing } = Route.useLoaderData();
  const { user } = useSession();
  const navigate = useNavigate();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [bumpOpen, setBumpOpen] = useState(false);
  const [bumping, setBumping] = useState(false);
  const [bumpedAt, setBumpedAt] = useState<string | null>(((listing as any).bumped_at as string | null) ?? null);

  const isOwner = user?.id === listing.user_id;
  const photos = listing.photo_urls ?? [];

  const { data: poster } = useQuery({
    queryKey: ["listing-poster", listing.user_id],
    queryFn: () => fetchPoster(listing.user_id),
    staleTime: 60_000,
  });
  const qc = useQueryClient();
  const { data: savedCount = 0 } = useQuery({
    queryKey: ["listing-saved-count", listing.id],
    queryFn: () => fetchSavedCount(listing.id),
  });
  const { data: savedIds = new Set<string>() } = useQuery({
    queryKey: ["saved", user?.id],
    queryFn: () => fetchSavedIds(user!.id),
    enabled: !!user,
  });
  const isSaved = savedIds.has(listing.id);

  // Owner-only activity panel data
  const { data: dailyStats = [] } = useQuery({
    queryKey: ["listing-daily-stats", listing.id],
    queryFn: () => fetchListingDailyStats(listing.id, 14),
    enabled: isOwner,
    staleTime: 60_000,
  });
  const { data: msgStats } = useQuery({
    queryKey: ["listing-msg-stats", listing.id, listing.user_id],
    queryFn: () => fetchListingMessageStats(listing.id, listing.user_id),
    enabled: isOwner,
    staleTime: 60_000,
  });
  const viewsThisWeek = dailyStats.slice(-7).reduce((s, d) => s + (d.views ?? 0), 0)
    - dailyStats.slice(-14, -7).reduce((s, d) => s + (d.views ?? 0), 0);
  const unanswered = msgStats ? Math.max(0, msgStats.inbound - msgStats.replies) : 0;

  function handleToggleSave() {
    if (!user) {
      openSignIn(`/listing/${listing.id}?save=1`);
      return;
    }
    // Q91: hearts open the "Save to collection" modal.
    openSaveToCollection(listing.id);
  }


  const { data: similar = [] } = useQuery({
    queryKey: ["listing-similar", listing.id],
    queryFn: () => fetchSimilar(listing),
    staleTime: 60_000,
  });
  const { data: lfMatches = [] } = useQuery({
    queryKey: ["listing-lf-matches", listing.id],
    queryFn: () => fetchLookingForMatchesForListing(listing, 3),
    enabled: isOwner,
    staleTime: 60_000,
  });
  async function messageLfPoster(otherId: string) {
    if (!user) { openSignIn(`/listing/${listing.id}`); return; }
    if (otherId === user.id) return;
    try {
      const convId = await getOrCreateConversation(user.id, otherId, listing.id);
      navigate({ to: "/messages/$conversationId", params: { conversationId: convId } });
    } catch (e: any) { toast.error(e.message ?? "Could not open conversation"); }
  }
  const [viewCount, setViewCount] = useState<number>(listing.view_count ?? 0);

  const shareInput = {
    title: listing.title,
    price: listing.price,
    beds: listing.beds,
    area: listing.area,
    campusShortName: listing.campus?.short_name ?? null,
    availableFrom: listing.available_from,
    availableTo: listing.available_to,
  };
  function baseListingUrl() {
    if (typeof window === "undefined") return `https://leasup.co/listing/${listing.id}`;
    const u = new URL(window.location.href);
    u.search = ""; u.hash = "";
    return u.toString();
  }

  async function handleShare() {
    if (typeof window === "undefined") return;
    const url = withUtm(baseListingUrl(), "native_share");
    const bedStr = listing.beds === 0 ? "Studio" : `${listing.beds}BR`;
    const where = [listing.area, listing.campus?.short_name].filter(Boolean).join(", ");
    const fmt = (iso: string | null) =>
      iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
    const range = listing.available_from && listing.available_to
      ? ` · ${fmt(listing.available_from)}–${fmt(listing.available_to)}`
      : "";
    const text = `${bedStr}${where ? ` at ${where}` : ""} · $${listing.price}/mo${range}`;
    const title = `${listing.title} — LeaseUp`;
    const nav = window.navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title, text, url });
        recordShare(listing.id);
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }
    const clipUrl = withUtm(baseListingUrl(), "clipboard");
    const ok = await copyToClipboard(clipUrl);
    if (ok) {
      toast.success("Link copied!");
      recordShare(listing.id);
    }
  }

  async function handleShareGroupMe() {
    const url = withUtm(baseListingUrl(), "groupme");
    await shareToGroupMe(buildGroupMeText(shareInput, url));
    recordShare(listing.id);
  }
  async function handleShareDiscord() {
    const url = withUtm(baseListingUrl(), "discord");
    await shareToDiscord(buildDiscordText(shareInput, url));
    recordShare(listing.id);
  }


  // Bump view count once per session.
  useEffect(() => {
    const key = `viewed:${listing.id}`;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    // Track listing-detail views for install-prompt gating (Q77).
    try {
      const n = Number(localStorage.getItem("lu_listing_views") || "0") + 1;
      localStorage.setItem("lu_listing_views", String(n));
      window.dispatchEvent(new CustomEvent("lu:listing-viewed", { detail: { count: n } }));
    } catch {}
    supabase.rpc("increment_listing_view" as any, { _listing_id: listing.id }).then(({ data }) => {
      if (typeof data === "number") setViewCount(data);
    });
  }, [listing.id]);

  // Replay ?save=1 after post-signin redirect.
  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("save") !== "1") return;
    url.searchParams.delete("save");
    window.history.replaceState({}, "", url.toString());
    if (!isSaved && listing.user_id !== user.id) handleToggleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);


  const [messaging, setMessaging] = useState(false);
  const firstName = (poster?.name ?? "").split(" ")[0] || "the host";

  const isEdu = !!poster?.verified_email;
  const memberSince = poster?.created_at
    ? new Date(poster.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  /**
   * Q106 Part B — resolve (or create) the conversation with this host about
   * this listing, then deep-link straight into that thread.
   */
  async function handleMessage() {
    if (!user) {
      openSignIn(`/listing/${listing.id}`);
      return;
    }
    if (isOwner) {
      navigate({ to: "/my-listings" });
      return;
    }
    if (messaging) return;
    setMessaging(true);
    try {
      try {
        if (!sessionStorage.getItem("leaseup-msg-draft")) {
          sessionStorage.setItem(
            "leaseup-msg-draft",
            "Hi, I'm interested in your listing — is it still available?",
          );
        }
      } catch { /* noop */ }
      const convId = await getOrCreateConversation(user.id, listing.user_id, listing.id);
      navigate({ to: "/messages/$conversationId", params: { conversationId: convId } });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't open the conversation");
    } finally {
      setMessaging(false);
    }
  }

  /** Q104 — open the thread with a suggested opener about the household. */
  function messageAboutRoommates() {
    try {
      sessionStorage.setItem(
        "leaseup-msg-draft",
        "Hi! I'm interested in the room. Could you tell me a bit about the other people living there?",
      );
    } catch { /* noop */ }
    handleMessage();
  }


  return (
    <div className="min-h-screen bg-background pb-32 lg:pb-16">

      <DeepLinkBackLink />

      {/* PART A — Gallery */}
      <Gallery photos={photos} title={listing.title} onOpen={(i) => setLightboxIndex(i)} />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {isOwner && (() => {
          const today = new Date().toISOString().slice(0, 10);
          const isFilled = (listing as any).status === "filled";
          const isExpired = !isFilled && !!listing.available_to && listing.available_to < today;
          if (!isFilled && !isExpired) return null;
          return (
            <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-bold">This listing is no longer active.</p>
                <p className="text-muted-foreground">
                  {isFilled ? "Marked as rented." : "The listing window has ended."} Relist it for next semester.
                </p>
              </div>
              <div className="flex gap-2">
                {!isFilled && (listing as any).status !== "filled" && (
                  <MarkAsRentedButton listingId={listing.id} />
                )}
                <button
                  type="button"
                  onClick={() => navigate({ to: "/post", search: { relist: listing.id } as any })}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
                >
                  Relist <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })()}
        <div className="grid grid-cols-1 gap-10 py-8 lg:grid-cols-3 lg:gap-12 lg:py-12">
          {/* PART B — details */}
          <div className="min-w-0 lg:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-black leading-tight sm:text-3xl">{listing.title}</h1>
              <div className="flex shrink-0 items-center gap-2">
                <ShareSheet
                  url={baseListingUrl()}
                  title={`${listing.title} — LeaseUp`}
                  text={`${listing.beds === 0 ? "Studio" : `${listing.beds} bed`} · ${listing.baths} bath · $${listing.price}/mo${listing.area ? ` · ${listing.area}` : ""}`}
                  listingId={listing.id}
                />

                <MoreOptionsMenu onReport={() => setReportOpen(true)} />

                {isOwner && (
                  <Link
                    to="/listing/$id/edit"
                    params={{ id: listing.id }}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm font-medium shadow-sm transition active:scale-95"
                  >
                    <Pencil className="h-4 w-4" /> Edit listing
                  </Link>
                )}
                {!isOwner && (
                  <button
                    type="button"
                    onClick={handleToggleSave}
                    aria-label={isSaved ? "Remove from saved" : "Save listing"}
                    className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface shadow-sm transition active:scale-90"
                  >
                    <Heart className={cn("h-5 w-5", isSaved ? "fill-[#FF5A5F] text-[#FF5A5F]" : "text-foreground")} />
                  </button>
                )}
              </div>
            </div>

            {isSaved && !isOwner && (
              <p className="mt-2 text-xs text-muted-foreground">
                Saved to your list ·{" "}
                <button type="button" onClick={handleToggleSave} className="font-semibold text-primary hover:underline">
                  Remove
                </button>
              </p>
            )}
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {listing.area && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {listing.area}
                </span>
              )}
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Bed className="h-3.5 w-3.5" /> {listing.beds === 0 ? "Studio" : `${listing.beds} bd`}
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Bath className="h-3.5 w-3.5" /> {listing.baths} ba
              </span>
            </p>

            <ListingRatingSummary listingId={listing.id} />

            {/* PART C — host card */}
            <div className="mt-6 border-y border-border py-5">
              <HostCard poster={poster} listing={listing} isEdu={isEdu} memberSince={memberSince} />
            </div>

            <div className="mt-6 grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
              <FactRow
                icon={<Calendar className="h-4 w-4" />}
                label="Available"
                value={formatRange(listing.available_from, listing.available_to)}
                sub={formatDuration(listing.available_from, listing.available_to)}
              />
              <FactRow
                icon={<span className="text-base font-bold leading-none">$</span>}
                label="Price"
                value={`$${listing.price.toLocaleString()}/mo`}
              />
            </div>

            <AmenityChips listing={listing} />

            <AvailabilityCalendar from={listing.available_from} to={listing.available_to} />

            {listing.description && (
              <section className="mt-8">
                <h2 className="mb-3 text-lg font-bold">About this sublease</h2>
                <Description text={listing.description} />
              </section>
            )}

            <ListingReviewsSection
              listingId={listing.id}
              listingTitle={listing.title}
              ownerId={listing.user_id}
            />

            <p className="mt-8 text-sm text-muted-foreground">
              Posted {timeAgo(listing.created_at)}
              {poster?.name && (
                <>
                  {" by "}
                  <Link
                    to="/profile/$userId"
                    params={{ userId: listing.user_id }}
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    {poster.name}
                  </Link>
                </>
              )}
            </p>

            {isOwner && (() => {
              const bumpedMs = bumpedAt ? new Date(bumpedAt).getTime() : 0;
              const daysSince = bumpedMs ? Math.floor((Date.now() - bumpedMs) / 86400000) : Infinity;
              const canBump = !bumpedAt || daysSince >= 7;
              const daysLeft = Math.max(0, 7 - daysSince);
              return (
                <div className="mt-6 flex flex-wrap gap-2">
                  {(listing as any).status !== "filled" && (
                    <MarkAsRentedButton listingId={listing.id} />
                  )}
                  <Link
                    to="/listing/$id/edit"
                    params={{ id: listing.id }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold shadow-sm transition hover:border-primary hover:text-primary"
                  >
                    <Pencil className="h-4 w-4" /> Edit listing →
                  </Link>
                  {canBump ? (
                    <button
                      type="button"
                      onClick={() => setBumpOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-surface px-4 py-2 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary hover:text-primary-foreground"
                    >
                      <ArrowUp className="h-4 w-4" /> Bump to top ↑
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-4 py-2 text-sm font-medium text-muted-foreground">
                      Bumped {daysSince === 0 ? "today" : `${daysSince}d ago`} — bump again in {daysLeft}d
                    </span>
                  )}
                </div>
              );
            })()}

            <Dialog open={bumpOpen} onOpenChange={setBumpOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bump to top of the feed?</DialogTitle>
                  <DialogDescription>
                    Bring this listing back to the top of the UGA feed. Free — you can bump again in 7 days.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBumpOpen(false)} disabled={bumping}>Cancel</Button>
                  <Button
                    onClick={async () => {
                      setBumping(true);
                      try {
                        const newTs = await bumpListing(listing.id);
                        setBumpedAt(newTs);
                        toast.success("Bumped! Your listing is back at the top of the feed.");
                        setBumpOpen(false);
                        qc.invalidateQueries({ queryKey: ["listings"] });
                      } catch (e: any) {
                        toast.error(e?.message ?? "Could not bump listing");
                      } finally {
                        setBumping(false);
                      }
                    }}
                    disabled={bumping}
                  >
                    <ArrowUp className="mr-1 h-4 w-4" /> Bump ↑
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {!isOwner && (
              <p className="mt-8 text-xs text-muted-foreground">
                Something wrong with this listing?{" "}
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Report it →
                </button>
              </p>
            )}
          </div>


          {/* PART E — sticky price sidebar */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              <PriceSidebar
                listing={listing}
                isOwner={isOwner}
                firstName={firstName}
                onMessage={handleMessage}
                messaging={messaging}
              />
              {/* Q103 Part B — host profile card */}
              <HostProfileCard hostId={listing.user_id} poster={poster} />

              {/* Q104 Part D — shared-home context for room listings */}
              {(listing.type === "private_room" || listing.type === "shared_room") && (
                <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
                  <h3 className="mb-3 text-lg font-semibold">About the household</h3>
                  <p className="text-sm text-gray-600 dark:text-muted-foreground">
                    This is a room in a shared home. Message the host to learn more about your
                    future roommates before committing.
                  </p>
                  <button
                    type="button"
                    onClick={() => messageAboutRoommates()}
                    className="mt-3 text-sm text-[#FF5A5F] hover:underline"
                  >
                    Message host about roommates →
                  </button>
                </div>
              )}
              {/* PART D — activity signals */}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 px-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" /> {viewCount.toLocaleString()} views
                </span>
                {savedCount >= 3 && (
                  <span className="inline-flex items-center gap-1">
                    🔖 {savedCount.toLocaleString()} people saved this
                  </span>
                )}

                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Listed {timeAgo(listing.created_at)}
                </span>
                {(() => {
                  const created = new Date(listing.created_at as any).getTime();
                  const updated = (listing as any).updated_at ? new Date((listing as any).updated_at).getTime() : 0;
                  return updated && updated - created > 60 * 60 * 1000 ? (
                    <span className="inline-flex items-center gap-1">
                      · Updated {timeAgo((listing as any).updated_at)}
                    </span>
                  ) : null;
                })()}
              </div>


              {isOwner && (
                <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Your listing activity
                  </p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Views</dt>
                      <dd className="font-semibold">
                        {viewCount.toLocaleString()}
                        {viewsThisWeek > 0 && (
                          <span className="ml-2 text-xs font-medium text-emerald-600">
                            ↑ {viewsThisWeek} this week
                          </span>
                        )}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Saves</dt>
                      <dd className="font-semibold">{savedCount.toLocaleString()}</dd>
                    </div>
                    {msgStats && (
                      <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">Messages</dt>
                        <dd className="font-semibold">
                          {msgStats.inbound.toLocaleString()}
                          {unanswered > 0 && (
                            <span className="ml-2 text-xs font-medium text-amber-600">
                              ({unanswered} unanswered)
                            </span>
                          )}
                        </dd>
                      </div>
                    )}
                    {((listing as any).share_count ?? 0) > 0 && (
                      <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">Shares</dt>
                        <dd className="font-semibold">{((listing as any).share_count ?? 0).toLocaleString()}</dd>
                      </div>
                    )}
                    {(() => {
                      const bumpedMs = bumpedAt ? new Date(bumpedAt).getTime() : 0;
                      const daysSince = bumpedMs ? Math.floor((Date.now() - bumpedMs) / 86400000) : Infinity;
                      const canBump = !bumpedAt || daysSince >= 7;
                      const daysLeft = Math.max(0, 7 - daysSince);
                      return (
                        <div className="flex items-center justify-between">
                          <dt className="text-muted-foreground">{bumpedAt ? "Bumped" : "Bump"}</dt>
                          <dd className="font-semibold">
                            {canBump ? (
                              <button
                                type="button"
                                onClick={() => setBumpOpen(true)}
                                className="text-primary underline underline-offset-2 hover:text-primary/80"
                              >
                                Bring to top — free ↑
                              </button>
                            ) : (
                              <span>
                                {daysSince === 0 ? "today" : `${daysSince}d ago`}
                                <span className="ml-1 text-xs font-normal text-muted-foreground">(bump again in {daysLeft}d)</span>
                              </span>
                            )}
                          </dd>
                        </div>
                      );
                    })()}
                  </dl>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Queue 60 — Part C: Looking-for matches (owner only) */}
        {isOwner && lfMatches.length > 0 && (
          <section className="border-t border-border py-10">
            <h2 className="text-xl font-black sm:text-2xl">
              Students looking for something like this{listing.campus?.short_name ? ` at ${listing.campus.short_name}` : ""}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These students might be interested in your listing. Reach out directly.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lfMatches.map((p: LookingForPost) => (
                <LookingForMatchCard key={p.id} p={p} onMessage={() => messageLfPoster(p.user_id)} />
              ))}
            </div>
          </section>
        )}

        {/* PART E — similar (Q100: snap-scroll row, hidden below 2 results) */}
        {similar.length >= 2 && (
          <section className="mt-10 border-t border-gray-100 pt-10 dark:border-border">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-semibold">Similar subleases</h2>
              <Link
                to="/browse"
                search={{ campus: listing.campus_id } as never}
                className="shrink-0 text-sm text-gray-500 hover:underline dark:text-muted-foreground"
              >
                See all →
              </Link>
            </div>
            <ScrollRow>
              {similar.map((l) => (
                <div key={l.id} className="w-[82%] shrink-0 snap-start sm:w-[280px] lg:w-[calc((100%-3rem)/4)]">
                  <ListingCard
                    listing={l}
                    saved={false}
                    onSave={() => {}}
                    onOpen={() => navigate({ to: "/listing/$id", params: { id: l.id } })}
                  />
                </div>
              ))}
            </ScrollRow>
          </section>
        )}


        {/* PART E2 — send to a friend */}
        <section className="border-t border-border py-10">
          <div className="mx-auto flex max-w-2xl flex-col gap-4 rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="text-sm font-medium text-foreground">
              Know someone looking for a place{listing.campus?.short_name ? ` at ${listing.campus.short_name}` : ""}? Share this listing.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition active:scale-95"
              >
                <Share2 className="h-4 w-4" /> Share listing
              </button>
              <button
                type="button"
                onClick={handleShareGroupMe}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold shadow-sm transition active:scale-95"
              >
                Share to GroupMe
              </button>
              <button
                type="button"
                onClick={handleShareDiscord}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold shadow-sm transition active:scale-95"
              >
                Copy for Discord
              </button>
            </div>
          </div>
        </section>
      </div>


      {/* PART F — sticky mobile CTA */}
      <MobileStickyCTA
        listing={listing}
        firstName={firstName}
        isOwner={isOwner}
        onMessage={handleMessage}
        messaging={messaging}
      />

      {/* Lightbox */}
      {lightboxIndex !== null && photos.length > 0 && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      <ReportListingDialog open={reportOpen} onOpenChange={setReportOpen} listingId={listing.id} />
    </div>
  );
}

// ---------------- gallery ----------------

function Gallery({ photos, title, onOpen }: { photos: string[]; title: string; onOpen: (i: number) => void }) {
  // 0 photos
  if (photos.length === 0) {
    return (
      <div className="grid h-[45vh] w-full place-items-center bg-muted lg:h-[55vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Home className="h-16 w-16" strokeWidth={1.5} />
          <span className="text-sm">No photos yet</span>
        </div>
      </div>
    );
  }

  // 1 photo — full width
  if (photos.length === 1) {
    return (
      <button
        type="button"
        onClick={() => onOpen(0)}
        className="block h-[45vh] w-full overflow-hidden lg:h-[55vh]"
      >
        <img src={photos[0]} alt={`${title} — photo 1`} className="h-full w-full cursor-zoom-in object-cover" />
      </button>
    );
  }

  // Mobile: swipeable snap carousel for any count > 1
  // Desktop: Airbnb-style split
  return (
    <div className="relative">
      {/* Mobile carousel */}
      <MobileCarousel photos={photos} title={title} onOpen={onOpen} />

      {/* Desktop split */}
      <div className="mx-auto hidden max-w-[1400px] px-4 lg:block">
        <div className="grid h-[58vh] grid-cols-5 grid-rows-2 gap-2 overflow-hidden rounded-2xl">
          <button
            type="button"
            onClick={() => onOpen(0)}
            className="col-span-3 row-span-2 overflow-hidden"
          >
            <img
              src={photos[0]}
              alt={`${title} — photo 1`}
              className="h-full w-full cursor-zoom-in object-cover transition hover:brightness-95"
            />
          </button>
          {photos.slice(1, 5).map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onOpen(i + 1)}
              className="overflow-hidden"
            >
              <img
                src={p}
                alt={`${title} — photo ${i + 2}`}
                className="h-full w-full cursor-zoom-in object-cover transition hover:brightness-95"
              />
            </button>
          ))}
          {/* fill blanks when 2–4 photos to keep grid tidy */}
          {photos.length < 5 &&
            Array.from({ length: 5 - photos.length }).map((_, i) => (
              <div key={`blank-${i}`} className="bg-muted" />
            ))}
        </div>
        {photos.length > 4 && (
          <div className="relative -mt-14 flex justify-end pr-4">
            <button
              type="button"
              onClick={() => onOpen(0)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-900/10 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-md transition hover:bg-gray-50"
            >
              <Grid2x2 className="h-4 w-4" /> Show all {photos.length} photos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MobileCarousel({ photos, title, onOpen }: { photos: string[]; title: string; onOpen: (i: number) => void }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  return (
    <div className="relative lg:hidden">
      <div
        ref={scrollerRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== active) setActive(i);
        }}
        className="flex h-[45vh] snap-x snap-mandatory overflow-x-auto scroll-smooth"
      >
        {photos.map((p, i) => (
          <img
            key={i}
            src={p}
            alt={`${title} — photo ${i + 1}`}
            onClick={() => onOpen(i)}
            className="h-full w-full flex-shrink-0 cursor-zoom-in snap-start object-cover"
          />
        ))}
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
        {active + 1} / {photos.length}
      </div>
    </div>
  );
}

// ---------------- amenities ----------------

const AMENITY_ICONS = [
  { key: "furnished", label: "Furnished", Icon: Sofa },
  { key: "utilities_included", label: "Utilities included", Icon: Zap },
  { key: "parking", label: "Parking", Icon: Car },
  { key: "pet_friendly", label: "Pet friendly", Icon: PawPrint },
  { key: "wifi_included", label: "WiFi included", Icon: WifiIcon },
] as const;

const EXTRA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ac: Snowflake,
  "a/c": Snowflake,
  laundry: WashingMachine,
  washer: WashingMachine,
  dryer: WashingMachine,
};

function AmenityChips({ listing }: { listing: Listing }) {
  const chips: Array<{ label: string; Icon: React.ComponentType<{ className?: string }> }> = [];
  for (const { key, label, Icon } of AMENITY_ICONS) {
    if ((listing as any)[key]) chips.push({ label, Icon });
  }
  const laundry = (listing as any).laundry as string | null | undefined;
  if (laundry) chips.push({ label: `Laundry — ${laundry}`, Icon: WashingMachine });
  for (const raw of listing.amenities ?? []) {
    const k = raw.trim();
    if (!k) continue;
    const Icon = EXTRA_ICONS[k.toLowerCase()] ?? BadgeCheck;
    chips.push({ label: k, Icon });
  }
  if (chips.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-bold">What this place offers</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {chips.map(({ label, Icon }, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm font-medium"
          >
            <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}


// ---------------- description ----------------

function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 320;
  return (
    <div>
      <p
        className={cn(
          "whitespace-pre-wrap text-[15px] leading-relaxed text-foreground",
          !expanded && isLong && "line-clamp-6 sm:line-clamp-none",
        )}
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 text-sm font-semibold text-primary underline underline-offset-4 sm:hidden"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

// ---------------- poster card ----------------

function HostCard({
  poster, listing, isEdu, memberSince,
}: {
  poster: PublicPoster | null | undefined;
  listing: Listing;
  isEdu: boolean;
  memberSince: string | null;
}) {
  const initial = (poster?.name ?? "?").trim().charAt(0).toUpperCase();
  const bannerColor = poster?.banner_color ?? "hsl(var(--primary))";
  const subtitle = [poster?.campus_name && abbrevCampus(poster.campus_name), poster?.year].filter(Boolean).join(" · ");
  const lastSeen = poster?.last_seen ? new Date(poster.last_seen).getTime() : 0;
  const activeLabel = lastSeen
    ? (() => {
        const days = Math.floor((Date.now() - lastSeen) / 86400000);
        if (days <= 0) return "Active today";
        if (days === 1) return "Active yesterday";
        return `Active ${days} days ago`;
      })()
    : memberSince
      ? `Member since ${memberSince}`
      : null;

  return (
    <div className="flex items-center gap-4">
      <Link to="/profile/$userId" params={{ userId: listing.user_id }} className="shrink-0">
        {poster?.avatar_url ? (
          <img src={poster.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div
            className="grid h-14 w-14 place-items-center rounded-full text-2xl font-black text-white"
            style={{ background: bannerColor }}
          >
            {poster?.avatar_emoji || initial}
          </div>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            to="/profile/$userId"
            params={{ userId: listing.user_id }}
            className="truncate text-base font-bold hover:underline"
          >
            Hosted by {poster?.name ?? "Student"}
          </Link>
          {isEdu && <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
        </div>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        {activeLabel && <p className="mt-0.5 text-xs text-muted-foreground">{activeLabel}</p>}
      </div>
    </div>
  );
}

// ---------------- sticky price sidebar ----------------

function PriceSidebar({
  listing, isOwner, firstName, onMessage, messaging,
}: {
  listing: Listing;
  isOwner: boolean;
  firstName: string;
  onMessage: () => void;
  messaging?: boolean;
}) {
  const months = (() => {
    if (!listing.available_from || !listing.available_to) return 0;
    const from = new Date(listing.available_from).getTime();
    const to = new Date(listing.available_to).getTime();
    if (!from || !to || to <= from) return 0;
    return Math.max(1, Math.round((to - from) / (30 * 86400000)));
  })();

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-black">${listing.price.toLocaleString()}</span>
        <span className="text-sm text-muted-foreground">/ month</span>
        <InlinePriceBadge price={listing.price} campusId={listing.campus_id} />
      </div>

      <div className="mt-4 space-y-2 rounded-xl border border-border p-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate text-foreground">
            {formatRange(listing.available_from, listing.available_to)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Bed className="h-4 w-4 shrink-0" />
          <span className="text-foreground">
            {listing.beds === 0 ? "Studio" : `${listing.beds} bd`} · {listing.baths} ba
          </span>
        </div>
      </div>

      <Button
        onClick={onMessage}
        size="lg"
        disabled={messaging}
        className="mt-5 w-full bg-[#FF5A5F] text-white hover:bg-[#E14E52]"
      >
        {isOwner ? (
          <>
            <Pencil className="mr-2 h-4 w-4" /> Edit listing
          </>
        ) : messaging ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening chat…
          </>
        ) : (
          <>
            Message {firstName} <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>

      {months > 0 && (
        <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>
              ${listing.price.toLocaleString()} × {months} month{months === 1 ? "" : "s"}
            </span>
            <span>${(listing.price * months).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between font-bold">
            <span>Estimated total</span>
            <span>${(listing.price * months).toLocaleString()}</span>
          </div>
          <p className="text-xs text-muted-foreground">Estimate only — confirm terms with the host.</p>
        </div>
      )}
    </div>
  );
}


// ---------------- mobile sticky CTA ----------------

function MobileStickyCTA({
  listing, firstName, isOwner, onMessage, messaging,
}: {
  listing: Listing;
  firstName: string;
  isOwner: boolean;
  onMessage: () => void;
  messaging?: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden">
      <div className="flex items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0">
          <div className="text-lg font-black leading-none">${listing.price.toLocaleString()}</div>
          <div className="text-[11px] text-muted-foreground">per month</div>
        </div>
        <Button onClick={onMessage} disabled={messaging} className="ml-auto flex-1" size="lg">
          {isOwner ? "Edit listing" : messaging ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening chat…
            </>
          ) : (
            <>
              Message {firstName}
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------- lightbox ----------------

function Lightbox({
  photos, index, onIndex, onClose,
}: {
  photos: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const go = useCallback(
    (delta: number) => onIndex((index + delta + photos.length) % photos.length),
    [index, photos.length, onIndex],
  );

  // Escape/arrows are bound on window so they work wherever focus sits,
  // including inside the thumbnail strip.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  // Mobile swipe: 50px horizontal threshold.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const touchX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.changedTouches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchX.current;
    touchX.current = null;
    if (start == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  }

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/95"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center justify-end px-4 py-3 text-white">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4">
        <img
          src={photos[index]}
          alt={`Photo ${index + 1} of ${photos.length}`}
          className="mx-auto max-h-[80vh] max-w-[90vw] object-contain"
        />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
        <div className="absolute bottom-6 left-0 right-0 text-center text-sm text-white">
          {index + 1} / {photos.length}
        </div>
      </div>

      {photos.length > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 pb-5 pt-10">
          {photos.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onIndex(i)}
              aria-label={`View photo ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "h-12 w-16 shrink-0 overflow-hidden rounded-md transition",
                i === index ? "border-2 border-white" : "opacity-60 hover:opacity-100",
              )}
            >
              <img src={p} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}

// ---------------- misc ----------------

function FactRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
        {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function toDate(iso: string) {
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
}

/** Q101 C2 — drop the year unless the range crosses out of the current year. */
function formatRange(from: string | null | undefined, to: string | null | undefined): string {
  const thisYear = new Date().getFullYear();
  const years = [from, to].filter(Boolean).map((iso) => toDate(iso as string).getFullYear());
  const showYear = years.some((y) => y !== thisYear);
  const fmt = (iso: string) =>
    toDate(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(showYear ? { year: "numeric" as const } : {}),
    });
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  if (from) return `From ${fmt(from)}`;
  if (to) return `Until ${fmt(to)}`;
  return "Flexible";
}

/** "~4 months" / "12 nights" for a date range; null when it can't be computed. */
function formatDuration(from: string | null | undefined, to: string | null | undefined): string | null {
  if (!from || !to) return null;
  const a = toDate(from).getTime();
  const b = toDate(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  const nights = Math.round((b - a) / 86400000);
  if (nights < 45) return `${nights} night${nights === 1 ? "" : "s"}`;
  const months = Math.round(nights / 30);
  return `~${months} month${months === 1 ? "" : "s"}`;
}

/**
 * Q101 C5 — only shown when the visitor deep-linked in (share link, search
 * result) and therefore has no in-app history to go back to.
 */
function DeepLinkBackLink() {
  // Q108 — always offer a way back to browse, preserving ?campus when present.
  const [campus, setCampus] = useState<string | undefined>(undefined);
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("campus");
    setCampus(c ?? undefined);
  }, []);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-6 lg:px-8">
      <Link
        to="/browse"
        search={(campus ? { campus } : {}) as any}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to browse
      </Link>

    </div>
  );
}

/** Q101 Part B — ⋯ menu with a single "Report this listing" action. */
function MoreOptionsMenu({ onReport }: { onReport: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-muted"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onReport();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-muted"
          >
            <Flag className="h-4 w-4" /> Report this listing
          </button>
        </div>
      )}
    </div>
  );
}

const CAMPUS_ABBREV: Record<string, string> = {
  "University of Georgia": "UGA",
  "Auburn University": "Auburn",
  "University of Florida": "UF",
  "Georgia Tech": "GT",
  "Georgia Institute of Technology": "GT",
  "University of Alabama": "Alabama",
};
function abbrevCampus(name: string): string {
  if (CAMPUS_ABBREV[name]) return CAMPUS_ABBREV[name];
  return name.split(/\s+/)[0];
}

function MarkAsRentedButton({ listingId }: { listingId: string }) {
  const { listing } = Route.useLoaderData();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const navigate = useNavigate();

  async function confirm() {
    setBusy(true);
    try {
      await markListingFilled(listingId);
      toast.success("Listing marked as rented. Nice work! 🎉");
      setOpen(false);
      if (user) {
        setFeedbackOpen(true);
      } else {
        navigate({ to: "/profile" });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't mark as rented");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
      >
        <CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark as rented
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark this listing as rented?</DialogTitle>
            <DialogDescription>
              It will be removed from browse and your profile will show +1 completed sublease.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button
              onClick={confirm}
              disabled={busy}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {busy ? "Saving…" : "Yes, mark as rented"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {user && (
        <ListerFeedbackModal
          open={feedbackOpen}
          onClose={() => { setFeedbackOpen(false); navigate({ to: "/profile" }); }}
          listingId={listingId}
          listingTitle={listing.title}
          userId={user.id}
        />
      )}
    </>
  );
}

// Queue 60 — Part C: compact card for a looking-for post
function LookingForMatchCard({ p, onMessage }: { p: LookingForPost; onMessage: () => void }) {
  const profile = (p as any).profile as { name?: string; avatar_emoji?: string; banner_color?: string; verified_email?: boolean } | undefined;
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
  const range = p.move_in_date || p.move_out_date
    ? `${fmt(p.move_in_date)}${p.move_out_date ? `–${fmt(p.move_out_date)}` : ""}`
    : null;
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg ring-2 ring-white"
          style={{ background: profile?.banner_color ?? "#2563EB" }}
        >
          {profile?.avatar_emoji ?? "🙂"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold">{profile?.name ?? "Student"}</p>
            {profile?.verified_email && <BadgeCheck className="h-3.5 w-3.5 text-success" />}
          </div>
          {p.budget_max != null && (
            <p className="text-xs text-muted-foreground">Up to ${p.budget_max}/mo{range ? ` · ${range}` : ""}</p>
          )}
        </div>
      </div>
      <p className="line-clamp-3 text-sm text-foreground">{p.description}</p>
      <Button size="sm" onClick={onMessage} className="mt-auto gap-1 bg-primary hover:bg-primary-dark text-primary-foreground">
        Message →
      </Button>
    </article>
  );
}
