/**
 * Client-side Supabase reads/writes for the LeaseUp app.
 *
 * Conventions:
 * - All listing reads run through fetchListings/fetchListing/etc. which
 *   ALWAYS call attachProfiles() + attachSignedUrls() before returning. The
 *   `photos` column stores Storage paths, not URLs — we mint 7-day signed
 *   URLs (SIGNED_URL_TTL) on each read and expose them as `photo_urls`.
 * - Feed ordering is `is_featured DESC, created_at DESC` — paid boosts must
 *   stay pinned to the top. Preserve this if you add new sort orders.
 * - Conversations are deduped by (participant_1, participant_2, listing_id)
 *   via getOrCreateConversation. Messages cannot be inserted until the
 *   conversation row exists — RLS enforces this.
 * - Mutations here run under the user's RLS scope. Anything that needs
 *   service-role privileges belongs in a server fn, not this file.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Listing, Profile, Conversation, Message, LookingForPost, SavedSearch } from "./types";

const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

async function attachSignedUrls(listings: Listing[]): Promise<Listing[]> {
  const isUrl = (p: string) => /^https?:\/\//i.test(p);
  // Seeded/demo listings can hold absolute URLs; only storage paths need signing.
  const allPaths = listings.flatMap((l) => (l.photos ?? []).filter((p) => !isUrl(p)));
  if (allPaths.length === 0) {
    return listings.map((l) => ({ ...l, photo_urls: (l.photos ?? []).filter(isUrl) }));
  }
  const { data } = await supabase.storage
    .from("listing-photos")
    .createSignedUrls(allPaths, SIGNED_URL_TTL);
  const map = new Map<string, string>();
  data?.forEach((d) => { if (d.path && d.signedUrl) map.set(d.path, d.signedUrl); });
  return listings.map((l) => ({
    ...l,
    photo_urls: (l.photos ?? []).map((p) => (isUrl(p) ? p : map.get(p) ?? "")).filter(Boolean),
  }));
}

async function attachProfiles(listings: any[]): Promise<Listing[]> {
  const ids = Array.from(new Set(listings.map((l) => l.user_id)));
  if (ids.length === 0) return listings;
  // Only project safe, public poster columns — RLS additionally scopes rows
  // to profiles that own an active listing for anonymous viewers.
  const { data } = await supabase
    .from("profiles_public")
    .select("id,name,avatar_emoji,banner_color,verified_email")
    .in("id", ids);
  const map = new Map<string, Profile>((data ?? []).map((p: any) => [p.id, p]));
  return listings.map((l) => ({ ...l, profile: map.get(l.user_id) }));
}

export async function fetchListings(): Promise<Listing[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("is_active", true)
    .eq("status", "active")
    .or(`available_to.is.null,available_to.gte.${today}`)
    .order("is_featured", { ascending: false })
    .order("sort_at", { ascending: false });
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

export async function uploadListingPhotos(
  userId: string,
  files: File[],
  onProgress?: (done: number, total: number, filename: string) => void,
): Promise<string[]> {
  const paths: string[] = [];
  let i = 0;
  for (const file of files) {
    i += 1;
    onProgress?.(i, files.length, file.name);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("listing-photos").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      throw new Error(`Photo ${i} of ${files.length} (${file.name}) failed to upload: ${error.message}`);
    }
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
  // Filter out soft-deleted by this user
  const visible = convs.filter((c) =>
    c.participant_1_id === userId ? !c.deleted_by_p1 : !c.deleted_by_p2,
  );
  const otherIds = Array.from(new Set(visible.map((c) => (c.participant_1_id === userId ? c.participant_2_id : c.participant_1_id))));
  const listingIds = Array.from(new Set(visible.map((c) => c.listing_id).filter(Boolean) as string[]));
  const [{ data: profs }, { data: lists }] = await Promise.all([
    otherIds.length ? supabase.from("profiles_public").select("*").in("id", otherIds) : Promise.resolve({ data: [] as any }),
    listingIds.length
      ? supabase.from("listings").select("id,title,price,beds,area,available_from,available_to,is_active,status,photos,user_id").in("id", listingIds)
      : Promise.resolve({ data: [] as any }),
  ]);
  // Sign first photo of each listing (absolute URLs pass through untouched)
  const firstPaths = (lists ?? [])
    .map((l: any) => (l.photos && l.photos[0]) || null)
    .filter((p: string | null): p is string => !!p && !/^https?:\/\//.test(p));
  const signedMap = new Map<string, string>();
  if (firstPaths.length) {
    const { data: signed } = await supabase.storage.from("listing-photos").createSignedUrls(firstPaths, SIGNED_URL_TTL);
    signed?.forEach((s) => { if (s.path && s.signedUrl) signedMap.set(s.path, s.signedUrl); });
  }
  const pMap = new Map<string, Profile>((profs ?? []).map((p: any) => [p.id, p]));
  const lMap = new Map<string, any>((lists ?? []).map((l: any) => {
    const first = l.photos && l.photos[0];
    const photo_url = first ? (/^https?:\/\//.test(first) ? first : signedMap.get(first) ?? null) : null;
    return [l.id, { ...l, photo_url }];
  }));

  // Q108 — inbox previews need who sent the last message ("You: …") and the
  // per-conversation unread count. One extra read covers both.
  const convIds = visible.map((c) => c.id);
  const lastSender = new Map<string, string>();
  const unread = new Map<string, number>();
  if (convIds.length) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id,sender_id,recipient_id,read_at,created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false });
    (msgs ?? []).forEach((m: any) => {
      if (!lastSender.has(m.conversation_id)) lastSender.set(m.conversation_id, m.sender_id);
      if (m.recipient_id === userId && !m.read_at) {
        unread.set(m.conversation_id, (unread.get(m.conversation_id) ?? 0) + 1);
      }
    });
  }

  const enriched = visible.map((c) => ({
    ...c,
    other: pMap.get(c.participant_1_id === userId ? c.participant_2_id : c.participant_1_id),
    listing: c.listing_id ? lMap.get(c.listing_id) ?? null : null,
    last_message_sender_id: lastSender.get(c.id) ?? null,
    unread_count: unread.get(c.id) ?? 0,
  }));
  // Most recent activity first (falls back to created_at for empty threads).
  return enriched.sort(
    (a, b) =>
      new Date(b.last_message_at ?? b.created_at).getTime() -
      new Date(a.last_message_at ?? a.created_at).getTime(),
  );
}


export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const messages = (data ?? []) as Message[];
  if (messages.length === 0) return messages;
  const ids = messages.map((m) => m.id);
  const { data: reactions } = await supabase
    .from("message_reactions")
    .select("*")
    .in("message_id", ids);
  const rMap = new Map<string, any[]>();
  (reactions ?? []).forEach((r: any) => {
    const arr = rMap.get(r.message_id) ?? [];
    arr.push(r);
    rMap.set(r.message_id, arr);
  });
  return messages.map((m) => ({ ...m, reactions: rMap.get(m.id) ?? [] }));
}

// Conversation flags (per-side pin/mute/delete)
export async function setConversationFlag(
  conv: Conversation,
  userId: string,
  flag: "pinned" | "muted" | "deleted",
  value: boolean,
) {
  const side = conv.participant_1_id === userId ? "p1" : "p2";
  const col = `${flag}_by_${side}`;
  const { error } = await supabase.from("conversations").update({ [col]: value } as never).eq("id", conv.id);
  if (error) throw error;
}

// Message reactions
export async function toggleMessageReaction(messageId: string, userId: string, emoji: string) {
  const { data: existing } = await supabase
    .from("message_reactions")
    .select("id,reaction")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing && existing.reaction === emoji) {
    await supabase.from("message_reactions").delete().eq("id", existing.id);
    return null;
  }
  if (existing) {
    await supabase.from("message_reactions").update({ reaction: emoji }).eq("id", existing.id);
    return emoji;
  }
  await supabase.from("message_reactions").insert({ message_id: messageId, user_id: userId, reaction: emoji });
  return emoji;
}

// Attachment upload (photo or doc) — path scoped to conversation id so storage RLS can validate
export async function uploadChatAttachment(conversationId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("messages-attachments")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function signChatAttachment(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("messages-attachments").createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}

export async function sendAttachmentMessage(
  conversationId: string,
  senderId: string,
  recipientId: string,
  kind: "image" | "document",
  file: File,
) {
  const path = await uploadChatAttachment(conversationId, file);
  const label = kind === "image" ? "📷 Photo" : `📄 ${file.name}`;
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    recipient_id: recipientId,
    content: label,
    content_type: kind,
    attachment_url: path,
    attachment_name: file.name,
    attachment_size: file.size,
  });
  if (error) throw error;
  await supabase.from("conversations").update({
    last_message: label,
    last_message_at: new Date().toISOString(),
  }).eq("id", conversationId);
}

export async function sendMessage(conversationId: string, senderId: string, recipientId: string, content: string, listingId?: string | null) {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId, sender_id: senderId, recipient_id: recipientId, content,
  });
  if (error) throw error;
  await supabase.from("conversations").update({
    last_message: content, last_message_at: new Date().toISOString(),
  }).eq("id", conversationId);
  // Q77: notify UI so the push-permission prompt can appear after first send.
  if (typeof window !== "undefined") {
    try { window.dispatchEvent(new CustomEvent("lu:message-sent", { detail: { conversationId } })); } catch {}
  }

  // Q110 Part A — email the host ONLY on the first message of a conversation.
  // Every later message is silent, so an active back-and-forth never spams.
  if (recipientId === senderId) return;
  try {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId);
    if ((count ?? 0) > 1) return; // not the first message — stay quiet

    const { sendTransactionalEmail } = await import("@/lib/email/send");
    // Recipient email comes from a security-definer RPC that only returns it
    // to the other participant of that same conversation — profiles no longer
    // exposes contact details to other users.
    const [{ data: recipientEmail }, { data: sender }, listingRes] = await Promise.all([
      supabase.rpc("get_conversation_participant_email", {
        _conversation_id: conversationId,
        _user_id: recipientId,
      }),
      supabase.from("profiles_public").select("name").eq("id", senderId).maybeSingle(),
      listingId
        ? supabase.from("listings").select("title,price,area").eq("id", listingId).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);
    if (recipientEmail) {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://leasup.co";
      const listing = (listingRes as any)?.data ?? null;
      const replyUrl = `${origin}/messages/${conversationId}`;
      void sendTransactionalEmail({
        templateName: "new-message",
        recipientEmail: recipientEmail as string,

        // One email per (conversation, recipient) — first message only.
        idempotencyKey: `msg-first-${conversationId}-${recipientId}`,
        templateData: {
          senderName: sender?.name || "Someone",
          preview: content.slice(0, 150),
          listingTitle: listing?.title ?? null,
          listingPrice: listing?.price ?? null,
          listingArea: listing?.area ?? null,
          conversationUrl: replyUrl,
        },
      });
    }
  } catch (e) {
    console.warn("[email] sendMessage notify failed", e);
  }
}

// ---- Looking For board ----
export async function fetchLookingFor(campusId?: string | null): Promise<LookingForPost[]> {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  let q = supabase
    .from("looking_for_posts")
    .select("*")
    .eq("is_active", true)
    .gte("created_at", sixtyDaysAgo)
    .order("created_at", { ascending: false });
  if (campusId) q = q.eq("campus_id", campusId);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as LookingForPost[];
  if (rows.length === 0) return rows;
  const ids = Array.from(new Set(rows.map(r => r.user_id)));
  const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
  const map = new Map<string, Profile>((profs ?? []).map((p: any) => [p.id, p]));
  const { data: interests } = await supabase
    .from("looking_for_interests")
    .select("request_id")
    .in("request_id", rows.map(r => r.id));
  const counts = new Map<string, number>();
  for (const i of (interests ?? []) as any[]) counts.set(i.request_id, (counts.get(i.request_id) ?? 0) + 1);
  return rows.map(r => ({ ...r, profile: map.get(r.user_id), interest_count: counts.get(r.id) ?? 0 }));
}

/** Recent looking-for posts that plausibly match a listing (Queue 60 — Part C). */
export async function fetchLookingForMatchesForListing(
  listing: Listing,
  limit = 3
): Promise<LookingForPost[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let q = supabase
    .from("looking_for_posts")
    .select("*")
    .eq("is_active", true)
    .gte("created_at", thirtyDaysAgo)
    .neq("user_id", listing.user_id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (listing.campus_id) q = q.eq("campus_id", listing.campus_id);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as LookingForPost[];
  const price = Number(listing.price ?? 0);
  const availTo = listing.available_to ? new Date(listing.available_to).getTime() : null;
  const availFrom = listing.available_from ? new Date(listing.available_from).getTime() : null;
  const filtered = rows.filter(r => {
    if (r.budget_max != null && price > 0 && r.budget_max < price) return false;
    if (r.move_in_date && availTo != null && new Date(r.move_in_date).getTime() > availTo) return false;
    const postEnd = r.move_out_date ?? r.move_in_date;
    if (postEnd && availFrom != null && new Date(postEnd).getTime() < availFrom) return false;
    return true;
  }).slice(0, limit);
  if (filtered.length === 0) return filtered;
  const ids = Array.from(new Set(filtered.map(r => r.user_id)));
  const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
  const map = new Map<string, Profile>((profs ?? []).map((p: any) => [p.id, p]));
  return filtered.map(r => ({ ...r, profile: map.get(r.user_id) }));
}

export async function createLookingFor(userId: string, payload: Partial<LookingForPost>, campusId: string | null = null) {
  const { error } = await supabase.from("looking_for_posts").insert({
    user_id: userId,
    campus_id: campusId,
    title: payload.title!,
    description: payload.description!,
    budget_max: payload.budget_max ?? null,
    move_in_date: payload.move_in_date ?? null,
    move_out_date: payload.move_out_date ?? null,
    beds_min: payload.beds_min ?? null,
    area: payload.area ?? null,
    furnished: payload.furnished ?? null,
    pets_ok: payload.pets_ok ?? null,
    num_people: payload.num_people ?? 1,
  });
  if (error) throw error;
}

export async function updateLookingFor(id: string, payload: Partial<LookingForPost>) {
  const { error } = await supabase.from("looking_for_posts").update({
    title: payload.title,
    description: payload.description,
    budget_max: payload.budget_max ?? null,
    move_in_date: payload.move_in_date ?? null,
    move_out_date: payload.move_out_date ?? null,
    beds_min: payload.beds_min ?? null,
    area: payload.area ?? null,
    furnished: payload.furnished ?? null,
    pets_ok: payload.pets_ok ?? null,
    num_people: payload.num_people ?? 1,
  }).eq("id", id);
  if (error) throw error;
}

export async function deleteLookingFor(id: string) {
  // Soft delete
  const { error } = await supabase
    .from("looking_for_posts")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw error;
}

export async function renewLookingFor(id: string) {
  const { error } = await supabase
    .from("looking_for_posts")
    .update({ created_at: new Date().toISOString(), expiry_notified_at: null, is_active: true })
    .eq("id", id);
  if (error) throw error;
}

export async function markLookingForFound(
  post: LookingForPost,
  opts: { foundViaLeaseUp: boolean; userId: string }
) {
  const { error: e1 } = await supabase
    .from("looking_for_posts")
    .update({ is_active: false })
    .eq("id", post.id);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("closed_deals").insert({
    user_id: opts.userId,
    campus_id: post.campus_id,
    looking_for_post_id: post.id,
    found_via_lease_up: opts.foundViaLeaseUp,
  });
  if (e2) throw e2;
}

export async function fetchMyLookingForInterests(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("looking_for_interests")
    .select("request_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.request_id);
}

/** Count of listings marked "filled" (rented) in the last 30 days, optionally scoped by campus. */
export async function fetchRecentFilledCount(campusId?: string | null): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let q = supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("status", "filled")
    .gte("filled_at", since);
  if (campusId) q = q.eq("campus_id", campusId);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function toggleLookingForInterest(userId: string, requestId: string, interested: boolean) {
  if (interested) {
    const { error } = await supabase
      .from("looking_for_interests")
      .insert({ user_id: userId, request_id: requestId });
    if (error && !`${error.message}`.includes("duplicate")) throw error;
  } else {
    const { error } = await supabase
      .from("looking_for_interests")
      .delete()
      .eq("user_id", userId)
      .eq("request_id", requestId);
    if (error) throw error;
  }
}

export async function fetchMatchingListingsForPost(post: LookingForPost): Promise<Listing[]> {
  let q = supabase.from("listings").select("*").eq("is_active", true);
  if (post.campus_id) q = q.eq("campus_id", post.campus_id);
  if (post.budget_max) q = q.lte("price", post.budget_max);
  if (post.beds_min) q = q.gte("beds", post.beds_min);
  if (post.move_in_date) q = q.or(`available_to.is.null,available_to.gte.${post.move_in_date}`);
  if (post.move_out_date) q = q.or(`available_from.is.null,available_from.lte.${post.move_out_date}`);
  const { data, error } = await q.order("sort_at", { ascending: false }).limit(50);
  if (error) throw error;
  return await attachProfiles(data ?? []);
}



export async function fetchSavedListings(userId: string): Promise<Listing[]> {
  const { data: rows } = await supabase.from("saved_listings").select("listing_id").eq("user_id", userId);
  const ids = (rows ?? []).map((r: any) => r.listing_id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("listings").select("*")
    .in("id", ids).eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const withProfiles = await attachProfiles(data ?? []);
  return attachSignedUrls(withProfiles);
}

/** Hydrate a set of listing ids (used by saved collections). */
export async function fetchListingsByIds(ids: string[]): Promise<Listing[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("listings").select("*")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const withProfiles = await attachProfiles(data ?? []);
  return attachSignedUrls(withProfiles);
}

/**
 * Curated homepage section reads (Q93). Each section is its own narrow query
 * so the homepage doesn't depend on one giant client-side filter pass.
 */
export async function fetchCuratedListings(opts: {
  maxPrice?: number;
  availableBefore?: string; // ISO date — available_from <= this date
  campusId?: string;
  orderBy?: "created_at" | "available_from" | "view_count";
  ascending?: boolean;
  limit?: number;
  /** ISO timestamp — only listings created on/after this moment. */
  createdAfter?: string;
  /** Drop rows with no views (used by the trending row on a fresh DB). */
  minViews?: number;
}): Promise<Listing[]> {
  let q = supabase
    .from("listings").select("*")
    .eq("is_active", true)
    .eq("status", "active");
  if (opts.maxPrice != null) q = q.lte("price", opts.maxPrice);
  if (opts.availableBefore) q = q.lte("available_from", opts.availableBefore);
  if (opts.campusId) q = q.eq("campus_id", opts.campusId);
  if (opts.createdAfter) q = q.gte("created_at", opts.createdAfter);
  if (opts.minViews != null) q = q.gte("view_count", opts.minViews);
  const { data, error } = await q
    .order(opts.orderBy ?? "created_at", { ascending: opts.ascending ?? false, nullsFirst: false })
    .limit(opts.limit ?? 12);
  if (error) throw error;
  const withProfiles = await attachProfiles(data ?? []);
  return attachSignedUrls(withProfiles);
}



export async function fetchMyListings(userId: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from("listings").select("*").eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const withProfiles = await attachProfiles(data ?? []);
  return attachSignedUrls(withProfiles);
}

export async function deleteListing(id: string) {
  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) throw error;
}

export async function setListingActive(id: string, active: boolean) {
  const { error } = await supabase.from("listings").update({ is_active: active }).eq("id", id);
  if (error) throw error;
}

export async function markListingFilled(id: string, filledWithUserId?: string | null) {
  const payload: any = {
    status: "filled",
    is_active: false,
    filled_at: new Date().toISOString(),
  };
  if (filledWithUserId) payload.filled_with_user_id = filledWithUserId;
  const { error } = await supabase.from("listings").update(payload).eq("id", id);
  if (error) throw error;
}

export async function reopenListing(id: string) {
  const { error } = await supabase
    .from("listings")
    .update({ status: "active", is_active: true, filled_at: null })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Duplicate an expired/filled listing into a fresh active one. Copies the
 * user-visible fields but resets lifecycle (status/is_active/filled_at) and
 * shifts the availability window forward one year so the poster only needs
 * to nudge the dates before reposting.
 */
export async function relistListing(sourceId: string, userId: string): Promise<string> {
  const { data: src, error: e1 } = await supabase
    .from("listings")
    .select("*")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (e1) throw e1;
  if (!src) throw new Error("Listing not found");
  const s = src as any;
  const shift = (d: string | null) => {
    if (!d) return null;
    const dt = new Date(d);
    dt.setFullYear(dt.getFullYear() + 1);
    return dt.toISOString().slice(0, 10);
  };
  const payload: any = {
    user_id: userId,
    campus_id: s.campus_id,
    title: s.title,
    description: s.description,
    type: s.type,
    price: s.price,
    beds: s.beds,
    baths: s.baths,
    area: s.area,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    photos: s.photos ?? [],
    furnished: s.furnished,
    utilities_included: s.utilities_included,
    pet_friendly: s.pet_friendly,
    parking: s.parking,
    semester: s.semester,
    amenities: s.amenities ?? [],
    available_from: shift(s.available_from),
    available_to: shift(s.available_to),
    status: "active",
    is_active: true,
  };

  const { data: created, error: e2 } = await supabase
    .from("listings")
    .insert(payload)
    .select("id")
    .single();
  if (e2) throw e2;
  return (created as any).id as string;
}

/** Bump listing to the top of the feed (once per 7 days, owner-only, enforced server-side). */
export async function bumpListing(listingId: string): Promise<string> {
  const { data, error } = await supabase.rpc("bump_listing", { _listing_id: listingId });
  if (error) throw error;
  return data as unknown as string;
}



/**
 * Q105 — live active-listing count per campus, straight from the DB so the
 * homepage "Explore campuses" grid never shows a stale/partial number.
 */
export async function fetchCampusListingCounts(): Promise<Map<string, number>> {
  // Must match the campus pill counts (fetchActiveListingCountsByCampus):
  // simply every active listing for the campus.
  const { data, error } = await supabase
    .from("listings")
    .select("campus_id")
    .eq("is_active", true);
  if (error) return new Map();
  const m = new Map<string, number>();
  for (const r of (data ?? []) as { campus_id: string }[]) {
    m.set(r.campus_id, (m.get(r.campus_id) ?? 0) + 1);
  }
  return m;
}
