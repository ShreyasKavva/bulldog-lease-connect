import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import {
  fetchReports, resolveReport, adminFetchAllListings, adminFetchAllProfiles,
  adminSetListing, adminDeleteListing, adminSetProfile, fetchPlatformStats,
} from "@/lib/leaseup/admin.queries";
import { fetchCampuses } from "@/lib/leaseup/campuses";
import { Nav } from "@/components/leaseup/Nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { timeAgo } from "@/lib/leaseup/constants";
import { ShieldCheck, AlertTriangle, Users, Home, Trash2, EyeOff, Eye, Ban, BadgeCheck, Flag } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — LeaseUp" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

type Tab = "overview" | "reports" | "listings" | "users";

function AdminPage() {
  const { user, loading } = useSession();
  const { data: me, isLoading: profileLoading } = useMyProfile();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "in" } });
  }, [loading, user, navigate]);

  if (loading || profileLoading) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!me?.is_admin) {
    return (
      <div className="min-h-screen bg-background">
        <Nav onPost={() => {}} onOpenMessages={() => {}} onOpenProfile={() => {}} search="" onSearch={() => {}} />
        <div className="mx-auto max-w-md mt-24 rounded-2xl bg-surface p-8 shadow-card-md text-center">
          <div className="text-4xl">🚫</div>
          <h1 className="mt-2 text-xl font-black">Admins only</h1>
          <p className="mt-1 text-sm text-muted-foreground">You don't have access to this page.</p>
          <Link to="/" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Back home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav onPost={() => navigate({ to: "/" })} onOpenMessages={() => navigate({ to: "/" })}
        onOpenProfile={() => navigate({ to: "/" })} search="" onSearch={() => {}} />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-black">Admin</h1>
        </div>
        <div className="flex gap-1 border-b mb-6 overflow-x-auto">
          {([
            ["overview", "Overview", Home],
            ["reports", "Reports", AlertTriangle],
            ["listings", "Listings", Home],
            ["users", "Users", Users],
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
        {tab === "listings" && <ListingsTab />}
        {tab === "users" && <UsersTab />}
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
  if (!stats) return <div className="text-sm text-muted-foreground">Loading…</div>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total users" value={stats.totalUsers} />
        <StatCard label="Active listings" value={stats.activeListings} />
        <StatCard label="Signups today" value={stats.signupsToday} />
        <StatCard label="Messages (7d)" value={stats.messagesThisWeek} />
      </div>
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
                <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-bold uppercase">{r.reason}</span>
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
                    <div className="grid h-7 w-7 place-items-center rounded-full text-sm" style={{ background: u.banner_color ?? "#2563EB" }}>
                      {u.avatar_emoji ?? "🙂"}
                    </div>
                    {u.name ?? "—"}
                  </div>
                </td>
                <td className="p-2 text-xs">{u.email}</td>
                <td className="p-2 text-xs">{listingCount.get(u.id) ?? 0}</td>
                <td className="p-2 text-xs text-muted-foreground">{timeAgo(u.created_at)}</td>
                <td className="p-2 text-xs">
                  {u.verified_email && <span className="rounded bg-success-light text-success px-1.5 py-0.5 text-[10px] font-bold mr-1">VERIFIED</span>}
                  {u.is_admin && <span className="rounded bg-primary-light text-primary-dark px-1.5 py-0.5 text-[10px] font-bold mr-1">ADMIN</span>}
                  {u.banned && <span className="rounded bg-red-100 text-red-700 px-1.5 py-0.5 text-[10px] font-bold">BANNED</span>}
                </td>
                <td className="p-2">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="outline" onClick={() => update(u.id, { verified_email: !u.verified_email }, u.verified_email ? "Unverified" : "Verified")} title="Toggle verified">
                      <BadgeCheck className={cn("h-3.5 w-3.5", u.verified_email && "text-success")} />
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
