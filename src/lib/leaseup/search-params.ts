/**
 * Q96/Q114 — shared translation from the Where/When/Who search state into
 * /browse URL params. /browse accepts a campus id or slug for `campus`,
 * `from`/`to` dates and `people` (number of students).
 */
import type { SearchState } from "@/components/leaseup/SearchPill";

export function buildBrowseSearch(state: SearchState): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (state.campusId) params.campus = state.campusId;
  else if (state.where.trim()) params.q = state.where.trim();
  if (state.from) params.from = state.from.toISOString().slice(0, 10);
  if (state.to) params.to = state.to.toISOString().slice(0, 10);
  if (state.guests > 1) params.people = state.guests;
  return params;
}
