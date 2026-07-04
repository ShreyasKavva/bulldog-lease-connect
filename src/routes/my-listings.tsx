/**
 * Poster dashboard ("/my-listings"). Shows everything the user has posted,
 * with per-listing actions (edit, hide/show, delete, boost, secure deposit,
 * mark filled, reopen, share to Story, view analytics, set tour
 * availability) and a stats header.
 *
 * search params:
 *   ?boosted=<listingId>  → highlight after returning from Stripe success
 *   ?deposit=<listingId>  → highlight after enabling escrow
 *
 * StaleListingsNudge surfaces listings with no recent engagement so the
 * poster can refresh price/photos. ListingStatsPanel drills into
 * per-listing analytics (my-listings.$listingId.analytics.tsx).
 */
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMyListings, deleteListing, setListingActive, markListingFilled, reopenListing } from "@/lib/leaseup/queries";
import { useSession } from "@/lib/leaseup/use-session";
import { Nav } from "@/components/leaseup/Nav";
import { Button } from "@/components/ui/button";
import { ListingDetailSheet } from "@/components/leaseup/ListingDetailSheet";
import { PostListingDialog } from "@/components/leaseup/PostListingDialog";
import { SafeScoreBadge } from "@/components/leaseup/SafeScoreBadge";
import { LeaveReviewDialog } from "@/components/leaseup/LeaveReviewDialog";
import { BoostCard } from "@/components/leaseup/BoostListingButton";
import { SecureDepositBadge } from "@/components/leaseup/SecureDepositBadge";
import type { Listing } from "@/lib/leaseup/types";
import { Eye, EyeOff, Trash2, Plus, Home as HomeIcon, CheckCircle2, Star, RotateCcw, Share2, BarChart3, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ShareToStoryButton } from "@/components/leaseup/ShareToStoryButton";
import { StatCard } from "@/components/leaseup/analytics/Charts";
import { ListingStatsPanel } from "@/components/leaseup/analytics/ListingStatsPanel";
import { TourAvailabilityDialog } from "@/components/leaseup/TourAvailabilityDialog";
import { StaleListingsNudge } from "@/components/leaseup/StaleListingsNudge";
import { openSignIn } from "@/components/leaseup/SignInModal";

