import { supabase } from "@/integrations/supabase/client";

export type DailyStat = { date: string; views: number; saves: number; messages: number };

export async function fetchListingDailyStats(listingId: string, days = 30): Promise<DailyStat[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("listing_stats_daily")
    .select("date, views, saves, messages")
    .eq("listing_id", listingId)
    .gte("date", since)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DailyStat[];
}

export async function fetchListingsDailyStats(listingIds: string[], days = 7): Promise<Record<string, DailyStat[]>> {
  if (listingIds.length === 0) return {};
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("listing_stats_daily")
    .select("listing_id, date, views, saves, messages")
    .in("listing_id", listingIds)
    .gte("date", since)
    .order("date", { ascending: true });
  if (error) throw error;
  const out: Record<string, DailyStat[]> = {};
  for (const id of listingIds) out[id] = [];
  for (const r of (data ?? []) as ({ listing_id: string } & DailyStat)[]) {
    out[r.listing_id]?.push({ date: r.date, views: r.views, saves: r.saves, messages: r.messages });
  }
  return out;
}

export async function fetchListingBenchmark(listingId: string) {
  const { data, error } = await supabase.rpc("get_listing_benchmark" as any, { _listing_id: listingId });
  if (error) throw error;
  return (data ?? {}) as {
    avg_views?: number;
    avg_price?: number;
    median_price?: number;
    min_price?: number;
    max_price?: number;
  };
}

export async function fetchListingMessageStats(listingId: string, posterId: string) {
  // Conversations on this listing
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, participant_1_id, participant_2_id")
    .eq("listing_id", listingId);
  const convIds = (convs ?? []).map((c) => c.id);
  if (convIds.length === 0) return { inbound: 0, replies: 0, uniqueSenders: 0 };
  const { data: msgs } = await supabase
    .from("messages")
    .select("sender_id, conversation_id")
    .in("conversation_id", convIds);
  const inboundSenders = new Set<string>();
  const inboundConvs = new Set<string>();
  const replyConvs = new Set<string>();
  for (const m of (msgs ?? []) as { sender_id: string; conversation_id: string }[]) {
    if (m.sender_id !== posterId) {
      inboundSenders.add(m.sender_id);
      inboundConvs.add(m.conversation_id);
    } else {
      replyConvs.add(m.conversation_id);
    }
  }
  const replies = [...inboundConvs].filter((c) => replyConvs.has(c)).length;
  return { inbound: inboundConvs.size, replies, uniqueSenders: inboundSenders.size };
}

export async function fetchRecentSavers(listingId: string, limit = 5) {
  const { data } = await supabase
    .from("saved_listings")
    .select("user_id, created_at, profiles:user_id(avatar_emoji)")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r: any) => ({
    emoji: r.profiles?.avatar_emoji ?? "🎓",
  }));
}

export async function fetchSavedSearchMatchCount(searchId: string): Promise<number> {
  const { data, error } = await supabase.rpc("count_saved_search_matches" as any, { _search_id: searchId });
  if (error) return 0;
  return typeof data === "number" ? data : 0;
}

export async function fetchGrowthMetrics(days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [profiles, listings, messages] = await Promise.all([
    supabase.from("profiles").select("created_at").gte("created_at", since),
    supabase.from("listings").select("created_at, status, is_active").gte("created_at", since),
    supabase.from("messages").select("created_at").gte("created_at", since),
  ]);
  function bucket(rows: { created_at: string }[] | null) {
    const out: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10);
      out[d] = 0;
    }
    for (const r of rows ?? []) {
      const d = r.created_at.slice(0, 10);
      if (d in out) out[d] += 1;
    }
    return Object.entries(out).map(([date, count]) => ({ date, count }));
  }
  return {
    signups: bucket(profiles.data),
    listings: bucket(listings.data),
    messages: bucket(messages.data),
    listingMix: {
      active: (listings.data ?? []).filter((l: any) => l.is_active && l.status === "active").length,
      filled: (listings.data ?? []).filter((l: any) => l.status === "filled").length,
      inactive: (listings.data ?? []).filter((l: any) => !l.is_active).length,
    },
  };
}
