/**
 * Admin/moderation reads and writes. UI lives in src/routes/admin.tsx.
 *
 * These run with the caller's RLS — the admin RLS policies on each table
 * (gated by profiles.is_admin) are what actually grant access. There's no
 * service-role escape hatch in this file; it's intentionally client-safe.
 *
 * Reports queue: fetchReports() enriches each report with its listing,
 * reporter profile, and report-volume count, then sorts by computed
 * priority (urgent/high/normal/low) so the queue is actionable at a glance.
 *
 * Suspicious listings + user risk scores are read from DB VIEWS
 * (`suspicious_listings`, `user_risk_scores`) defined in Queue 21
 * migrations. They return [] gracefully if the view doesn't exist yet
 * (error code 42P01 = undefined_table) so this file stays safe across
 * deploys before/after the migration.
 *
 * fetchPlatformStats() is one big parallel fan-out — keep additions inside
 * the Promise.all to avoid serial round-trips.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Listing, Profile } from "./types";

export type ListingReport = {
  id: string;
  listing_id: string;
  reporter_id: string;
  reason: string;
  details: string | null;
  status: "open" | "dismissed" | "actioned";
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  priority?: "urgent" | "high" | "normal" | "low";
  auto_score?: number;
  auto_flagged?: boolean;
  listing?: Listing | null;
  reporter?: Profile | null;
  reportCount?: number;
};

export async function fileReport(listingId: string, reporterId: string | null, reason: string, details?: string) {
  const { error } = await supabase.from("listing_reports").insert({
    listing_id: listingId, reporter_id: reporterId ?? null, reason, details: details ?? null,
  });
  if (error) throw error;
}

const PRIO_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export async function fetchReports(status: "open" | "all" = "open"): Promise<ListingReport[]> {
  let q = supabase.from("listing_reports").select("*").order("created_at", { ascending: false });
  if (status === "open") q = q.eq("status", "open");
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as ListingReport[];
  const listingIds = Array.from(new Set(rows.map(r => r.listing_id)));
  const reporterIds = Array.from(new Set(rows.map(r => r.reporter_id)));
  const [{ data: listings }, { data: profs }, { data: allReports }] = await Promise.all([
    listingIds.length ? supabase.from("listings").select("*").in("id", listingIds) : Promise.resolve({ data: [] as any }),
    reporterIds.length ? supabase.from("profiles").select("*").in("id", reporterIds) : Promise.resolve({ data: [] as any }),
    listingIds.length ? supabase.from("listing_reports").select("listing_id").in("listing_id", listingIds) : Promise.resolve({ data: [] as any }),
  ]);
  const lm = new Map<string, Listing>((listings ?? []).map((l: any) => [l.id, l]));
  const pm = new Map<string, Profile>((profs ?? []).map((p: any) => [p.id, p]));
  const rc = new Map<string, number>();
  (allReports ?? []).forEach((r: any) => rc.set(r.listing_id, (rc.get(r.listing_id) ?? 0) + 1));
  const enriched = rows.map(r => ({
    ...r,
    listing: lm.get(r.listing_id) ?? null,
    reporter: pm.get(r.reporter_id) ?? null,
    reportCount: rc.get(r.listing_id) ?? 1,
  }));
  enriched.sort((a, b) => {
    const ap = PRIO_RANK[a.priority ?? "normal"] ?? 2;
    const bp = PRIO_RANK[b.priority ?? "normal"] ?? 2;
    if (ap !== bp) return ap - bp;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return enriched;
}

// ---- Queue 21: Suspicious listings + user risk scores ----
export type SuspiciousListing = Listing & { flag_reason: string | null; median_price: number | null };
export async function fetchSuspiciousListings(): Promise<SuspiciousListing[]> {
  const { data, error } = await supabase.from("suspicious_listings" as any).select("*").limit(200);
  if (error) {
    if ((error as any).code === "42P01") return [];
    throw error;
  }
  return (data ?? []) as unknown as SuspiciousListing[];
}

export type UserRiskRow = {
  id: string;
  name: string | null;
  email: string | null;
  reports_received: number;
  reports_filed: number;
  risk_level: "banned" | "high_risk" | "low_trust" | "unverified" | "good_standing";
};
const RISK_RANK: Record<string, number> = { banned: 0, high_risk: 1, low_trust: 2, unverified: 3, good_standing: 4 };
export async function fetchUserRiskScores(): Promise<UserRiskRow[]> {
  const { data, error } = await supabase.from("user_risk_scores" as any).select("*").limit(500);
  if (error) {
    if ((error as any).code === "42P01") return [];
    throw error;
  }
  const rows = (data ?? []) as unknown as UserRiskRow[];
  rows.sort((a, b) => (RISK_RANK[a.risk_level] ?? 9) - (RISK_RANK[b.risk_level] ?? 9));
  return rows;
}


export async function resolveReport(id: string, status: "dismissed" | "actioned", adminId: string) {
  const { error } = await supabase.from("listing_reports").update({
    status, resolved_by: adminId, resolved_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

export async function adminFetchAllListings(): Promise<Listing[]> {
  const { data, error } = await supabase.from("listings").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Listing[];
}

export async function adminFetchAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function adminSetListing(id: string, patch: Partial<Pick<Listing, "is_active" | "flagged">>) {
  const { error } = await supabase.from("listings").update(patch).eq("id", id);
  if (error) throw error;
}

export async function adminDeleteListing(id: string) {
  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) throw error;
}

export async function adminSetProfile(id: string, patch: { banned?: boolean; verified_email?: boolean; is_admin?: boolean; is_ambassador?: boolean }) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

export type PlatformStats = {
  totalUsers: number;
  activeListings: number;
  signupsToday: number;
  messagesThisWeek: number;
  perCampus: { campus: string; count: number }[];
  toursRequestedWeek: number;
  toursConfirmedWeek: number;
  toursCompleted: number;
  noShowRate: number;
};

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [users, active, signups, msgs, campusBreak, campuses, tReq, tConf, tComp, tNo] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
    supabase.from("messages").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase.from("listings").select("campus_id").eq("is_active", true),
    supabase.from("campuses").select("id, short_name"),
    supabase.from("tour_bookings" as any).select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase.from("tour_bookings" as any).select("id", { count: "exact", head: true }).eq("status", "confirmed").gte("created_at", weekAgo),
    supabase.from("tour_bookings" as any).select("id", { count: "exact", head: true }).not("poster_survey", "is", null),
    supabase.from("tour_bookings" as any).select("id", { count: "exact", head: true }).eq("poster_survey", "no_show"),
  ]);

  const nameMap = new Map<string, string>((campuses.data ?? []).map((c: any) => [c.id, c.short_name]));
  const counts = new Map<string, number>();
  (campusBreak.data ?? []).forEach((r: any) => counts.set(r.campus_id, (counts.get(r.campus_id) ?? 0) + 1));
  const perCampus = Array.from(counts.entries())
    .map(([cid, count]) => ({ campus: nameMap.get(cid) ?? "Unknown", count }))
    .sort((a, b) => b.count - a.count);

  const completed = tComp.count ?? 0;
  const noShow = tNo.count ?? 0;
  const noShowRate = completed > 0 ? (noShow / (completed + noShow)) * 100 : 0;

  return {
    totalUsers: users.count ?? 0,
    activeListings: active.count ?? 0,
    signupsToday: signups.count ?? 0,
    messagesThisWeek: msgs.count ?? 0,
    perCampus,
    toursRequestedWeek: tReq.count ?? 0,
    toursConfirmedWeek: tConf.count ?? 0,
    toursCompleted: completed,
    noShowRate,
  };
}
