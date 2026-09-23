-- Q460: trending_listings is security_invoker, so it ran with the caller's
-- column privileges. It still selected area/address/lat/lng, which Q459
-- revoked from anon -> 42501 for every anonymous read. Rebuild it with an
-- explicit public column list (PUBLIC_LISTING_COLUMNS shape, minus the four
-- location columns) so it is tightening-safe.
DROP VIEW IF EXISTS public.trending_listings;

CREATE VIEW public.trending_listings
WITH (security_invoker = true) AS
SELECT
  l.id,
  l.user_id,
  l.campus_id,
  l.title,
  l.description,
  l.type,
  l.price,
  l.beds,
  l.baths,
  l.furnished,
  l.utilities_included,
  l.pet_friendly,
  l.parking,
  l.wifi_included,
  l.laundry,
  l.amenities,
  l.photos,
  l.available_from,
  l.available_to,
  l.semester,
  l.status,
  l.is_active,
  l.is_featured,
  l.featured_until,
  l.pending_review,
  l.verification_tier,
  l.flagged,
  l.safe_score,
  l.view_count,
  l.views,
  l.saves_count,
  l.share_count,
  l.created_at,
  l.updated_at,
  l.sort_at,
  l.bumped_at,
  l.filled_at,
  l.filled_via_lease_up,
  l.roommate_prefs,
  l.display_name,
  l.deposit_amount,
  l.deposit_escrow_enabled,
  (
    COALESCE((SELECT count(*) FROM saved_listings s
               WHERE s.listing_id = l.id
                 AND s.created_at > now() - interval '7 days'), 0) * 3
    + COALESCE(l.view_count, 0) * 1
    + COALESCE((SELECT count(*) FROM messages m
                  JOIN conversations c ON c.id = m.conversation_id
                 WHERE c.listing_id = l.id
                   AND m.created_at > now() - interval '7 days'), 0) * 2
  ) AS trending_score
FROM public.listings l
WHERE l.is_active = true
  AND COALESCE(l.flagged, false) = false;

GRANT SELECT ON public.trending_listings TO anon;
GRANT SELECT ON public.trending_listings TO authenticated;
GRANT ALL ON public.trending_listings TO service_role;