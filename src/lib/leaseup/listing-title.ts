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
  // Q399 — the area field can carry a street address, which must never appear
  // in an indexable title (sitemap). The area param is kept in the signature so
  // both call sites compile unchanged, but it is no longer interpolated.
  void l.area;
  return `${l.title} near ${campusName} | LeaseUp`;
}
