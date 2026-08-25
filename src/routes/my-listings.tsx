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
import { fetchMyListings, deleteListing, setListingActive, markListingFilled, reopenListing, relistListing } from "@/lib/leaseup/queries";
import { useSession } from "@/lib/leaseup/use-session";
import { Button } from "@/components/ui/button";
import { ListingDetailSheet } from "@/components/leaseup/ListingDetailSheet";
import { PostListingDialog } from "@/components/leaseup/PostListingDialog";
import { LeaveReviewDialog } from "@/components/leaseup/LeaveReviewDialog";
import { ListerFeedbackModal } from "@/components/leaseup/ListerFeedbackModal";
import { BoostCard } from "@/components/leaseup/BoostListingButton";
import { SecureDepositBadge } from "@/components/leaseup/SecureDepositBadge";
import type { Listing } from "@/lib/leaseup/types";
import { Eye, EyeOff, Trash2, Plus, Home as HomeIcon, CheckCircle2, Star, RotateCcw, Share2, BarChart3, Calendar, Pencil, Bookmark, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { listingCompleteness, completenessStyle } from "@/lib/leaseup/listing-completeness";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ShareToStoryButton } from "@/components/leaseup/ShareToStoryButton";
import { StatCard } from "@/components/leaseup/analytics/Charts";
import { StatsBoundary } from "@/components/leaseup/analytics/StatsBoundary";
import { ListingStatsPanel } from "@/components/leaseup/analytics/ListingStatsPanel";
import { TourAvailabilityDialog } from "@/components/leaseup/TourAvailabilityDialog";
import { StaleListingsNudge } from "@/components/leaseup/StaleListingsNudge";
import { openSignIn } from "@/components/leaseup/SignInModal";

