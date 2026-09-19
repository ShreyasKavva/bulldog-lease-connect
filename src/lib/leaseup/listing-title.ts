/**
 * Q278 — single source of truth for the /listing/$id document title, shared by
 * the route's head() and the /browse slide-out (ListingDetailSheet) so a link
 * copied from the slide-out carries the canonical page title.
 */
export function listingPageTitle(l: {
  title: string;
  area?: string | null;
  campus?: { name: string; short_name: string } | null;
}): string {
  const campusName = l.campus?.short_name ?? l.campus?.name ?? "campus";
  return `${l.title}${l.area ? ` — ${l.area}` : ""} near ${campusName} | LeaseUp`;
}
