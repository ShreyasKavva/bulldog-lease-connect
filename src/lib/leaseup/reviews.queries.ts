import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "./types";

export type Review = {
  id: string;
  reviewer_id: string;
  reviewed_user_id: string;
  listing_id: string | null;
  stars: number;
  content: string | null;
  reviewer_role: "subletter" | "poster" | null;
  is_removed: boolean;
  created_at: string;
  reviewer?: Profile | null;
  reviewed?: Profile | null;
  listing?: { id: string; title: string } | null;
};

export type ReviewStats = {
  avg: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

export async function fetchUserReviews(userId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("reviewed_user_id", userId)
    .eq("is_removed", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Review[];
  if (rows.length === 0) return rows;
  const reviewerIds = Array.from(new Set(rows.map((r) => r.reviewer_id)));
  const { data: profs } = await supabase.from("profiles").select("*").in("id", reviewerIds);
  const map = new Map<string, Profile>((profs ?? []).map((p: any) => [p.id, p]));
  return rows.map((r) => ({ ...r, reviewer: map.get(r.reviewer_id) ?? null }));
}

export function computeReviewStats(reviews: Review[]): ReviewStats {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  let sum = 0;
  for (const r of reviews) {
    distribution[r.stars as 1 | 2 | 3 | 4 | 5] += 1;
    sum += r.stars;
  }
  return {
    avg: reviews.length ? sum / reviews.length : 0,
    count: reviews.length,
    distribution,
  };
}

/** True when the current user is allowed to leave a review for `otherId`.
 * Rule: at least one conversation must exist between the two users. */
export async function canLeaveReview(meId: string, otherId: string): Promise<boolean> {
  if (meId === otherId) return false;
  const [a, b] = [meId, otherId].sort();
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("participant_1_id", a)
    .eq("participant_2_id", b)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

export async function getMyReviewFor(
  reviewerId: string,
  reviewedUserId: string,
  listingId: string | null,
): Promise<Review | null> {
  let q = supabase
    .from("reviews")
    .select("*")
    .eq("reviewer_id", reviewerId)
    .eq("reviewed_user_id", reviewedUserId);
  q = listingId ? q.eq("listing_id", listingId) : q.is("listing_id", null);
  const { data } = await q.maybeSingle();
  return (data as Review) ?? null;
}

export async function submitReview(input: {
  reviewerId: string;
  reviewedUserId: string;
  listingId: string | null;
  stars: number;
  content: string | null;
  reviewerRole: "subletter" | "poster";
}) {
  const body = input.content?.trim() ? input.content.trim() : null;
  // Q112 — one review per user per listing: update in place when it exists.
  const existing = await getMyReviewFor(input.reviewerId, input.reviewedUserId, input.listingId);
  if (existing) {
    const { error } = await supabase
      .from("reviews")
      .update({ stars: input.stars, content: body })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("reviews").insert({
    reviewer_id: input.reviewerId,
    reviewed_user_id: input.reviewedUserId,
    listing_id: input.listingId,
    stars: input.stars,
    content: body,
    reviewer_role: input.reviewerRole,
  });
  if (error) throw error;
}


export async function deleteMyReview(id: string) {
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) throw error;
}

/** Verified subleases for a poster: filled via LeaseUp + both parties left ≥4★ reviews. */
export async function fetchVerifiedSubleaseCount(posterId: string): Promise<number> {
  const { data: filled } = await supabase
    .from("listings")
    .select("id, filled_with_user_id")
    .eq("user_id", posterId)
    .eq("status", "filled")
    .eq("filled_via_lease_up", true);
  const rows = (filled ?? []) as Array<{ id: string; filled_with_user_id: string | null }>;
  if (rows.length === 0) return 0;

  const listingIds = rows.map((r) => r.id);
  const { data: reviews } = await supabase
    .from("reviews")
    .select("listing_id, reviewer_id, reviewed_user_id, stars")
    .in("listing_id", listingIds)
    .eq("is_removed", false)
    .gte("stars", 4);
  const byListing = new Map<string, Array<{ reviewer_id: string; reviewed_user_id: string }>>();
  for (const r of (reviews ?? []) as any[]) {
    if (!byListing.has(r.listing_id)) byListing.set(r.listing_id, []);
    byListing.get(r.listing_id)!.push(r);
  }
  let count = 0;
  for (const r of rows) {
    if (!r.filled_with_user_id) continue;
    const list = byListing.get(r.id) ?? [];
    const posterReviewed = list.some((x) => x.reviewer_id === posterId && x.reviewed_user_id === r.filled_with_user_id);
    const otherReviewed = list.some((x) => x.reviewer_id === r.filled_with_user_id && x.reviewed_user_id === posterId);
    if (posterReviewed && otherReviewed) count += 1;
  }
  return count;
}

/** Q99: reviews left about a specific listing (any direction), newest first. */
export async function fetchListingReviews(listingId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("listing_id", listingId)
    .eq("is_removed", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Review[];
  if (rows.length === 0) return rows;
  const ids = Array.from(new Set(rows.map((r) => r.reviewer_id)));
  const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
  const map = new Map<string, Profile>((profs ?? []).map((p: any) => [p.id, p]));
  return rows.map((r) => ({ ...r, reviewer: map.get(r.reviewer_id) ?? null }));
}
