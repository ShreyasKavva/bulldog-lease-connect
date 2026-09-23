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
  // Q472 — many students already name the campus in their title, which produced
  // "…Near Georgia Tech's Campus near Georgia Tech | LeaseUp" in the share card
  // and the browser tab. Only append the campus when it isn't already there.
  const haystack = l.title.toLowerCase();
  const already = [l.campus?.short_name, l.campus?.name]
    .filter((n): n is string => !!n && n.length > 2)
    .some((n) => haystack.includes(n.toLowerCase()));
  return already ? `${l.title} | LeaseUp` : `${l.title} near ${campusName} | LeaseUp`;
}
