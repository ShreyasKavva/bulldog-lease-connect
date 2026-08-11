/**
 * Saved collections (wishlists) — Q91.
 *
 * saved_listings rows carry a `collection_name` (default "Saved"), so a
 * listing can live in several named collections at once. Everything here is
 * client-side Supabase; RLS scopes rows to the signed-in user.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchListingsByIds } from "@/lib/leaseup/queries";
import type { Listing } from "@/lib/leaseup/types";

export const DEFAULT_COLLECTION = "Saved";

export type SavedRow = { listing_id: string; collection_name: string; created_at?: string | null };

export type Collection = {
  name: string;
  listings: Listing[];
  /** Q161 — listing_id -> ISO timestamp the listing was saved. */
  savedAt: Record<string, string>;
};

export async function fetchSavedRows(userId: string): Promise<SavedRow[]> {
  const { data, error } = await supabase
    .from("saved_listings")
    .select("listing_id, collection_name, created_at")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as SavedRow[];
}

/** All collections with their listings hydrated. "Saved" is always first. */
export async function fetchCollections(userId: string): Promise<Collection[]> {
  const rows = await fetchSavedRows(userId);
  const ids = Array.from(new Set(rows.map((r) => r.listing_id)));
  const listings = ids.length ? await fetchListingsByIds(ids) : [];
  const byId = new Map(listings.map((l) => [l.id, l]));

  const grouped = new Map<string, Listing[]>();
  const savedAt = new Map<string, Record<string, string>>();
  grouped.set(DEFAULT_COLLECTION, []);
  savedAt.set(DEFAULT_COLLECTION, {});
  for (const r of rows) {
    const stamps = savedAt.get(r.collection_name) ?? {};
    if (r.created_at) stamps[r.listing_id] = r.created_at;
    savedAt.set(r.collection_name, stamps);
    const arr = grouped.get(r.collection_name) ?? [];
    const l = byId.get(r.listing_id);
    if (l) arr.push(l);
    grouped.set(r.collection_name, arr);
  }
  const names = Array.from(grouped.keys()).sort((a, b) =>
    a === DEFAULT_COLLECTION ? -1 : b === DEFAULT_COLLECTION ? 1 : a.localeCompare(b),
  );
  return names.map((name) => ({ name, listings: grouped.get(name) ?? [], savedAt: savedAt.get(name) ?? {} }));
}

export async function saveToCollection(userId: string, listingId: string, collection: string) {
  const { error } = await supabase
    .from("saved_listings")
    .insert({ user_id: userId, listing_id: listingId, collection_name: collection });
  // 23505 = already in that collection; treat as success.
  if (error && (error as { code?: string }).code !== "23505") throw error;
}

export async function removeFromCollection(userId: string, listingId: string, collection: string) {
  const { error } = await supabase
    .from("saved_listings")
    .delete()
    .eq("user_id", userId)
    .eq("listing_id", listingId)
    .eq("collection_name", collection);
  if (error) throw error;
}

export async function renameCollection(userId: string, from: string, to: string) {
  const { error } = await supabase
    .from("saved_listings")
    .update({ collection_name: to })
    .eq("user_id", userId)
    .eq("collection_name", from);
  if (error) throw error;
}

export async function deleteCollection(userId: string, name: string) {
  const { error } = await supabase
    .from("saved_listings")
    .delete()
    .eq("user_id", userId)
    .eq("collection_name", name);
  if (error) throw error;
}
