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
  /** 1 = four-year, 2 = two-year (IPEDS level). Only set on Q179 rows. */
  level?: number | null;
  /** Active listing count — present on rows returned by the campus RPCs. */
  listing_count?: number;
};

const CAMPUS_COLS = "id, name, short_name, city, state, lat, lng, domain, slug, level";

/**
 * Q178 — extra search aliases per campus slug. Official names are long, but
 * students type nicknames ("GT", "UVA", "Bama"). Every alias below resolves
 * to the same campus in autocomplete, the search pill and /campuses.
 */
export const CAMPUS_ALIASES: Record<string, string[]> = {
  "georgia-tech": ["gt", "georgia tech", "georgia institute", "georgia institute of technology", "ga tech", "yellow jackets"],
  "university-of-virginia": ["uva", "u va", "virginia", "wahoos", "cavaliers", "charlottesville"],
  "university-of-georgia": ["uga", "georgia bulldogs", "athens"],
  "texas-a-m-university": ["tamu", "a&m", "aggies"],
  "university-of-florida": ["uf", "gators"],
  "boston-university": ["bu", "terriers"],
  "university-of-southern-california": ["usc", "trojans"],
  "university-of-south-carolina": ["uofsc", "gamecocks"],
  "university-of-north-carolina": ["unc", "tar heels", "chapel hill"],
  "nc-state-university": ["ncsu", "nc state", "wolfpack"],
  "university-of-alabama": ["bama", "roll tide"],
  "louisiana-state-university": ["lsu"],
  "new-york-university": ["nyu"],
  "ohio-state-university": ["osu", "the ohio state university", "buckeyes"],
  "university-of-texas-at-austin": ["ut", "ut austin", "longhorns"],
  "university-of-central-florida": ["ucf", "knights"],
  "florida-state-university": ["fsu", "seminoles"],
  "university-of-mississippi": ["ole miss"],
  "virginia-tech": ["vt", "virginia tech", "hokies"],
  "university-of-illinois": ["uiuc"],
  "university-of-wisconsin": ["uw madison", "badgers"],
  "university-of-washington": ["uw", "huskies"],
};

/** True when a campus matches a free-text search query (name, short name,
 *  city, state or any alias above). */
export function campusMatchesQuery(
  c: Pick<Campus, "name" | "short_name" | "city" | "state" | "slug">,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [c.name, c.short_name, c.city, c.slug?.replace(/-/g, " "), ...(CAMPUS_ALIASES[c.slug] ?? [])]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  // Forward match ("virg" -> "University of Virginia") plus a reverse match so
  // longer official names still resolve from a short alias ("Georgia Institute
  // of Technology" -> alias "georgia institute"). Reverse needs 4+ chars to
  // avoid state/abbreviation false positives.
  return haystack.some(
    (h) => h.startsWith(q) || h.includes(` ${q}`) || (h.length >= 4 && q.includes(h)),
  );
}

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
  try {
    const { data, error } = await supabase
      .from("listings")
      .select("campus_id")
      .eq("is_active", true);
    if (error) return {};
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const id = (row as { campus_id: string | null }).campus_id;
      if (id) counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
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

/** Q99: resolve a campus from a URL slug, falling back to common aliases
 *  ("uga", "osu") derived from short_name / name. */
export async function fetchCampusBySlugOrAlias(slug: string): Promise<Campus | null> {
  const key = (slug ?? "").toLowerCase().trim();
  if (!key) return null;
  const exact = await fetchCampusBySlug(key);
  if (exact) return exact;
  const norm = (s: string | null | undefined) =>
    (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const all = await fetchCampuses();
  return (
    all.find((c) => norm(c.short_name) === norm(key)) ??
    all.find((c) => norm(c.name) === norm(key)) ??
    all.find((c) => norm(c.slug) === norm(key)) ??
    all.find((c) => (CAMPUS_ALIASES[c.slug] ?? []).some((a) => norm(a) === norm(key))) ??
    null
  );
}
