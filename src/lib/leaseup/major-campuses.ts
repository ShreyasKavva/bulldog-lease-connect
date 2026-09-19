/**
 * Q280/Q281 — browsable set of every US school in the database (~3,900).
 *
 * The /campuses directory once only rendered schools that already have live
 * subleases, so it looked like LeaseUp covered a dozen colleges. It now shows
 * the full campus table — all four-year universities plus community colleges —
 * each with its real listing count ("No listings yet" where that's true).
 *
 * Ordered by IPEDS unit id ascending (oldest-established institutions first)
 * so the well-known schools lead the list. PostgREST caps a single request at
 * 1,000 rows, so this pages through with .range() until exhausted.
 *
 * Listing counts are NOT implied here: a school in this set with no subleases
 * renders its normal "No listings yet" empty state.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Campus } from "./campuses";

const COLS = "id, name, short_name, city, state, lat, lng, domain, slug, level";
const PAGE_SIZE = 1000;
const MAX_ROWS = 4000; // safety cap; the table currently holds ~3,900

/** Fetch every school in the database. Returns [] on failure — the
 *  directory still renders the campuses that have listings. */
export async function fetchMajorCampuses(): Promise<Campus[]> {
  const all: Campus[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("campuses")
      .select(COLS)
      .order("ipeds_unitid", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return all.length > 0 ? all : [];
    const rows = (data ?? []) as Campus[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}
