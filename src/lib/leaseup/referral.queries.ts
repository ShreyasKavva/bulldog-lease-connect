import { supabase } from "@/integrations/supabase/client";

export type CampusOverview = {
  activeListings: number;
  newThisWeek: number;
  studentCount: number;
  myReferrals: number;
};

export type LeaderboardEntry = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  banner_color: string | null;
  referral_count: number;
  is_me: boolean;
};

export type TrendingListingRow = {
  id: string;
  trending_score: number;
};

export async function fetchTrendingIds(campusId: string | null, limit = 5): Promise<string[]> {
  let q = supabase.from("trending_listings").select("id, trending_score").order("trending_score", { ascending: false }).limit(limit);
  if (campusId) q = q.eq("campus_id", campusId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: any) => r.id);
}

export async function fetchCampusOverview(userId: string, campusId: string): Promise<CampusOverview> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const [active, week, students, refs] = await Promise.all([
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("campus_id", campusId).eq("is_active", true),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("campus_id", campusId).eq("is_active", true).gte("created_at", weekAgo),
    supabase.from("profiles_public").select("id", { count: "exact", head: true }).eq("campus_id", campusId),
    supabase.from("referral_events").select("id", { count: "exact", head: true }).eq("referrer_id", userId),
  ]);
  return {
    activeListings: active.count ?? 0,
    newThisWeek: week.count ?? 0,
    studentCount: students.count ?? 0,
    myReferrals: refs.count ?? 0,
  };
}

export async function fetchCampusLeaderboard(campusId: string, meId: string): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("profiles_public")
    .select("id, name, avatar_url, banner_color, referral_count")
    .eq("campus_id", campusId)
    .gt("referral_count", 0)
    .order("referral_count", { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    user_id: p.id,
    name: p.name,
    avatar_url: p.avatar_url,
    banner_color: p.banner_color,
    referral_count: p.referral_count ?? 0,
    is_me: p.id === meId,
  }));
}
