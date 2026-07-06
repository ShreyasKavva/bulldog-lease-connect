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
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";
import { openSignIn } from "@/components/leaseup/SignInModal";
import { TopBar } from "@/components/leaseup/TopBar";
import { ListingCard } from "@/components/leaseup/ListingCard";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { markListingFilled, toggleSaved, fetchSavedIds, fetchLookingForMatchesForListing, getOrCreateConversation, bumpListing } from "@/lib/leaseup/queries";
import { fetchListingDailyStats, fetchListingMessageStats } from "@/lib/leaseup/analytics.queries";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/leaseup/constants";
import type { Listing, LookingForPost, Profile } from "@/lib/leaseup/types";
import {
  Home, Bed, Bath, MapPin, Calendar, BadgeCheck, Eye, Bookmark, Clock,
  Sofa, Snowflake, Car, WashingMachine, PawPrint, Zap, X as XIcon,
  ChevronLeft, ChevronRight, ArrowRight, Pencil, CheckCircle2, Heart, Share2, ArrowUp,
} from "lucide-react";
import { ReportListingDialog } from "@/components/leaseup/ReportListingDialog";
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
        <TopBar />
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
      <TopBar />
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="mb-2 text-2xl font-black">Couldn't load this listing</h1>
        <p className="mb-6 text-sm text-muted-foreground">{error.message}</p>
        <Button onClick={reset}>Try again</Button>
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
};

type ListingWithCampus = Listing & { campus?: { name: string; short_name: string; slug: string } | null };
type ListingLoadResult =
  | { listing: ListingWithCampus; reason?: undefined }
  | { listing?: undefined; reason: "expired" | "rented" };

