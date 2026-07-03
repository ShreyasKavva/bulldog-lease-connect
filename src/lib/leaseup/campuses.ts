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
