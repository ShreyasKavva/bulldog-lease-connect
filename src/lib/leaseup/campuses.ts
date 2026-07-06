import { supabase } from "@/integrations/supabase/client";

export type Campus = {
  id: string;
  name: string;
  short_name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  domain: string;
  slug: string;
};

export async function fetchCampuses(): Promise<Campus[]> {
  const { data, error } = await supabase
    .from("campuses")
    .select("id, name, short_name, city, state, lat, lng, domain, slug")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Campus[];
}

export async function fetchCampusBySlug(slug: string): Promise<Campus | null> {
  const { data, error } = await supabase
    .from("campuses")
    .select("id, name, short_name, city, state, lat, lng, domain, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Campus | null) ?? null;
}

/** Q67: look up a campus id from a signed-in user's email domain (e.g. "uga.edu"). */
export async function fetchCampusIdByEmailDomain(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return null;
  const { data, error } = await supabase
    .from("campus_email_domains")
    .select("campus_id")
    .eq("domain", domain)
    .maybeSingle();
  if (error) return null;
  return (data?.campus_id as string | undefined) ?? null;
}

/** Map of campus_id → active listing count. Used on campus pages to show
 *  "18 live" badges under the "Browse other campuses" cards. */
export async function fetchActiveListingCountsByCampus(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("listings")
    .select("campus_id")
    .eq("is_active", true);
  if (error) return {};
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = (row as { campus_id: string }).campus_id;
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/** Live counts for the campus hero: active listings, completed (rented),
 *  and active looking-for posts scoped to a single campus. */
export async function fetchCampusStats(campusId: string): Promise<{
  active: number;
  completed: number;
  looking: number;
}> {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const [active, completed, looking] = await Promise.all([
    supabase.from("listings").select("id", { count: "exact", head: true })
      .eq("campus_id", campusId).eq("is_active", true).eq("status", "active"),
    supabase.from("listings").select("id", { count: "exact", head: true })
      .eq("campus_id", campusId).eq("status", "filled"),
    supabase.from("looking_for_posts").select("id", { count: "exact", head: true })
      .eq("campus_id", campusId).eq("is_active", true).gte("created_at", sixtyDaysAgo),
  ]);
  return {
    active: active.count ?? 0,
    completed: completed.count ?? 0,
    looking: looking.count ?? 0,
  };
}
