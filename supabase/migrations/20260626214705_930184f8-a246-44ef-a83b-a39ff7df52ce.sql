
DROP VIEW IF EXISTS public.trending_listings;
CREATE VIEW public.trending_listings
WITH (security_invoker = true) AS
SELECT
  l.*,
  (
    COALESCE((SELECT COUNT(*) FROM public.saved_listings s
              WHERE s.listing_id = l.id AND s.created_at > now() - interval '7 days'), 0) * 3
    + COALESCE(l.view_count, 0) * 1
    + COALESCE((SELECT COUNT(*) FROM public.messages m
                JOIN public.conversations c ON c.id = m.conversation_id
                WHERE c.listing_id = l.id AND m.created_at > now() - interval '7 days'), 0) * 2
  ) AS trending_score
FROM public.listings l
WHERE l.is_active = true AND COALESCE(l.flagged, false) = false;

GRANT SELECT ON public.trending_listings TO authenticated, anon;