async function fetchListingDetail(id: string): Promise<ListingLoadResult | null> {
  const { data, error } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as any;
  if (row.status === "filled") return { reason: "rented" };
  const today = new Date().toISOString().slice(0, 10);
  if (row.available_to && row.available_to < today) return { reason: "expired" };
  if (row.is_active === false) return null;
  const paths: string[] = row.photos ?? [];
  let photo_urls: string[] = [];
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from("listing-photos")
      .createSignedUrls(paths, 60 * 60 * 24 * 7);
    photo_urls = paths.map((p) => signed?.find((s) => s.path === p)?.signedUrl ?? "").filter(Boolean);
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

async function fetchSimilar(l: Listing): Promise<Listing[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("is_active", true)
    .eq("campus_id", l.campus_id)
    .neq("id", l.id)
    .gte("price", Math.max(0, l.price - 150))
    .lte("price", l.price + 150)
    .gte("available_to", today)
    .limit(6);
  if (error) throw error;
  const rows = (data ?? []) as any[];
  rows.sort((a, b) => Math.abs(a.price - l.price) - Math.abs(b.price - l.price));
  const trimmed = rows.slice(0, 3);
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
    photo_urls: (r.photos ?? []).map((p: string) => urlMap.get(p) ?? "").filter(Boolean),
  })) as Listing[];
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

  async function handleToggleSave() {
    if (!user) {
      openSignIn(`/listing/${listing.id}?save=1`);
      return;
    }
    const wasSaved = isSaved;
    qc.setQueryData(["saved", user.id], (prev: Set<string> | undefined) => {
      const s = new Set(prev ?? []);
      if (wasSaved) s.delete(listing.id); else s.add(listing.id);
      return s;
    });
    qc.setQueryData(["listing-saved-count", listing.id], (prev: number | undefined) =>
      Math.max(0, (prev ?? 0) + (wasSaved ? -1 : 1))
    );
    try {
      await toggleSaved(user.id, listing.id, wasSaved);
    } catch {
      qc.invalidateQueries({ queryKey: ["saved", user.id] });
      qc.invalidateQueries({ queryKey: ["listing-saved-count", listing.id] });
    }
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
      navigate({ to: "/messages" as any, search: { c: convId } as any });
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


  const firstName = (poster?.name ?? "").split(" ")[0] || "the host";
  const isEdu = !!poster?.verified_email;
  const memberSince = poster?.created_at
    ? new Date(poster.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  function handleMessage() {
    if (!user) {
      openSignIn(`/messages/${listing.id}`);
      return;
    }
    if (isOwner) {
      navigate({ to: "/my-listings" });
      return;
    }
    navigate({ to: "/messages/$listingId", params: { listingId: listing.id } });
  }

  return (
    <div className="min-h-screen bg-background pb-32 lg:pb-16">
      <TopBar />

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
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Share listing"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-sm font-semibold shadow-sm transition active:scale-95"
                >
                  <Share2 className="h-4 w-4" /> Share
                </button>
                {!isOwner && (
                  <button
                    type="button"
                    onClick={handleToggleSave}
                    aria-label={isSaved ? "Remove from saved" : "Save listing"}
                    className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface shadow-sm transition active:scale-90"
                  >
                    <Heart className={cn("h-5 w-5", isSaved ? "fill-destructive text-destructive" : "text-foreground")} />
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


            <div className="mt-6 grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
              <FactRow
                icon={<Calendar className="h-4 w-4" />}
                label="Available"
                value={formatRange(listing.available_from, listing.available_to)}
              />
              <FactRow
                icon={<span className="text-base font-bold leading-none">$</span>}
                label="Price"
                value={`$${listing.price.toLocaleString()}/mo`}
              />
            </div>

            <AmenityChips listing={listing} />

            {listing.description && (
              <section className="mt-8">
                <h2 className="mb-3 text-lg font-bold">About this sublease</h2>
                <Description text={listing.description} />
              </section>
            )}

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

            {isOwner && (
              <div className="mt-6 flex flex-wrap gap-2">
                {(listing as any).status !== "filled" && (
                  <MarkAsRentedButton listingId={listing.id} />
                )}
                <Link
                  to="/post/edit/$id"
                  params={{ id: listing.id }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold shadow-sm transition hover:border-primary hover:text-primary"
                >
                  <Pencil className="h-4 w-4" /> Edit listing →
                </Link>
              </div>
            )}

            {!isOwner && (
              <p className="mt-8 text-xs text-muted-foreground">
                Something wrong with this listing?{" "}
                <button
                  type="button"
                  onClick={() => {
                    if (!user) { openSignIn(`/listing/${listing.id}`); return; }
                    setReportOpen(true);
                  }}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Report it →
                </button>
              </p>
            )}
          </div>


          {/* PART C — poster card */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              <PosterCard
                poster={poster}
                listing={listing}
                isOwner={isOwner}
                firstName={firstName}
                isEdu={isEdu}
                memberSince={memberSince}
                onMessage={handleMessage}
              />
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

        {/* PART E — similar */}
        {similar.length > 0 && (
          <section className="border-t border-border py-10">
            <h2 className="mb-6 text-xl font-black sm:text-2xl">
              Similar subleases{listing.campus?.short_name ? ` at ${listing.campus.short_name}` : ""}
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  saved={false}
                  onSave={() => {}}
                  onOpen={() => navigate({ to: "/listing/$id", params: { id: l.id } })}
                />
              ))}
            </div>
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
        <div className="grid h-[55vh] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl">
          <button
            type="button"
            onClick={() => onOpen(0)}
            className="col-span-2 row-span-2 overflow-hidden"
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
        {photos.length >= 5 && (
          <div className="relative -mt-14 flex justify-end pr-4">
            <button
              type="button"
              onClick={() => onOpen(0)}
              className="rounded-lg border border-border bg-background/95 px-4 py-2 text-sm font-semibold shadow-md backdrop-blur transition hover:bg-background"
            >
              Show all {photos.length} photos
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
  for (const raw of listing.amenities ?? []) {
    const k = raw.trim();
    if (!k) continue;
    const Icon = EXTRA_ICONS[k.toLowerCase()] ?? BadgeCheck;
    chips.push({ label: k, Icon });
  }
  if (chips.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-bold">Amenities</h2>
      <div className="flex flex-wrap gap-2">
        {chips.map(({ label, Icon }, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm"
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            {label}
          </span>
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

function PosterCard({
  poster, listing, isOwner, firstName, isEdu, memberSince, onMessage,
}: {
  poster: PublicPoster | null | undefined;
  listing: Listing;
  isOwner: boolean;
  firstName: string;
  isEdu: boolean;
  memberSince: string | null;
  onMessage: () => void;
}) {
  const initial = (poster?.name ?? "?").trim().charAt(0).toUpperCase();
  const bannerColor = poster?.banner_color ?? "hsl(var(--primary))";
  const subtitle = [poster?.campus_name && abbrevCampus(poster.campus_name), poster?.year].filter(Boolean).join(" · ");

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <Link to="/profile/$userId" params={{ userId: listing.user_id }} className="shrink-0">
          {poster?.avatar_url ? (
            <img
              src={poster.avatar_url}
              alt=""
              className="h-14 w-14 rounded-full object-cover"
            />
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
          <Link
            to="/profile/$userId"
            params={{ userId: listing.user_id }}
            className="block truncate text-base font-bold hover:underline"
          >
            {poster?.name ?? "Student"}
          </Link>
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
          {isEdu && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              <BadgeCheck className="h-3 w-3" /> .edu verified
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
        {memberSince && <div>Member since {memberSince}</div>}
        {poster && (
          <div>
            {poster.active_listing_count} active listing{poster.active_listing_count === 1 ? "" : "s"}
          </div>
        )}
      </div>

      <div className="mt-5">
        {isOwner ? (
          <Button onClick={onMessage} className="w-full" size="lg" variant="secondary">
            <Pencil className="mr-2 h-4 w-4" /> Edit listing
          </Button>
        ) : (
          <Button onClick={onMessage} className="w-full" size="lg">
            Message {firstName}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------- mobile sticky CTA ----------------

function MobileStickyCTA({
  listing, firstName, isOwner, onMessage,
}: {
  listing: Listing;
  firstName: string;
  isOwner: boolean;
  onMessage: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden">
      <div className="flex items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0">
          <div className="text-lg font-black leading-none">${listing.price.toLocaleString()}</div>
          <div className="text-[11px] text-muted-foreground">per month</div>
        </div>
        <Button onClick={onMessage} className="ml-auto flex-1" size="lg">
          {isOwner ? "Edit listing" : (
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
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onIndex((index + 1) % photos.length);
      else if (e.key === "ArrowLeft") onIndex((index - 1 + photos.length) % photos.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onClose, onIndex]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm">
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center px-4 pb-6">
        <img src={photos[index]} alt="" className="max-h-full max-w-full object-contain" />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => onIndex((index - 1 + photos.length) % photos.length)}
              aria-label="Previous"
              className="absolute left-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => onIndex((index + 1) % photos.length)}
              aria-label="Next"
              className="absolute right-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- misc ----------------

function FactRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function formatRange(from: string | null | undefined, to: string | null | undefined): string {
  const fmt = (iso: string) =>
    new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  if (from && to) return `${fmt(from)} → ${fmt(to)}`;
  if (from) return `From ${fmt(from)}`;
  if (to) return `Until ${fmt(to)}`;
  return "Flexible";
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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function confirm() {
    setBusy(true);
    try {
      await markListingFilled(listingId);
      toast.success("Listing marked as rented. Nice work! 🎉");
      navigate({ to: "/profile" });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't mark as rented");
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
