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
