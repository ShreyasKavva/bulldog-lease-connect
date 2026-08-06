/**
 * Q111 — listing review aggregates for cards.
 *
 * One cheap query fetches every visible review's (listing_id, stars) pair and
 * aggregates client-side, so any number of ListingCards can show "★ 4.8"
 * without an N+1 fan-out.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Rating = { avg: number; count: number };

async function fetchRatingMap(): Promise<Record<string, Rating>> {
  const { data, error } = await supabase
    .from("reviews")
    .select("listing_id, stars")
    .eq("is_removed", false)
    .not("listing_id", "is", null);
  if (error) return {};
  const sums: Record<string, { total: number; count: number }> = {};
  for (const r of (data ?? []) as Array<{ listing_id: string | null; stars: number }>) {
    if (!r.listing_id) continue;
    const b = (sums[r.listing_id] ??= { total: 0, count: 0 });
    b.total += r.stars;
    b.count += 1;
  }
  const out: Record<string, Rating> = {};
  for (const [id, b] of Object.entries(sums)) {
    out[id] = { avg: b.total / b.count, count: b.count };
  }
  return out;
}

export function useListingRatings() {
  return useQuery({
    queryKey: ["listing-ratings"],
    queryFn: fetchRatingMap,
    staleTime: 5 * 60 * 1000,
  });
}

/** Convenience: the rating for a single listing, or null when it has none. */
export function useListingRating(listingId: string): Rating | null {
  const { data } = useListingRatings();
  return data?.[listingId] ?? null;
}
