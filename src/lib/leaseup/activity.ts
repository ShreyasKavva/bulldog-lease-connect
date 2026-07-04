import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActivityKind =
  | "new_listing"
  | "listing_saved"
  | "price_drop"
  | "listing_closed"
  | "looking_for"
  | "reaction"
  | "deal_closed";


export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  emoji: string;
  text: string;
  area: string | null;
  created_at: string;
  listing_id?: string | null;
};

function area(s: string | null | undefined) {
  return s && s.trim().length > 0 ? s : "near campus";
}

export async function fetchActivity(limit = 50): Promise<ActivityItem[]> {
  const items: ActivityItem[] = [];

  // New listings (and price drops/closures from updated_at if different)
  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, beds, price, area, is_active, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  for (const l of (listings ?? []) as any[]) {
    items.push({
      id: `nl-${l.id}`,
      kind: "new_listing",
      emoji: "🏠",
      text: `New ${l.beds}BR listing posted in ${area(l.area)}`,
      area: l.area,
      created_at: l.created_at,
      listing_id: l.id,
    });
    if (l.is_active === false && l.updated_at && l.updated_at !== l.created_at) {
      items.push({
        id: `cl-${l.id}`,
        kind: "listing_closed",
        emoji: "🎉",
        text: `A sublease in ${area(l.area)} was filled`,
        area: l.area,
        created_at: l.updated_at,
        listing_id: l.id,
      });
    }
  }

  // Saves
  const { data: saves } = await supabase
    .from("saved_listing_events" as any)
    .select("listing_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  const saveRows = (saves ?? []) as Array<{ listing_id: string; created_at: string }>;
  const saveListingIds = Array.from(new Set(saveRows.map((r) => r.listing_id)));
  let saveAreas = new Map<string, string | null>();
  if (saveListingIds.length) {
    const { data: la } = await supabase
      .from("listings")
      .select("id, area")
      .in("id", saveListingIds);
    for (const r of (la ?? []) as any[]) saveAreas.set(r.id, r.area ?? null);
  }
  for (const s of saveRows) {
    const a = saveAreas.get(s.listing_id) ?? null;
    items.push({
      id: `sv-${s.listing_id}-${s.created_at}`,
      kind: "listing_saved",
      emoji: "❤️",
      text: `A student saved a listing in ${area(a)}`,
      area: a,
      created_at: s.created_at,
      listing_id: s.listing_id,
    });
  }

  // Looking-for posts
  const { data: lf } = await supabase
    .from("looking_for_posts")
    .select("id, beds_min, area, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  for (const p of (lf ?? []) as any[]) {
    items.push({
      id: `lf-${p.id}`,
      kind: "looking_for",
      emoji: "🔍",
      text: `A student is looking for a ${p.beds_min ?? ""}BR near ${area(p.area)}`.replace("  ", " "),
      area: p.area,
      created_at: p.created_at,
    });
  }

  // Reactions — group recent reactions by listing in last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: rx } = await supabase
    .from("listing_reaction_events" as any)
    .select("listing_id, reaction_type, created_at, listing:listings(area)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);
  if (rx && Array.isArray(rx)) {
    const groups = new Map<string, { count: number; latest: string; area: string | null; listingId: string }>();
    for (const r of rx as any[]) {
      const key = r.listing_id as string;
      const g = groups.get(key);
      if (g) { g.count += 1; if (r.created_at > g.latest) g.latest = r.created_at; }
      else groups.set(key, { count: 1, latest: r.created_at, area: r.listing?.area ?? null, listingId: key });
    }
    for (const [, g] of groups) {
      if (g.count < 1) continue;
      items.push({
        id: `rx-${g.listingId}-${g.latest}`,
        kind: "reaction",
        emoji: "🔥",
        text: `${g.count} student${g.count === 1 ? "" : "s"} reacted to a listing in ${area(g.area)}`,
        area: g.area,
        created_at: g.latest,
        listing_id: g.listingId,
      });
    }
  }

  // Closed deals (found via LeaseUp)
  const { data: deals } = await supabase
    .from("closed_deals")
    .select("id, found_via_lease_up, closed_at, campus:campuses(name)")
    .eq("found_via_lease_up", true)
    .order("closed_at", { ascending: false })
    .limit(limit);
  for (const d of (deals ?? []) as any[]) {
    items.push({
      id: `cd-${d.id}`,
      kind: "deal_closed",
      emoji: "🎉",
      text: `A student found a sublease${d.campus?.name ? ` at ${d.campus.name}` : ""} through LeaseUp`,
      area: null,
      created_at: d.closed_at,
    });
  }

  // Note: Detecting price drops without a history table isn't reliable.
  // We surface them via realtime UPDATE events on listings as they happen.

  items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return items.slice(0, limit);
}


export function useActivity() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["activity"],
    queryFn: () => fetchActivity(50),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const channel = supabase
      .channel("activity-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "listings" }, () => {
        qc.invalidateQueries({ queryKey: ["activity"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "listings" }, (payload) => {
        const oldRow = payload.old as any;
        const newRow = payload.new as any;
        if (!oldRow || !newRow) { qc.invalidateQueries({ queryKey: ["activity"] }); return; }
        if (newRow.price < oldRow.price) {
          qc.setQueryData<ActivityItem[]>(["activity"], (prev) => {
            const item: ActivityItem = {
              id: `pd-${newRow.id}-${Date.now()}`,
              kind: "price_drop",
              emoji: "📉",
              text: `A listing in ${area(newRow.area)} just dropped to $${Number(newRow.price).toLocaleString()}/mo`,
              area: newRow.area,
              created_at: new Date().toISOString(),
              listing_id: newRow.id,
            };
            return [item, ...(prev ?? [])].slice(0, 200);
          });
        }
        if (oldRow.is_active && !newRow.is_active) {
          qc.invalidateQueries({ queryKey: ["activity"] });
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "saved_listings" }, () => {
        qc.invalidateQueries({ queryKey: ["activity"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "listing_reactions" }, () => {
        qc.invalidateQueries({ queryKey: ["activity"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "looking_for_posts" }, () => {
        qc.invalidateQueries({ queryKey: ["activity"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "closed_deals" }, () => {
        qc.invalidateQueries({ queryKey: ["activity"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return query;
}


export function activityTimeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
