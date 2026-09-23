DROP VIEW public.trending_listings;
CREATE VIEW public.trending_listings WITH (security_invoker = true) AS
  SELECT l.id, l.campus_id,
         (COALESCE(l.view_count, 0) + public.listing_engagement_score(l.id))::bigint AS trending_score
  FROM public.listings l
  WHERE l.is_active = true AND COALESCE(l.flagged, false) = false;
GRANT SELECT ON public.trending_listings TO anon, authenticated;
GRANT ALL ON public.trending_listings TO service_role;

REVOKE ALL ON public.suspicious_listings FROM anon;
REVOKE ALL ON public.suspicious_listings_filtered FROM anon;
REVOKE ALL ON public.user_risk_scores FROM anon;