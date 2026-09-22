/**
 * Admin/moderation dashboard. Visibility is gated client-side by
 * profile.is_admin, but every mutation also passes through RLS policies
 * that re-check is_admin — never rely on the client gate alone.
 *
 * Tabs:
 *   overview    Platform stats, growth charts, per-campus breakdown.
 *   reports     User-filed reports queue, sorted by priority (urgent→low),
 *               with auto-flag indicators + report-volume counts.
 *   suspicious  Listings the AI screener marked pending_review or that the
 *               suspicious_listings view caught (price/text anomalies,
 *               duplicate photos, etc.).
 *   listings    All listings with hide/show/delete actions.
 *   users       All profiles with verified/admin/ambassador/ban toggles
 *               and a RiskBadge from user_risk_scores.
 *   revenue     Boost purchases — total revenue, refunds, time series.
 *   deposits    Escrow agreements with release/refund actions
 *               (adminReleaseDeposit / adminRefundDeposit server fns).
 *
 * head() sets robots=noindex — do not remove. This route must never be
 * crawlable.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import {
  fetchReports, resolveReport, adminFetchAllListings, adminFetchAllProfiles,
  adminSetListing, adminDeleteListing, adminSetProfile, fetchPlatformStats,
  fetchSuspiciousListings, fetchUserRiskScores,
} from "@/lib/leaseup/admin.queries";
import { fetchCampuses } from "@/lib/leaseup/campuses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { timeAgo } from "@/lib/leaseup/constants";
import { fetchGrowthMetrics } from "@/lib/leaseup/analytics.queries";
import { LineChart as AnalyticsLineChart } from "@/components/leaseup/analytics/Charts";
import { ShieldCheck, AlertTriangle, Users, Home, Trash2, EyeOff, Eye, Ban, BadgeCheck, Flag, Sparkles, DollarSign, Lock, ShieldAlert, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminReleaseDeposit, adminRefundDeposit } from "@/lib/leaseup/stripe.functions";
import { UserAvatar } from "@/components/leaseup/UserAvatar";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — LeaseUp" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminPage,
});

type Tab = "overview" | "reports" | "suspicious" | "listings" | "users" | "revenue" | "deposits" | "feedback";

function AdminPage() {
  const { user, loading } = useSession();
  const { data: me, isLoading: profileLoading } = useMyProfile();
  const [tab, setTab] = useState<Tab>("overview");

  if (loading || (user && profileLoading)) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!user || !me?.is_admin) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-md mt-24 rounded-2xl bg-surface p-8 shadow-card-md text-center">
          <div className="text-4xl">🚫</div>
          <h1 className="mt-2 text-xl font-black">Admin access only</h1>
          <p className="mt-1 text-sm text-muted-foreground">You don't have permission to view this page.</p>
          <Link to="/" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Back to LeaseUp</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-black">Admin</h1>
        </div>
        <div className="flex gap-1 border-b mb-6 overflow-x-auto">
          {([
            ["overview", "Overview", Home],
            ["reports", "Reports", AlertTriangle],
            ["suspicious", "Suspicious", ShieldAlert],
            ["listings", "Listings", Home],
            ["users", "Users", Users],
            ["revenue", "Revenue", DollarSign],
            ["deposits", "Deposits", Lock],
            ["feedback", "Feedback", MessageCircle],
          ] as const).map(([t, label, Icon]) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-bold whitespace-nowrap",
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab />}
        {tab === "reports" && <ReportsTab adminId={user!.id} />}
        {tab === "suspicious" && <SuspiciousTab />}
        {tab === "listings" && <ListingsTab />}
        {tab === "users" && <UsersTab />}
        {tab === "revenue" && <RevenueTab />}
        {tab === "deposits" && <DepositsTab />}
        {tab === "feedback" && <FeedbackTab />}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-surface p-5 shadow-card">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="mt-1 text-3xl font-black">{value}</div>
    </div>
  );
}

function OverviewTab() {
  const { data: stats } = useQuery({ queryKey: ["admin", "stats"], queryFn: fetchPlatformStats });
  const { data: growth } = useQuery({
    queryKey: ["admin", "growth"],
    queryFn: () => fetchGrowthMetrics(30),
  });
  if (!stats) return <div className="text-sm text-muted-foreground">Loading…</div>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total users" value={stats.totalUsers} />
        <StatCard label="Active listings" value={stats.activeListings} />
        <StatCard label="Signups today" value={stats.signupsToday} />
        <StatCard label="Messages (7d)" value={stats.messagesThisWeek} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Tours requested (7d)" value={stats.toursRequestedWeek} />
        <StatCard label="Tours confirmed (7d)" value={stats.toursConfirmedWeek} />
        <StatCard label="Tours completed" value={stats.toursCompleted} />
        <StatCard label="No-show rate" value={`${stats.noShowRate.toFixed(0)}%`} />
      </div>

      {growth && (
        <div className="grid gap-4 md:grid-cols-3">
          <GrowthMini title="Signups (30d)" data={growth.signups} />
          <GrowthMini title="New listings (30d)" data={growth.listings} />
          <GrowthMini title="Messages (30d)" data={growth.messages} />
        </div>
      )}

      {growth && (
        <div className="rounded-xl bg-surface p-5 shadow-card">
          <h2 className="font-black mb-3">Listing mix (last 30 days)</h2>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div><div className="text-2xl font-black text-success">{growth.listingMix.active}</div><div className="text-xs text-muted-foreground">Active</div></div>
            <div><div className="text-2xl font-black text-primary">{growth.listingMix.filled}</div><div className="text-xs text-muted-foreground">Filled</div></div>
            <div><div className="text-2xl font-black text-muted-foreground">{growth.listingMix.inactive}</div><div className="text-xs text-muted-foreground">Inactive</div></div>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-surface p-5 shadow-card">
        <h2 className="font-black mb-3">Active listings per campus</h2>
        {stats.perCampus.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active listings yet.</p>
        ) : (
          <ul className="space-y-2">
            {stats.perCampus.map(row => (
              <li key={row.campus} className="flex items-center justify-between text-sm">
                <span className="font-semibold">{row.campus}</span>
                <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-bold text-primary-dark">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function GrowthMini({ title, data }: { title: string; data: { date: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="rounded-xl bg-surface p-4 shadow-card">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-bold">{title}</h3>
        <span className="text-lg font-black tabular-nums">{total}</span>
      </div>
      <div className="mt-2"><AnalyticsLineChart data={data} height={120} /></div>
    </div>
  );
}

function ReportsTab({ adminId }: { adminId: string }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"open" | "all">("open");
  const { data: reports = [] } = useQuery({
    queryKey: ["admin", "reports", filter],
    queryFn: () => fetchReports(filter),
  });

  async function act(id: string, status: "dismissed" | "actioned", afterRemove?: () => Promise<void>) {
    try {
      if (afterRemove) await afterRemove();
      await resolveReport(id, status, adminId);
      qc.invalidateQueries({ queryKey: ["admin", "reports"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Report resolved");
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["open", "all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-bold",
              filter === f ? "bg-primary text-primary-foreground" : "bg-surface border hover:bg-background")}>
            {f === "open" ? "Open" : "All"}
          </button>
        ))}
      </div>
      {reports.length === 0 ? (
        <div className="rounded-xl bg-surface p-8 text-center shadow-card text-sm text-muted-foreground">
          🎉 No {filter === "open" ? "open " : ""}reports.
        </div>
      ) : reports.map(r => (
        <div key={r.id} className="rounded-xl bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {r.priority && r.priority !== "normal" && (
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                    r.priority === "urgent" && "bg-red-600 text-white animate-pulse",
                    r.priority === "high" && "bg-orange-500 text-white",
                    r.priority === "low" && "bg-muted text-muted-foreground",
                  )}>{r.priority}</span>
                )}
                <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-bold uppercase">{r.reason}</span>
                {r.auto_flagged && (
                  <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold uppercase">Auto</span>
                )}
                {(r.reportCount ?? 1) > 1 && (
                  <span className="rounded-full bg-background border px-2 py-0.5 text-[10px] font-bold">×{r.reportCount} on this listing</span>
                )}
                <span className="text-[11px] text-muted-foreground">{timeAgo(r.created_at)}</span>
                {r.status !== "open" && (
                  <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-bold uppercase">{r.status}</span>
                )}
              </div>
              <div className="mt-1 font-bold truncate">{r.listing?.title ?? "(listing deleted)"}</div>
              {r.details && <p className="mt-1 text-xs text-muted-foreground">"{r.details}"</p>}
              <div className="mt-1 text-[11px] text-muted-foreground">
                Reported by {r.reporter?.name ?? "—"} ({r.reporter?.email ?? "—"})
              </div>
            </div>
            {r.status === "open" && (
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => act(r.id, "dismissed")}>Dismiss</Button>
                <Button size="sm" variant="outline" onClick={() => r.listing && act(r.id, "actioned", () => adminSetListing(r.listing!.id, { is_active: false, flagged: true }))}>
                  <EyeOff className="h-3.5 w-3.5 mr-1" />Remove listing
                </Button>
                {r.listing && (
                  <Button size="sm" variant="destructive"
                    onClick={() => confirm(`Ban user ${r.listing!.user_id.slice(0,8)}…?`) && act(r.id, "actioned", async () => {
                      await adminSetProfile(r.listing!.user_id, { banned: true });
                      await adminSetListing(r.listing!.id, { is_active: false, flagged: true });
                    })}>
                    <Ban className="h-3.5 w-3.5 mr-1" />Ban user
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListingsTab() {
  const qc = useQueryClient();
  const { data: listings = [] } = useQuery({ queryKey: ["admin", "listings"], queryFn: adminFetchAllListings });
  const { data: campuses = [] } = useQuery({ queryKey: ["campuses"], queryFn: fetchCampuses });
  const { data: profiles = [] } = useQuery({ queryKey: ["admin", "profiles"], queryFn: adminFetchAllProfiles });
  const [search, setSearch] = useState("");
  const [campusId, setCampusId] = useState("");

  const userMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const campusMap = useMemo(() => new Map(campuses.map(c => [c.id, c])), [campuses]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return listings.filter(l => {
      if (campusId && l.campus_id !== campusId) return false;
      if (!q) return true;
      const u = userMap.get(l.user_id);
      return l.title.toLowerCase().includes(q) || (u?.email ?? "").toLowerCase().includes(q) || (u?.name ?? "").toLowerCase().includes(q);
    });
  }, [listings, search, campusId, userMap]);

  async function update(id: string, patch: any) {
    try { await adminSetListing(id, patch); qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["listings"] }); }
    catch (e: any) { toast.error(e.message); }
  }

  async function remove(id: string) {
    if (!confirm("Permanently delete this listing?")) return;
    try { await adminDeleteListing(id); qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["listings"] }); toast.success("Deleted"); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, user…" className="max-w-xs" />
        <select value={campusId} onChange={e => setCampusId(e.target.value)} className="h-9 rounded-md border bg-surface px-2 text-sm">
          <option value="">All campuses</option>
          {campuses.map(c => <option key={c.id} value={c.id}>{c.short_name}</option>)}
        </select>
        <div className="ml-auto text-xs text-muted-foreground self-center">{filtered.length} of {listings.length}</div>
      </div>
      <div className="rounded-xl bg-surface shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-background text-xs uppercase">
            <tr><th className="p-2 text-left">Title</th><th className="p-2 text-left">Campus</th><th className="p-2 text-left">Owner</th>
              <th className="p-2 text-left">Status</th><th className="p-2 text-left">Posted</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {filtered.map(l => {
              const u = userMap.get(l.user_id);
              const c = campusMap.get(l.campus_id);
              return (
                <tr key={l.id} className="border-t">
                  <td className="p-2 font-semibold max-w-xs truncate">{l.title}</td>
                  <td className="p-2 text-xs">{c?.short_name ?? "—"}</td>
                  <td className="p-2 text-xs">{u?.name ?? "—"}<div className="text-muted-foreground">{u?.email}</div></td>
                  <td className="p-2 text-xs">
                    {l.is_active ? <span className="text-success">Active</span> : <span className="text-muted-foreground">Hidden</span>}
                    {l.flagged && <span className="ml-1 rounded bg-red-100 text-red-700 px-1.5 py-0.5 text-[10px] font-bold">FLAGGED</span>}
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">{timeAgo(l.created_at)}</td>
                  <td className="p-2">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => update(l.id, { is_active: !l.is_active })} title={l.is_active ? "Hide" : "Show"}>
                        {l.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => update(l.id, { flagged: !l.flagged })} title="Flag">
                        <Flag className={cn("h-3.5 w-3.5", l.flagged && "text-red-600")} />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => remove(l.id)} title="Delete">
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ["admin", "profiles"], queryFn: adminFetchAllProfiles });
  const { data: listings = [] } = useQuery({ queryKey: ["admin", "listings"], queryFn: adminFetchAllListings });
  const [search, setSearch] = useState("");

  const listingCount = useMemo(() => {
    const m = new Map<string, number>();
    listings.forEach(l => m.set(l.user_id, (m.get(l.user_id) ?? 0) + 1));
    return m;
  }, [listings]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u => !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, search]);

  async function update(id: string, patch: any, label: string) {
    try { await adminSetProfile(id, patch); qc.invalidateQueries({ queryKey: ["admin"] }); toast.success(label); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…" className="max-w-xs" />
        <div className="ml-auto text-xs text-muted-foreground self-center">{filtered.length} of {users.length}</div>
      </div>
      <div className="rounded-xl bg-surface shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-background text-xs uppercase">
            <tr><th className="p-2 text-left">User</th><th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Listings</th><th className="p-2 text-left">Joined</th>
              <th className="p-2 text-left">Status</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className="border-t">
                <td className="p-2 font-semibold">
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      name={u.name ?? u.email ?? null}
                      avatarUrl={u.avatar_url}
                      color={u.banner_color ?? null}
                      className="h-7 w-7"
                      textClassName="text-xs"
                    />
                    {u.name ?? "—"}
                  </div>
                </td>
                <td className="p-2 text-xs">{u.email}</td>
                <td className="p-2 text-xs">{listingCount.get(u.id) ?? 0}</td>
                <td className="p-2 text-xs text-muted-foreground">{timeAgo(u.created_at)}</td>
                <td className="p-2 text-xs">
                  <RiskBadge userId={u.id} banned={!!u.banned} verified={!!u.verified_email} />
                  {u.verified_email && <span className="rounded bg-success-light text-success px-1.5 py-0.5 text-[10px] font-bold mr-1 ml-1">VERIFIED</span>}
                  {u.is_admin && <span className="rounded bg-primary-light text-primary-dark px-1.5 py-0.5 text-[10px] font-bold mr-1">ADMIN</span>}
                  {(u as any).is_ambassador && <span className="rounded bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-bold mr-1">AMBASSADOR</span>}
                  {u.banned && <span className="rounded bg-red-100 text-red-700 px-1.5 py-0.5 text-[10px] font-bold">BANNED</span>}
                </td>
                <td className="p-2">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="outline" onClick={() => update(u.id, { verified_email: !u.verified_email }, u.verified_email ? "Unverified" : "Verified")} title="Toggle verified">
                      <BadgeCheck className={cn("h-3.5 w-3.5", u.verified_email && "text-success")} />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => update(u.id, { is_ambassador: !(u as any).is_ambassador }, (u as any).is_ambassador ? "Removed ambassador" : "Made ambassador")} title="Toggle ambassador">
                      <Sparkles className={cn("h-3.5 w-3.5", (u as any).is_ambassador && "text-primary")} />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => confirm(u.banned ? "Unban?" : "Ban this user?") && update(u.id, { banned: !u.banned }, u.banned ? "Unbanned" : "Banned")} title="Toggle ban">
                      <Ban className={cn("h-3.5 w-3.5", u.banned && "text-red-600")} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Queue 17 — Revenue + Deposits tabs
// ────────────────────────────────────────────────────────────────

type BoostRow = {
  id: string;
  listing_id: string | null;
  user_id: string | null;
  amount_cents: number | null;
  status: string;
  created_at: string;
  paid_at: string | null;
  stripe_session_id: string | null;
};

type DepositRow = {
  id: string;
  listing_id: string | null;
  poster_id: string | null;
  subletter_id: string | null;
  deposit_amount_cents: number;
  platform_fee_cents: number | null;
  total_charged_cents: number | null;
  status: string;
  stripe_payment_intent_id: string | null;
  move_in_date: string | null;
  created_at: string;
  paid_at: string | null;
  released_at: string | null;
};

function money(cents?: number | null) {
  if (!cents) return "$0.00";
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function RevenueTab() {
  const { data: boosts = [] } = useQuery<BoostRow[]>({
    queryKey: ["admin", "boosts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boost_purchases")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BoostRow[];
    },
  });
  const { data: deposits = [] } = useQuery<DepositRow[]>({
    queryKey: ["admin", "deposits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deposit_agreements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DepositRow[];
    },
  });
  const { data: profiles = [] } = useQuery({ queryKey: ["admin", "profiles"], queryFn: adminFetchAllProfiles });
  const { data: listings = [] } = useQuery({ queryKey: ["admin", "listings"], queryFn: adminFetchAllListings });
  const userMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const listingMap = useMemo(() => new Map(listings.map(l => [l.id, l])), [listings]);

  const paidBoosts = boosts.filter(b => b.status === "paid");
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thisMonthBoosts = paidBoosts.filter(b => new Date(b.created_at) >= monthStart);
  const boostTotalAll = paidBoosts.reduce((s, b) => s + (b.amount_cents ?? 0), 0);
  const boostTotalMonth = thisMonthBoosts.reduce((s, b) => s + (b.amount_cents ?? 0), 0);

  const heldTotal = deposits.filter(d => d.status === "held" || d.status === "paid").reduce((s, d) => s + d.deposit_amount_cents, 0);
  const releasedTotal = deposits.filter(d => d.status === "released").reduce((s, d) => s + d.deposit_amount_cents, 0);
  const refundedTotal = deposits.filter(d => d.status === "refunded").reduce((s, d) => s + d.deposit_amount_cents, 0);
  const feeTotal = deposits.filter(d => ["held", "paid", "released"].includes(d.status)).reduce((s, d) => s + (d.platform_fee_cents ?? 0), 0);

  const projectedMrr = thisMonthBoosts.length * 9.99;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Boost revenue (all-time)" value={money(boostTotalAll)} />
        <StatCard label="Boost revenue (this month)" value={money(boostTotalMonth)} />
        <StatCard label="# boosts this month" value={thisMonthBoosts.length} />
        <StatCard label="Projected MRR" value={`$${projectedMrr.toFixed(2)}`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Deposits held" value={money(heldTotal)} />
        <StatCard label="Deposits released" value={money(releasedTotal)} />
        <StatCard label="Deposits refunded" value={money(refundedTotal)} />
        <StatCard label="Platform fees earned" value={money(feeTotal)} />
      </div>

      <div className="rounded-xl bg-surface shadow-card overflow-hidden">
        <div className="border-b p-3 font-black">Featured listing boosts</div>
        <table className="w-full text-sm">
          <thead className="bg-background text-xs uppercase">
            <tr><th className="p-2 text-left">Listing</th><th className="p-2 text-left">Buyer</th><th className="p-2 text-left">Amount</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Date</th></tr>
          </thead>
          <tbody>
            {boosts.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">No boost purchases yet.</td></tr>}
            {boosts.map(b => {
              const l = b.listing_id ? listingMap.get(b.listing_id) : undefined;
              const u = b.user_id ? userMap.get(b.user_id) : undefined;
              return (
                <tr key={b.id} className="border-t">
                  <td className="p-2 font-semibold max-w-xs truncate">{l?.title ?? "(deleted)"}</td>
                  <td className="p-2 text-xs">{u?.name ?? "—"}<div className="text-muted-foreground">{u?.email}</div></td>
                  <td className="p-2 text-xs font-bold tabular-nums">{money(b.amount_cents)}</td>
                  <td className="p-2 text-xs">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      b.status === "paid" ? "bg-success-light text-success" :
                      b.status === "refunded" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground")}>
                      {b.status}
                    </span>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">{timeAgo(b.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DepositsTab() {
  const qc = useQueryClient();
  const release = useServerFn(adminReleaseDeposit);
  const refund = useServerFn(adminRefundDeposit);
  const { data: deposits = [], isLoading } = useQuery<DepositRow[]>({
    queryKey: ["admin", "deposits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deposit_agreements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DepositRow[];
    },
  });
  const { data: profiles = [] } = useQuery({ queryKey: ["admin", "profiles"], queryFn: adminFetchAllProfiles });
  const { data: listings = [] } = useQuery({ queryKey: ["admin", "listings"], queryFn: adminFetchAllListings });
  const userMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const listingMap = useMemo(() => new Map(listings.map(l => [l.id, l])), [listings]);

  async function onRelease(id: string) {
    if (!confirm("Release these funds to the poster? This captures the held payment.")) return;
    try { await release({ data: { agreementId: id } }); toast.success("Funds released"); qc.invalidateQueries({ queryKey: ["admin", "deposits"] }); }
    catch (e: any) { toast.error(e.message ?? "Release failed"); }
  }
  async function onRefund(id: string) {
    if (!confirm("Refund this deposit to the subletter? This cannot be undone.")) return;
    try { await refund({ data: { agreementId: id } }); toast.success("Refunded"); qc.invalidateQueries({ queryKey: ["admin", "deposits"] }); }
    catch (e: any) { toast.error(e.message ?? "Refund failed"); }
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-surface shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-background text-xs uppercase">
            <tr>
              <th className="p-2 text-left">Listing</th>
              <th className="p-2 text-left">Poster ↔ Subletter</th>
              <th className="p-2 text-left">Amount</th>
              <th className="p-2 text-left">Move-in</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {deposits.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">No deposit agreements yet. Once a subletter pays, agreements appear here.</td></tr>}
            {deposits.map(d => {
              const l = d.listing_id ? listingMap.get(d.listing_id) : undefined;
              const poster = d.poster_id ? userMap.get(d.poster_id) : undefined;
              const subletter = d.subletter_id ? userMap.get(d.subletter_id) : undefined;
              const canRelease = ["held", "paid"].includes(d.status);
              const canRefund = ["held", "paid", "pending"].includes(d.status);
              return (
                <tr key={d.id} className="border-t align-top">
                  <td className="p-2 font-semibold max-w-xs truncate">{l?.title ?? "(deleted)"}</td>
                  <td className="p-2 text-xs">
                    <div>{poster?.name ?? "—"}</div>
                    <div className="text-muted-foreground">→ {subletter?.name ?? "—"}</div>
                  </td>
                  <td className="p-2 text-xs">
                    <div className="font-bold tabular-nums">{money(d.deposit_amount_cents)}</div>
                    <div className="text-muted-foreground">fee {money(d.platform_fee_cents)}</div>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">{d.move_in_date ? new Date(d.move_in_date).toLocaleDateString() : "—"}</td>
                  <td className="p-2 text-xs">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      d.status === "held" || d.status === "paid" ? "bg-amber-100 text-amber-800" :
                      d.status === "released" ? "bg-success-light text-success" :
                      d.status === "refunded" ? "bg-red-100 text-red-700" :
                      d.status === "disputed" ? "bg-orange-100 text-orange-700" :
                      "bg-muted text-muted-foreground")}>
                      {d.status}
                    </span>
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" disabled={!canRelease} onClick={() => onRelease(d.id)}>Release</Button>
                      <Button size="sm" variant="outline" disabled={!canRefund} onClick={() => onRefund(d.id)}>Refund</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Queue 21 — Trust & Safety: Suspicious tab + Risk badges
// ────────────────────────────────────────────────────────────────

function useRiskScores() {
  return useQuery({ queryKey: ["admin", "risk-scores"], queryFn: fetchUserRiskScores, staleTime: 60_000 });
}

function RiskBadge({ userId, banned, verified }: { userId: string; banned: boolean; verified: boolean }) {
  const { data: rows } = useRiskScores();
  const row = rows?.find(r => r.id === userId);
  const level = row?.risk_level
    ?? (banned ? "banned" : !verified ? "unverified" : "good_standing");
  const map: Record<string, { label: string; cls: string }> = {
    banned: { label: "BANNED", cls: "bg-red-600 text-white" },
    high_risk: { label: "HIGH RISK", cls: "bg-red-100 text-red-700" },
    low_trust: { label: "LOW TRUST", cls: "bg-amber-100 text-amber-800" },
    unverified: { label: "UNVERIFIED", cls: "bg-muted text-muted-foreground" },
    good_standing: { label: "OK", cls: "bg-success-light text-success" },
  };
  const m = map[level] ?? map.good_standing;
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-black", m.cls)} title={`${row?.reports_received ?? 0} reports received`}>
      {m.label}
    </span>
  );
}

function SuspiciousTab() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "suspicious"],
    queryFn: fetchSuspiciousListings,
  });

  async function clearFlag(id: string) {
    try {
      await adminSetListing(id, { is_active: true });
      // approval = mark verified to remove from view
      await supabase.from("listings").update({ is_verified: true, pending_review: false } as any).eq("id", id);
      qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Approved");
    } catch (e: any) { toast.error(e.message); }
  }
  async function remove(id: string) {
    if (!confirm("Remove this listing?")) return;
    try {
      await adminSetListing(id, { is_active: false, flagged: true });
      qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Removed");
    } catch (e: any) { toast.error(e.message); }
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Scanning…</div>;
  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-surface p-8 text-center shadow-card text-sm text-muted-foreground">
        ✨ No suspicious listings right now.
      </div>
    );
  }

  const flagCopy: Record<string, string> = {
    price_too_low: "Price is far below market — common scam signal",
    price_too_high: "Price is far above market",
    high_views_no_messages: "500+ views but no messages — likely fake or broken",
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">{rows.length} listing{rows.length === 1 ? "" : "s"} flagged by automated scan.</div>
      {rows.map((l) => (
        <div key={l.id} className="rounded-xl bg-surface p-4 shadow-card flex items-start gap-3">
          {l.photos?.[0] && (
            <img src={l.photos[0]} alt="" className="h-16 w-16 rounded-lg object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-black uppercase">
                {flagCopy[l.flag_reason ?? ""] ?? l.flag_reason ?? "Flagged"}
              </span>
              <span className="text-[11px] text-muted-foreground">{timeAgo(l.created_at)}</span>
            </div>
            <div className="mt-1 font-bold truncate">{l.title}</div>
            <div className="text-xs text-muted-foreground">
              ${l.price}/mo · {l.beds}BR · {l.area}
              {l.median_price ? <> · median ${Math.round(l.median_price)}</> : null}
              {" · "}{l.view_count ?? 0} views
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" variant="outline" onClick={() => clearFlag(l.id)}><BadgeCheck className="h-3.5 w-3.5 mr-1" />Approve</Button>
            <Button size="sm" variant="destructive" onClick={() => remove(l.id)}><Trash2 className="h-3.5 w-3.5 mr-1" />Remove</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Queue 76 — Feedback tab: lister + renter feedback tables
function FeedbackTab() {
  const qc = useQueryClient();
  const { data: listerRows = [] } = useQuery({
    queryKey: ["admin", "lister-feedback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_feedback" as any)
        .select("id,listing_id,how_found_renter,additional_comments,is_testimonial,created_at,listings(title)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const { data: renterRows = [] } = useQuery({
    queryKey: ["admin", "renter-feedback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("renter_feedback" as any)
        .select("id,user_id,how_found,additional_comments,created_at,profiles(name,email)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  async function toggleTestimonial(id: string, next: boolean) {
    const { error } = await supabase
      .from("listing_feedback" as any)
      .update({ is_testimonial: next } as any)
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin", "lister-feedback"] });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-black">Lister feedback ({listerRows.length})</h2>
        {listerRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No lister feedback yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2">Listing</th>
                  <th className="p-2">How found</th>
                  <th className="p-2">Comments</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Testimonial</th>
                </tr>
              </thead>
              <tbody>
                {listerRows.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="p-2 font-semibold">{r.listings?.title ?? "—"}</td>
                    <td className="p-2 text-xs">{r.how_found_renter}</td>
                    <td className="p-2 max-w-md whitespace-pre-wrap">{r.additional_comments ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="p-2">
                      <label className="inline-flex cursor-pointer items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={!!r.is_testimonial}
                          onChange={(e) => toggleTestimonial(r.id, e.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                        Use as quote
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-black">Renter feedback ({renterRows.length})</h2>
        {renterRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No renter feedback yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2">User</th>
                  <th className="p-2">How found</th>
                  <th className="p-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {renterRows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-2 font-semibold">{r.profiles?.name ?? r.profiles?.email?.split("@")[0] ?? "—"}</td>
                    <td className="p-2 text-xs">{r.how_found}</td>
                    <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