export const Route = createFileRoute("/my-listings")({
  head: () => ({ meta: [{ title: "My listings — LeaseUp" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    boosted: typeof s.boosted === "string" ? s.boosted : undefined,
    deposit: typeof s.deposit === "string" ? s.deposit : undefined,
  }),
  component: MyListingsPage,
});

function MyListingsPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const search = useSearch({ from: "/my-listings" });
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "in" } as any });
  }, [loading, user, navigate]);
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["my-listings", user?.id],
    queryFn: () => fetchMyListings(user!.id),
    enabled: !!user,
  });
  const [selected, setSelected] = useState<Listing | null>(null);
  const [posting, setPosting] = useState(false);
  const [statsOpen, setStatsOpen] = useState<Record<string, boolean>>({});
  const [tourFor, setTourFor] = useState<Listing | null>(null);
  const [reviewFor, setReviewFor] = useState<{ listing: Listing; userId: string; name: string } | null>(null);

  const totals = {
    views: listings.reduce((s, l) => s + (l.view_count ?? 0), 0),
    active: listings.filter((l) => l.is_active && l.status !== "filled").length,
  };
  const { data: aggCounts = { saves: 0, messages: 0 } } = useQuery({
    queryKey: ["my-listings-aggregates", user?.id, listings.map((l) => l.id).join(",")],
    enabled: !!user && listings.length > 0,
    queryFn: async () => {
      const ids = listings.map((l) => l.id);
      const [sav, convs] = await Promise.all([
        supabase.from("saved_listings").select("listing_id", { count: "exact", head: true }).in("listing_id", ids),
        supabase.from("conversations").select("id, listing_id").in("listing_id", ids),
      ]);
      const convIds = (convs.data ?? []).map((c: any) => c.id);
      let msgCount = 0;
      if (convIds.length) {
        const m = await supabase.from("messages").select("id", { count: "exact", head: true }).in("conversation_id", convIds).neq("sender_id", user!.id);
        msgCount = m.count ?? 0;
      }
      return { saves: sav.count ?? 0, messages: msgCount };
    },
  });

  // Celebration on return from Stripe Checkout
  useEffect(() => {
    if (search.boosted) {
      toast.success("🎉 Your listing is now featured for 7 days!", { duration: 6000 });
      // Strip the query param so refreshes don't re-fire
      navigate({ to: "/my-listings", search: {}, replace: true });
    }
    if (search.deposit === "ok") {
      toast.success("🔒 Deposit secured.");
      navigate({ to: "/my-listings", search: {}, replace: true });
    }
     
  }, [search.boosted, search.deposit]);




  const { data: shareStats = {} } = useQuery({
    queryKey: ["my-listing-shares", user?.id, listings.map((l) => l.id).join(",")],
    enabled: !!user && listings.length > 0,
    queryFn: async () => {
      const ids = listings.map((l) => l.id);
      const { data } = await supabase
        .from("listing_shares")
        .select("listing_id, created_at")
        .in("listing_id", ids);
      const out: Record<string, { count: number; lastAt: string | null }> = {};
      for (const id of ids) out[id] = { count: 0, lastAt: null };
      for (const r of (data ?? []) as { listing_id: string; created_at: string }[]) {
        const e = out[r.listing_id];
        if (!e) continue;
        e.count += 1;
        if (!e.lastAt || r.created_at > e.lastAt) e.lastAt = r.created_at;
      }
      return out;
    },
  });


  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Nav onPost={() => {}} onOpenMessages={() => {}} onOpenProfile={() => {}} search="" onSearch={() => {}} />
        <div className="mx-auto max-w-md p-12 text-center">
          <h2 className="text-xl font-bold">Sign in to manage your listings</h2>
          <Link to="/auth" search={{ mode: "in" }} className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Sign in</Link>
        </div>
      </div>
    );
  }

  async function toggleActive(l: Listing) {
    try {
      await setListingActive(l.id, !l.is_active);
      qc.invalidateQueries({ queryKey: ["my-listings", user!.id] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      toast.success(l.is_active ? "Hidden from feed" : "Live on feed");
    } catch (e: any) { toast.error(e.message); }
  }

  async function remove(l: Listing) {
    if (!confirm(`Delete "${l.title}"? This can't be undone.`)) return;
    try {
      await deleteListing(l.id);
      qc.invalidateQueries({ queryKey: ["my-listings", user!.id] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Deleted");
    } catch (e: any) { toast.error(e.message); }
  }

  async function markFilled(l: Listing) {
    if (!confirm(`Mark "${l.title}" as filled? It will be hidden from the feed.`)) return;
    try {
      await markListingFilled(l.id);
      qc.invalidateQueries({ queryKey: ["my-listings", user!.id] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Marked as filled 🎉 — your subletter has been prompted to review you.");
      // Open review dialog targeting the most recent messenger
      const { data: conv } = await supabase
        .from("conversations")
        .select("participant_1_id, participant_2_id")
        .eq("listing_id", l.id)
        .or(`participant_1_id.eq.${user!.id},participant_2_id.eq.${user!.id}`)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (conv) {
        const otherId = conv.participant_1_id === user!.id ? conv.participant_2_id : conv.participant_1_id;
        const { data: prof } = await supabase.from("profiles").select("name,email").eq("id", otherId).maybeSingle();
        const name = (prof?.name || prof?.email?.split("@")[0]) ?? "your subletter";
        setReviewFor({ listing: l, userId: otherId, name });
      }
    } catch (e: any) { toast.error(e.message); }
  }

  async function reopen(l: Listing) {
    try {
      await reopenListing(l.id);
      qc.invalidateQueries({ queryKey: ["my-listings", user!.id] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Listing reopened");
    } catch (e: any) { toast.error(e.message); }
  }


  return (
    <div className="min-h-screen bg-background pb-24">
      <Nav
        onPost={() => setPosting(true)}
        onOpenMessages={() => navigate({ to: "/" })}
        onOpenProfile={() => navigate({ to: "/" })}
        search="" onSearch={() => {}}
      />
      <header className="border-b bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-6 flex items-center gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black"><HomeIcon className="h-6 w-6 text-primary" />My listings</h1>
            <p className="text-sm text-muted-foreground">{listings.length} total · {listings.filter(l => l.is_active).length} active</p>
          </div>
          <Button onClick={() => setPosting(true)} className="ml-auto bg-primary hover:bg-primary-dark text-primary-foreground font-bold gap-1">
            <Plus className="h-4 w-4" />New listing
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5 space-y-4">
        {!isLoading && listings.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon="👀" label="Total views" value={totals.views} />
            <StatCard icon="❤️" label="Total saves" value={aggCounts.saves} />
            <StatCard icon="💬" label="Messages" value={aggCounts.messages} />
            <StatCard icon="📋" label="Active listings" value={totals.active} />
          </div>
        )}
        {user && <StaleListingsNudge userId={user.id} onEdit={(id: string) => navigate({ to: "/my-listings/$listingId/analytics", params: { listingId: id } })} />}
        {!isLoading && listings.some((l) => l.is_active && l.status !== "filled") && (
          <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-primary to-[#1D4ED8] p-5 text-primary-foreground shadow-card sm:flex-row sm:items-center">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15 text-2xl">📣</div>
            <div className="min-w-0 flex-1">
              <div className="text-base font-bold">Share your listing</div>
              <div className="text-sm opacity-90">Get more eyes on your listing — share to Instagram. Every Story reaches your whole following.</div>
            </div>
            <ShareToStoryButton
              listing={listings.find((l) => l.is_active && l.status !== "filled")!}
              variant="block"
              label="Create Story Graphic"
              className="bg-white text-primary hover:bg-white/90"
            />
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : listings.length === 0 ? (
          <div className="rounded-xl bg-surface p-12 text-center shadow-card">
            <div className="text-5xl">🏡</div>
            <h3 className="mt-3 text-lg font-bold">No listings yet</h3>
            <Button onClick={() => setPosting(true)} className="mt-4 bg-primary hover:bg-primary-dark text-primary-foreground gap-1"><Plus className="h-4 w-4" />Post your first</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {listings.map(l => {
              const filled = l.status === "filled";
              const stats = shareStats[l.id] ?? { count: 0, lastAt: null };
              const lastShareDays = stats.lastAt ? Math.floor((Date.now() - new Date(stats.lastAt).getTime()) / 86400000) : Infinity;
              const showNudge = !filled && l.is_active && (l.view_count ?? 0) < 50 && lastShareDays >= 7;
              return (
              <div key={l.id} className={cn("rounded-xl bg-surface p-3 shadow-card", !l.is_active && !filled && "opacity-60")}>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelected(l)} className="h-16 w-20 shrink-0 overflow-hidden rounded-md bg-muted relative">
                    {l.photo_urls?.[0] ? <img src={l.photo_urls[0]} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl">🏠</div>}
                    {filled && <div className="absolute inset-0 grid place-items-center bg-black/40 text-[10px] font-black uppercase text-white">Filled</div>}
                  </button>
                  <button onClick={() => setSelected(l)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm truncate">{l.title}</span>
                      {filled
                        ? <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">✓ Filled</span>
                        : !l.is_active && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">Hidden</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">${l.price}/mo · {l.beds} bd · {l.area ?? "Near campus"}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <SafeScoreBadge score={l.safe_score} />
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                        <Eye className="h-3 w-3" />{l.view_count ?? 0}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                        <Share2 className="h-3 w-3" />Shared {stats.count} time{stats.count === 1 ? "" : "s"}
                      </span>
                    </div>
                  </button>
                  {!filled && <ShareToStoryButton listing={l} variant="pill" label="Share" />}
                  <button
                    onClick={() => setStatsOpen((s) => ({ ...s, [l.id]: !s[l.id] }))}
                    title="Stats"
                    className={cn("rounded-md p-2 hover:bg-background", statsOpen[l.id] && "bg-primary/10 text-primary")}
                  >
                    <BarChart3 className="h-4 w-4" />
                  </button>
                  {!filled && (
                    <button
                      onClick={() => setTourFor(l)}
                      title="Tour availability"
                      className="rounded-md p-2 hover:bg-background"
                    >
                      <Calendar className="h-4 w-4" />
                    </button>
                  )}
                  {filled ? (
                    <button onClick={() => reopen(l)} title="Reopen" className="rounded-md p-2 hover:bg-background">
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  ) : (
                    <>
                      <button onClick={() => markFilled(l)} title="Mark as filled" className="rounded-md p-2 text-success hover:bg-success/10">
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => toggleActive(l)} title={l.is_active ? "Hide" : "Show"} className="rounded-md p-2 hover:bg-background">
                        {l.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </>
                  )}
                  <button onClick={() => remove(l)} title="Delete" className="rounded-md p-2 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {statsOpen[l.id] && <ListingStatsPanel listing={l} />}
                {showNudge && (
                  <div className="mt-3 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <div className="text-xl">📣</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">Your listing could use more eyes.</div>
                      <div className="text-xs text-muted-foreground">Share it to your Instagram Story → takes 30 seconds.</div>
                    </div>
                    <ShareToStoryButton listing={l} variant="block" label="Create Story Graphic →" />
                  </div>
                )}
                {!filled && l.is_active && (
                  <div className="mt-3"><BoostCard listingId={l.id} isFeatured={l.is_featured} featuredUntil={l.featured_until} /></div>
                )}
                {l.deposit_escrow_enabled && (
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    <SecureDepositBadge />
                    <span className="text-muted-foreground">${(l.deposit_amount ?? 0).toLocaleString()} held via LeaseUp</span>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </main>
      <ListingDetailSheet
        listing={selected} open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onMessage={() => {}} onViewProfile={() => {}}
      />
      <PostListingDialog open={posting} onOpenChange={(o) => { setPosting(o); if (!o) qc.invalidateQueries({ queryKey: ["my-listings", user.id] }); }} />
      {reviewFor && (
        <LeaveReviewDialog
          open={!!reviewFor}
          onOpenChange={(o) => { if (!o) setReviewFor(null); }}
          reviewedUserId={reviewFor.userId}
          reviewedName={reviewFor.name}
          listingId={reviewFor.listing.id}
          reviewerRole="poster"
        />
      )}
      {tourFor && (
        <TourAvailabilityDialog
          listingId={tourFor.id}
          posterId={user.id}
          open={!!tourFor}
          onOpenChange={(o) => { if (!o) setTourFor(null); }}
        />
      )}
    </div>
  );
}
// Star icon kept imported for future use
void Star;
