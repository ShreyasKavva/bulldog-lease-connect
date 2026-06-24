import { supabase } from "@/integrations/supabase/client";
import type { Listing, Profile, Conversation, Message } from "./types";

const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

async function attachSignedUrls(listings: Listing[]): Promise<Listing[]> {
  const allPaths = listings.flatMap((l) => l.photos ?? []);
  if (allPaths.length === 0) return listings.map((l) => ({ ...l, photo_urls: [] }));
  const { data } = await supabase.storage
    .from("listing-photos")
    .createSignedUrls(allPaths, SIGNED_URL_TTL);
  const map = new Map<string, string>();
  data?.forEach((d) => { if (d.path && d.signedUrl) map.set(d.path, d.signedUrl); });
  return listings.map((l) => ({
    ...l,
    photo_urls: (l.photos ?? []).map((p) => map.get(p) ?? "").filter(Boolean),
  }));
}

async function attachProfiles(listings: any[]): Promise<Listing[]> {
  const ids = Array.from(new Set(listings.map((l) => l.user_id)));
  if (ids.length === 0) return listings;
  const { data } = await supabase.from("profiles").select("*").in("id", ids);
  const map = new Map<string, Profile>((data ?? []).map((p: any) => [p.id, p]));
  return listings.map((l) => ({ ...l, profile: map.get(l.user_id) }));
}

export async function fetchListings(): Promise<Listing[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const withProfiles = await attachProfiles(data ?? []);
  return attachSignedUrls(withProfiles);
}

export async function fetchListing(id: string): Promise<Listing | null> {
  const { data, error } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [withProfile] = await attachProfiles([data]);
  const [withUrls] = await attachSignedUrls([withProfile]);
  return withUrls;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function uploadListingPhotos(userId: string, files: File[]): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("listing-photos").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

export async function fetchSavedIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("saved_listings").select("listing_id").eq("user_id", userId);
  return new Set((data ?? []).map((r: any) => r.listing_id));
}

export async function toggleSaved(userId: string, listingId: string, saved: boolean) {
  if (saved) {
    await supabase.from("saved_listings").delete().eq("user_id", userId).eq("listing_id", listingId);
  } else {
    await supabase.from("saved_listings").insert({ user_id: userId, listing_id: listingId });
  }
}

export async function getOrCreateConversation(
  meId: string,
  otherId: string,
  listingId: string | null,
): Promise<string> {
  const [a, b] = [meId, otherId].sort();
  const { data: rows } = await supabase
    .from("conversations")
    .select("id, listing_id")
    .eq("participant_1_id", a)
    .eq("participant_2_id", b);
  const match = rows?.find((r: any) => (r.listing_id ?? null) === (listingId ?? null));
  if (match) return match.id;
  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ participant_1_id: a, participant_2_id: b, listing_id: listingId })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  const convs = (data ?? []) as Conversation[];
  const otherIds = Array.from(new Set(convs.map((c) => (c.participant_1_id === userId ? c.participant_2_id : c.participant_1_id))));
  const listingIds = Array.from(new Set(convs.map((c) => c.listing_id).filter(Boolean) as string[]));
  const [{ data: profs }, { data: lists }] = await Promise.all([
    otherIds.length ? supabase.from("profiles").select("*").in("id", otherIds) : Promise.resolve({ data: [] as any }),
    listingIds.length ? supabase.from("listings").select("id,title").in("id", listingIds) : Promise.resolve({ data: [] as any }),
  ]);
  const pMap = new Map<string, Profile>((profs ?? []).map((p: any) => [p.id, p]));
  const lMap = new Map<string, any>((lists ?? []).map((l: any) => [l.id, l]));
  return convs.map((c) => ({
    ...c,
    other: pMap.get(c.participant_1_id === userId ? c.participant_2_id : c.participant_1_id),
    listing: c.listing_id ? lMap.get(c.listing_id) ?? null : null,
  }));
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendMessage(conversationId: string, senderId: string, recipientId: string, content: string) {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId, sender_id: senderId, recipient_id: recipientId, content,
  });
  if (error) throw error;
  await supabase.from("conversations").update({
    last_message: content, last_message_at: new Date().toISOString(),
  }).eq("id", conversationId);
}
