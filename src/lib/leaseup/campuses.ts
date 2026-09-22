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

/**
 * Q179 — the campuses table now holds every accredited US institution
 * (~3.8k rows), so we never ship the whole list to the browser.
 *
 * `fetchCampuses()` returns only campuses that actually have live subleases.
 * That's what discovery surfaces (homepage pills, footer, filters, the
 * /campuses grid) should show — an empty school would just be a dead end.
 * Anything that lets a student *choose* a campus (posting, onboarding,
 * search) uses `searchCampuses()` instead, which searches all of them
 * server-side.
 */
export async function fetchCampuses(): Promise<Campus[]> {
  const { data, error } = await supabase.rpc("campuses_with_listings");
  if (error) throw error;
  return (data ?? []) as Campus[];
}

/** Server-side ranked typeahead across every campus. Schools with live
 *  listings rank first, then prefix matches, then everything else. */
export async function searchCampuses(query: string, limit = 8): Promise<Campus[]> {
  const q = (query ?? "").trim();
  if (!q) {
    const withListings = await fetchCampuses();
    const sorted = withListings
      .slice()
      .sort((a, b) => (b.listing_count ?? 0) - (a.listing_count ?? 0));
    if (sorted.length >= limit) return sorted.slice(0, limit);
    // Pad with large well-known schools so the empty-state dropdown always
    // offers a useful scrollable list, even when few campuses have listings.
    const { data, error } = await supabase
      .from("campuses")
      .select("id, name, short_name, city, state, lat, lng, domain, slug, level")
      .order("ipeds_unitid", { ascending: true })
      .limit(limit * 2);
    if (error) throw error;
    const seen = new Set(sorted.map((c) => c.id));
    const padded = sorted.concat(((data ?? []) as Campus[]).filter((c) => !seen.has(c.id)));
    return padded.slice(0, limit);
  }
  const { data, error } = await supabase.rpc("search_campuses", { _q: q, _limit: limit });
  if (error) throw error;
  return (data ?? []) as Campus[];
}

/** Homepage "Explore campuses" grid: campuses with live listings first
 *  (sorted by count), padded with large well-known schools so the grid
 *  stays full even when few campuses have inventory yet. */
export async function fetchSpotlightCampuses(limit = 16): Promise<Campus[]> {
  const withListings = await fetchCampuses();
  const sorted = withListings
    .slice()
    .sort((a, b) => (b.listing_count ?? 0) - (a.listing_count ?? 0));
  // Q380 — padding rows must be recognisable schools, not the first rows of
  // the table (which happens to be alphabetical-by-state, i.e. all Alabama).
  // Explicit allow-list of well-known campus slugs, in display order; skip any
  // already shown from step 1 and any with no row in the table. If the
  // allow-list runs out before `limit`, stop short rather than falling back
  // to table order.
  const WELL_KNOWN_SLUGS = [
    "uga", "georgia-state", "florida", "florida-state", "auburn", "alabama",
    "tennessee", "south-carolina", "clemson", "ucf", "usf", "michigan",
    "ohio-state", "texas", "texas-am", "ucla", "berkeley", "nyu",
    "penn-state", "wisconsin",
  ];
  const seen = new Set(sorted.map((c) => c.slug));
  const needed = WELL_KNOWN_SLUGS.filter((s) => !seen.has(s)).slice(0, limit - sorted.length);
  if (needed.length === 0) return sorted;
  const { data, error } = await supabase
    .from("campuses")
    .select("id, name, short_name, city, state, lat, lng, domain, slug, level")
    .in("slug", needed);
  if (error) return sorted;
  const bySlug = new Map(((data ?? []) as Campus[]).map((c) => [c.slug, c]));
  const padded = [...sorted];
  for (const slug of needed) {
    const c = bySlug.get(slug);
    if (c) padded.push(c);
  }
  return padded.slice(0, limit);
}

/** Campuses near a given campus that DO have listings — used for the
 *  "Nearby campuses" rail on an empty campus page. */
export async function fetchNearbyCampuses(campusId: string, limit = 4): Promise<(Campus & { distance_miles: number })[]> {
  const { data, error } = await supabase.rpc("nearby_campuses_with_listings", {
    _campus_id: campusId,
    _limit: limit,
  });
  if (error) return [];
  return (data ?? []) as (Campus & { distance_miles: number })[];
}

/** Email capture for a campus with no inventory yet.
 *  Signed-out visitors insert an unowned row (user_id NULL); a signed-in user
 *  may only claim the row when the address matches their account email —
 *  that's what the row-level policy allows. */
export async function requestCampusNotify(
  campusId: string,
  email: string,
  userId?: string | null,
  accountEmail?: string | null,
) {
  const addr = email.trim().toLowerCase();
  const ownsAddress = !!userId && (accountEmail ?? "").trim().toLowerCase() === addr;
  const { error } = await supabase
    .from("campus_notify_signups")
    .insert({ campus_id: campusId, email: addr, user_id: ownsAddress ? userId : null });
  // Duplicate signup is a success from the student's point of view.
  if (error && error.code !== "23505") throw error;
}

export async function fetchCampusBySlug(slug: string): Promise<Campus | null> {
  const { data, error } = await supabase
    .from("campuses")
    .select(CAMPUS_COLS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Campus | null) ?? null;
}

/** Resolve specific campuses by id — needed when a user's own campus has no
 *  listings and therefore isn't in `fetchCampuses()`. */
export async function fetchCampusesByIds(ids: string[]): Promise<Campus[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const { data, error } = await supabase.from("campuses").select(CAMPUS_COLS).in("id", unique);
  if (error) return [];
  return (data ?? []) as Campus[];
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
      // status is the single source of truth for "this listing is live".
      .select("campus_id")
      .eq("status", "active");
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
  // Q179 — the full list is far too large to scan client-side, so fall back to
  // the server-side ranked search with the slug read as plain text.
  const candidates = await searchCampuses(key.replace(/-/g, " "), 10);
  return (
    candidates.find((c) => norm(c.slug) === norm(key)) ??
    candidates.find((c) => norm(c.short_name) === norm(key)) ??
    candidates.find((c) => norm(c.name) === norm(key)) ??
    candidates.find((c) => (CAMPUS_ALIASES[c.slug] ?? []).some((a) => norm(a) === norm(key))) ??
    candidates[0] ??
    null
  );
}