export const Route = createFileRoute("/my-listings")({
  head: () => ({ meta: [{ title: "My listings — LeaseUp" }] }),
  validateSearch: (s: Record<string, unknown>): { boosted?: string; deposit?: string } => ({
    boosted: typeof s?.boosted === "string" ? s.boosted : undefined,
    deposit: typeof s?.deposit === "string" ? s.deposit : undefined,
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
  const [feedbackFor, setFeedbackFor] = useState<Listing | null>(null);
  const [tab, setTab] = useState<"active" | "rented" | "expired">("active");
  /** Q149 — clone an expired listing and jump straight into editing the copy. */
  const [reposting, setReposting] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const isRented = (l: Listing) => l.status === "filled";
  const isExpired = (l: Listing) =>
    !isRented(l) && !!l.available_to && l.available_to < today;
  const isActiveTab = (l: Listing) => !isRented(l) && !isExpired(l);

  const groups = {
    active: listings.filter(isActiveTab),
    rented: listings.filter(isRented),
    expired: listings.filter(isExpired),
  };
  /** Q151 — client-side performance sort, remembered across visits. */
  const [sort, setSort] = useState<"newest" | "views" | "saves">("newest");
  useEffect(() => {
    const s = typeof window !== "undefined" ? localStorage.getItem("leasup_my_listings_sort") : null;
    if (s === "newest" || s === "views" || s === "saves") setSort(s);
  }, []);
  function changeSort(next: "newest" | "views" | "saves") {
    setSort(next);
    try { localStorage.setItem("leasup_my_listings_sort", next); } catch { /* ignore */ }
  }
  const visibleListings = [...groups[tab]].sort((a, b) => {
    if (sort === "views") return (b.view_count ?? 0) - (a.view_count ?? 0);
    if (sort === "saves") return (b.saves_count ?? 0) - (a.saves_count ?? 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const totals = {
    views: listings.reduce((s, l) => s + (l.view_count ?? 0), 0),
    active: groups.active.length,
  };

  const { data: aggCounts = { saves: 0, messages: 0, byListing: {} as Record<string, { saves: number; messages: number; convId: string | null }> }, isLoading: aggLoading } = useQuery({
    queryKey: ["my-listings-aggregates", user?.id, listings.map((l) => l.id).join(",")],
    enabled: !!user && listings.length > 0,
    queryFn: async () => {
      const ids = listings.map((l) => l.id);
      const byListing: Record<string, { saves: number; messages: number; convId: string | null }> = {};
      for (const id of ids) byListing[id] = { saves: 0, messages: 0, convId: null };
      const [sav, convs] = await Promise.all([
        supabase.from("saved_listings").select("listing_id").in("listing_id", ids),
        supabase
          .from("conversations")
          .select("id, listing_id, last_message_at")
          .in("listing_id", ids)
          .order("last_message_at", { ascending: false, nullsFirst: false }),
      ]);
      for (const r of (sav.data ?? []) as { listing_id: string }[]) {
        const e = byListing[r.listing_id];
        if (e) e.saves += 1;
      }
      const convToListing = new Map<string, string>(
        (convs.data ?? []).map((c: any) => [c.id, c.listing_id as string]),
      );
      // Newest conversation per listing → host-side entry point.
      for (const c of (convs.data ?? []) as any[]) {
        const e = byListing[c.listing_id];
        if (e && !e.convId) e.convId = c.id;
      }
      const convIds = [...convToListing.keys()];
      let msgCount = 0;
      if (convIds.length) {
        const m = await supabase
          .from("messages")
          .select("id, conversation_id")
          .in("conversation_id", convIds)
          .neq("sender_id", user!.id);
        for (const row of (m.data ?? []) as { conversation_id: string }[]) {
          msgCount += 1;
          const lid = convToListing.get(row.conversation_id);
          const e = lid ? byListing[lid] : undefined;
          if (e) e.messages += 1;
        }
      }
      return { saves: sav.data?.length ?? 0, messages: msgCount, byListing };
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
        <div className="mx-auto max-w-md p-12 text-center">
          <h2 className="text-xl font-bold">Sign in to manage your listings</h2>
          <button type="button" onClick={() => openSignIn("/my-listings")} className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Sign in</button>
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
    if (!confirm(`Mark "${l.title}" as rented? It will be removed from browse and your profile will show +1 completed sublease.`)) return;
    try {
      await markListingFilled(l.id);
      qc.invalidateQueries({ queryKey: ["my-listings", user!.id] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Listing marked as rented. Nice work! 🎉");
      setFeedbackFor(l);


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
        const { data: prof } = await supabase.from("profiles_public").select("name").eq("id", otherId).maybeSingle();
        const name = prof?.name ?? "your subletter";
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

  function relist(l: Listing) {
    navigate({ to: "/post", search: { relist: l.id } as any });
  }

  async function repost(l: Listing) {
    if (!user) return;
    setReposting(l.id);
    try {
      const newId = await relistListing(l.id, user.id);
      await qc.invalidateQueries({ queryKey: ["my-listings", user.id] });
      toast.success("Reposted — update the dates and save.");
      navigate({ to: "/listing/$id/edit", params: { id: newId } });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't repost that listing");
    } finally {
      setReposting(null);
    }
  }





  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-gray-100 bg-surface dark:border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">My subleases</h1>
            <p className="text-sm text-muted-foreground">{listings.length} total · {listings.filter(l => l.is_active).length} active</p>
          </div>
          <button
            type="button"
            onClick={() => setPosting(true)}
            className="rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition active:scale-95 sm:ml-auto dark:bg-foreground dark:text-background"
          >
            Post a sublease →
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5 space-y-4">
        {!isLoading && listings.length === 0 && (
          <div className="mx-auto max-w-md rounded-2xl bg-surface p-10 text-center shadow-card">
            <div className="text-5xl">🏡</div>
            <h2 className="mt-3 text-lg font-bold">You haven't posted a sublease yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Post one in about 2 minutes and reach students at your campus.
            </p>
            <Button onClick={() => setPosting(true)} className="mt-5 gap-1 bg-primary text-primary-foreground hover:bg-primary-dark">
              <Plus className="h-4 w-4" />Post a sublease →
            </Button>
          </div>
        )}
        <StatsBoundary>
          <>
            {!isLoading && listings.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon="👀" label="Total views" value={totals.views} />
                <StatCard icon="❤️" label="Total saves" value={aggCounts.saves} />
                <StatCard icon="💬" label="Messages" value={aggCounts.messages} />
                <StatCard icon="📋" label="Active listings" value={totals.active} />
              </div>
            )}
            {user && listings.length > 0 && <StaleListingsNudge userId={user.id} onEdit={(id: string) => navigate({ to: "/my-listings/$listingId/analytics", params: { listingId: id } })} />}
          </>
        </StatsBoundary>
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

        <div className={cn("flex items-center justify-between gap-3", !isLoading && listings.length === 0 && "hidden")}>
          <div className="flex gap-2 overflow-x-auto pb-1">
          {(["active", "rented", "expired"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm capitalize transition",
                tab === t
                  ? "border-gray-900 bg-gray-900 font-semibold text-white dark:border-foreground dark:bg-foreground dark:text-background"
                  : "border-gray-200 bg-white font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-surface dark:text-foreground",
              )}
            >
              {t}{groups[t].length > 0 ? ` (${groups[t].length})` : ""}
            </button>
          ))}
          </div>
          <label className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
            Sort:
            <select
              value={sort}
              onChange={(e) => changeSort(e.target.value as "newest" | "views" | "saves")}
              className="rounded-full border border-border bg-surface px-2 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
            >
              <option value="newest">Newest</option>
              <option value="views">Most viewed</option>
              <option value="saves">Most saved</option>
            </select>
          </label>
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : listings.length === 0 ? null : visibleListings.length === 0 ? (
          <div className="rounded-xl bg-surface p-12 text-center shadow-card">
            <div className="text-5xl">{tab === "rented" ? "🎉" : tab === "expired" ? "⏰" : "🏡"}</div>
            <h3 className="mt-3 text-lg font-bold">
              {tab === "active" ? (listings.length === 0 ? "No listings yet" : "No active listings")
                : tab === "rented" ? "No completed subleases yet"
                : "No expired listings"}
            </h3>
            {tab === "active" && (
              <Button onClick={() => setPosting(true)} className="mt-4 bg-primary hover:bg-primary-dark text-primary-foreground gap-1"><Plus className="h-4 w-4" />Post {listings.length === 0 ? "your first" : "a listing"}</Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleListings.map(l => {
              const filled = isRented(l);
              const expired = isExpired(l);
              const stats = shareStats[l.id] ?? { count: 0, lastAt: null };
              const perListing = aggCounts.byListing?.[l.id] ?? { saves: l.saves_count ?? 0, messages: 0, convId: null as string | null };

              const lastShareDays = stats.lastAt ? Math.floor((Date.now() - new Date(stats.lastAt).getTime()) / 86400000) : Infinity;
              const ageDays = (Date.now() - new Date(l.created_at as string).getTime()) / 86400000;
              const showNudge = !filled && !expired && l.is_active && (l.view_count ?? 0) < 50 && lastShareDays >= 7;
              return (
              <div key={l.id} className={cn("rounded-xl bg-surface p-3 shadow-card", ((!l.is_active && !filled) || expired) && "opacity-80")}>
                {expired && (
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                    <span className="font-semibold">
                      This listing ended {l.available_to ? `on ${new Date(l.available_to).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}.
                    </span>
                    <span className="opacity-80">Did you find someone?</span>
                    <button onClick={() => markFilled(l)} className="ml-auto rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700">Mark as rented</button>
                    <button onClick={() => relist(l)} className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground hover:bg-primary-dark">Relist →</button>
                    <button
                      onClick={() => repost(l)}
                      disabled={reposting === l.id}
                      className="rounded-full border border-primary px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/10 disabled:opacity-60"
                    >
                      {reposting === l.id ? "Reposting…" : "Repost"}
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <button onClick={() => setSelected(l)} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-muted">
                    {l.photo_urls?.[0] ? <img src={l.photo_urls[0]} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl">🏠</div>}
                    {filled && <div className="absolute inset-0 grid place-items-center bg-black/40 text-[10px] font-black uppercase text-white">Rented</div>}
                    {expired && <div className="absolute inset-0 grid place-items-center bg-black/40 text-[10px] font-black uppercase text-white">Expired</div>}
                  </button>
                  <button onClick={() => setSelected(l)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{l.title}</span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                        <span className={cn("h-1.5 w-1.5 rounded-full", filled ? "bg-gray-400" : expired ? "bg-gray-400" : !l.is_active ? "bg-amber-500" : "bg-emerald-500")} />
                        {filled ? "Rented" : expired ? "Expired" : !l.is_active ? "Hidden" : "Active"}
                      </span>
                    </div>
                    {(() => {
                      const pct = listingCompleteness(l);
                      const c = completenessStyle(pct);
                      return (
                        <span
                          title="Complete listings get 3x more messages"
                          className={cn("mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", c.className)}
                        >
                          {c.label}
                        </span>
                      );
                    })()}
                    <div className="text-sm text-gray-500">
                      {l.area ?? "Near campus"} · {l.beds === 0 ? "Studio" : `${l.beds}bd`} · {l.baths}ba · ${l.price}/mo
                    </div>
                    {(l.available_from || l.available_to) && (
                      <div className="text-xs text-gray-400">
                        {[l.available_from, l.available_to]
                          .filter(Boolean)
                          .map((d) => new Date(d as string).toLocaleDateString("en-US", { month: "short", day: "numeric" }))
                          .join(" – ")}
                      </div>
                    )}
                    {/* Q174 — only surface non-zero stats; never a wall of zeros */}
                    {aggLoading ? (
                      <div className="mt-1 h-4 w-52 animate-pulse rounded bg-muted" aria-hidden />
                    ) : (() => {
                      const v = l.view_count ?? 0;
                      const sv = perListing.saves ?? 0;
                      const ms = perListing.messages ?? 0;
                      const sh = stats.count ?? 0;
                      if (v === 0 && sv === 0 && ms === 0 && sh === 0) {
                        return (
                          <p className="mt-1 text-xs text-gray-500">Just posted — share it to get your first views</p>
                        );
                      }
                      return (
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          {v > 0 && (
                            <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /><span className="font-semibold text-gray-700 dark:text-foreground">{v}</span> view{v === 1 ? "" : "s"}</span>
                          )}
                          {sv > 0 && (
                            <span className="inline-flex items-center gap-1"><Bookmark className="h-3 w-3" /><span className="font-semibold text-gray-700 dark:text-foreground">{sv}</span> save{sv === 1 ? "" : "s"}</span>
                          )}
                          {ms > 0 && (
                            <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" /><span className="font-semibold text-gray-700 dark:text-foreground">{ms}</span> message{ms === 1 ? "" : "s"}</span>
                          )}
                          {sh > 0 && (
                            <span className="inline-flex items-center gap-1"><Share2 className="h-3 w-3" />Shared {sh} time{sh === 1 ? "" : "s"}</span>
                          )}
                          {v > 0 && ageDays < 7 && (
                            <span className="rounded bg-green-50 px-1.5 text-xs font-semibold text-green-600">↗ Active</span>
                          )}
                        </div>
                      );
                    })()}


                  </button>

                  {(l.status ?? "active") === "active" && <BumpButton listing={l} />}
                  {!filled && <ShareToStoryButton listing={l} variant="pill" label="Share" />}
                  <button
                    onClick={() => setStatsOpen((s) => ({ ...s, [l.id]: !s[l.id] }))}
                    title="Stats"
                    className={cn("rounded-md p-2 hover:bg-background", statsOpen[l.id] && "bg-primary/10 text-primary")}
                  >
                    <BarChart3 className="h-4 w-4" />
                  </button>
                  <Link
                    to="/listing/$id/edit"
                    params={{ id: l.id }}
                    title="Edit listing"
                    className="rounded-md p-2 hover:bg-background"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
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
                {/* Q182 — inquiries deep-link into the Inquiries tab, filtered to this listing */}
                {(() => {
                  const ms = perListing.messages ?? 0;
                  if (ms === 0) return null;
                  return (
                    <div className="mt-2 flex items-center gap-2 px-1 text-xs text-gray-500">
                      <Link
                        to="/messages"
                        search={{ tab: "inquiries", listing: l.id } as never}
                        className="font-semibold text-primary hover:underline"
                      >
                        💬 {ms} inquir{ms === 1 ? "y" : "ies"} — open inbox →
                      </Link>
                    </div>
                  );
                })()}


                {!filled && !expired && (

                  <RenewalNudge
                    listing={l}
                    onExtended={() => qc.invalidateQueries({ queryKey: ["my-listings", user!.id] })}
                    onMarkTaken={() => markFilled(l)}
                  />
                )}
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
      {feedbackFor && (
        <ListerFeedbackModal
          open={!!feedbackFor}
          onClose={() => setFeedbackFor(null)}
          listingId={feedbackFor.id}
          listingTitle={feedbackFor.title}
          userId={user.id}
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

/**
 * Q163 — renewal nudge. Shows an amber banner when a listing's available_to
 * date is within 14 days, with an inline date picker to extend it.
 */
function RenewalNudge({
  listing,
  onExtended,
  onMarkTaken,
}: {
  listing: Listing;
  onExtended: () => void;
  onMarkTaken: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(listing.available_to ?? "");
  const [saving, setSaving] = useState(false);

  if (!listing.available_to) return null;
  const days = Math.ceil(
    (new Date(listing.available_to).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (!Number.isFinite(days) || days < 0 || days > 14) return null;

  async function save() {
    if (!date) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("listings")
        .update({ available_to: date })
        .eq("id", listing.id);
      if (error) throw error;
      toast.success("Listing extended ✓");
      setOpen(false);
      onExtended();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't extend that listing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="-mt-1 rounded-b-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-amber-900 dark:text-amber-200">
          ⏰ Expires in {days} day{days === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-full bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700"
          >
            Extend dates
          </button>
          <button
            type="button"
            onClick={onMarkTaken}
            className="rounded-full border border-amber-300 px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-500/20"
          >
            Mark as taken
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs dark:bg-background"
          />
          <button
            type="button"
            disabled={saving || !date}
            onClick={save}
            className="rounded-full bg-gray-900 px-3 py-1 text-[11px] font-bold text-white disabled:opacity-50 dark:bg-foreground dark:text-background"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Q170 — "Bump" refreshes a listing's updated_at so it sorts to the top of
 * Newest. Rate limited to once per 24h via a localStorage timestamp.
 */
function BumpButton({ listing }: { listing: Listing }) {
  const KEY = `leasup_bump_${listing.id}`;
  const [last, setLast] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      setLast(Number(window.localStorage.getItem(KEY) ?? 0));
    } catch {
      /* storage blocked */
    }
  }, [KEY]);

  const limited = Date.now() - last < 24 * 60 * 60 * 1000;

  async function bump() {
    if (limited || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("listings")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", listing.id);
      if (error) throw error;
      const now = Date.now();
      try { window.localStorage.setItem(KEY, String(now)); } catch { /* ignore */ }
      setLast(now);
      toast.success("⬆️ Listing bumped to top!");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't bump that listing");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={bump}
      disabled={limited || busy}
      title={limited ? "Bumped recently — try again tomorrow" : "Bump to top"}
      className={cn(
        "flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-600 transition hover:bg-indigo-100",
        limited && "cursor-not-allowed opacity-40 hover:bg-indigo-50",
      )}
    >
      ⬆️ Bump
    </button>
  );
}
