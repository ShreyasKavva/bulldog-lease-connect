import { supabase } from "@/integrations/supabase/client";

export type PriceLabel = "great_deal" | "good_price" | "fair_price" | "above_market" | "no_data";

export type PriceStats = {
  has_data: boolean;
  listing_count?: number;
  min_price?: number;
  p25_price?: number;
  median_price?: number;
  avg_price?: number;
  p75_price?: number;
  max_price?: number;
};

export type CampusPriceStat = {
  campus_id: string;
  beds: number;
  listing_count: number;
  min_price: number;
  p25_price: number;
  median_price: number;
  avg_price: number;
  p75_price: number;
  max_price: number;
};

/** Pull the whole stats table (small — N campuses x ~5 bed counts). Cached via React Query. */
export async function fetchAllPriceStats(): Promise<CampusPriceStat[]> {
  const { data, error } = await supabase
    .from("campus_price_stats" as any)
    .select("*");
  if (error) throw error;
  return (data ?? []) as unknown as CampusPriceStat[];
}

export async function fetchCampusPriceStats(campusId: string, beds: number): Promise<PriceStats> {
  const { data, error } = await supabase.rpc("get_campus_price_stats" as any, {
    campus: campusId,
    bed_count: beds,
  });
  if (error) throw error;
  return (data as PriceStats) ?? { has_data: false };
}

export async function fetchNeighborhoodBreakdown(campusId: string) {
  const { data, error } = await supabase.rpc("get_neighborhood_price_breakdown" as any, {
    campus: campusId,
  });
  if (error) throw error;
  return (data ?? []) as Array<{ area: string; listing_count: number; avg_price: number; median_price: number }>;
}

export async function fetchStaleListings(uid: string) {
  const { data, error } = await supabase.rpc("get_stale_listings_for_user" as any, { _uid: uid });
  if (error) throw error;
  return (data ?? []) as Array<{
    listing_id: string;
    title: string;
    price: number;
    beds: number;
    campus_id: string;
    days_active: number;
    median_price: number;
  }>;
}

/** Pure client-side label compute — mirror of get_price_label() SQL. */
export function computePriceLabel(price: number, stats: CampusPriceStat | undefined): PriceLabel {
  if (!stats) return "no_data";
  if (price <= stats.p25_price * 0.92) return "great_deal";
  if (price <= stats.median_price) return "good_price";
  if (price <= stats.p75_price * 1.05) return "fair_price";
  return "above_market";
}

export function findStat(
  stats: CampusPriceStat[] | undefined,
  campusId: string | null | undefined,
  beds: number | null | undefined,
): CampusPriceStat | undefined {
  if (!stats || !campusId || beds == null) return undefined;
  return stats.find((s) => s.campus_id === campusId && s.beds === beds);
}

export const LABEL_META: Record<PriceLabel, { text: string; icon: string; tone: string }> = {
  great_deal:   { text: "Great Deal",   icon: "🔥", tone: "bg-orange-500 text-white" },
  good_price:   { text: "Good Price",   icon: "✅", tone: "bg-success text-white" },
  fair_price:   { text: "Fair Price",   icon: "≈",  tone: "bg-muted text-muted-foreground" },
  above_market: { text: "Above Market", icon: "⚠",  tone: "border border-destructive text-destructive bg-destructive/5" },
  no_data:      { text: "",             icon: "",   tone: "" },
};
