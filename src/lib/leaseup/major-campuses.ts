/**
 * Q280 — browsable set of ~1,000 major US universities.
 *
 * The campuses table holds every accredited US institution (~2.6k four-year,
 * ~1.2k two-year rows), but the /campuses directory only rendered schools that
 * already have live subleases, so it looked like LeaseUp covered a dozen
 * colleges. This query is the browsable set of four-year schools shown
 * underneath the ones with inventory.
 *
 * With no enrollment column in the table, "major" is approximated by
 * institutional age: ordering by IPEDS unit id ascending surfaces the
 * oldest-established institutions first, which correlates strongly with the
 * well-known four-year schools. Capped at 1,000 (also the PostgREST row cap,
 * so a single request returns the full set).
 *
 * Listing counts are NOT implied here: a school in this set with no subleases
 * renders its normal "No listings yet" empty state.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Campus } from "./campuses";

const COLS = "id, name, short_name, city, state, lat, lng, domain, slug, level";

/** Fetch the browsable four-year schools. Returns [] on failure — the
 *  directory still renders the campuses that have listings. */
export async function fetchMajorCampuses(): Promise<Campus[]> {
  const { data, error } = await supabase
    .from("campuses")
    .select(COLS)
    .eq("level", 1)
    .order("ipeds_unitid", { ascending: true })
    .limit(1000);
  if (error) return [];
  return (data ?? []) as Campus[];
}
