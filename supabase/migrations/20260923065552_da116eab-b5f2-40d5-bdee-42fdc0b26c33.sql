-- Q460 (follow-up): trending_listings is security_invoker, so its saves/messages
-- subqueries ran with the caller's privileges and 42501'd for anon on
-- saved_listings. Move just those two COUNTS behind a SECURITY DEFINER helper
-- that returns a single integer — no rows, no PII, no location columns.
CREATE OR REPLACE FUNCTION public.listing_engagement_score(_listing_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    COALESCE((SELECT count(*) FROM public.saved_listings s
               WHERE s.listing_id = _listing_id
                 AND s.created_at > now() - interval '7 days'), 0) * 3
    + COALESCE((SELECT count(*) FROM public.messages m
                  JOIN public.conversations c ON c.id = m.conversation_id
                 WHERE c.listing_id = _listing_id
                   AND m.created_at > now() - interval '7 days'), 0) * 2
  )::int;
$$;

REVOKE ALL ON FUNCTION public.listing_engagement_score(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.listing_engagement_score(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.trending_listings
WITH (security_invoker = true) AS
SELECT
  l.id, l.user_id, l.campus_id, l.title, l.description, l.type, l.price,
  l.beds, l.baths, l.furnished, l.utilities_included, l.pet_friendly,
  l.parking, l.wifi_included, l.laundry, l.amenities, l.photos,
  l.available_from, l.available_to, l.semester, l.status, l.is_active,
  l.is_featured, l.featured_until, l.pending_review, l.verification_tier,
  l.flagged, l.safe_score, l.view_count, l.views, l.saves_count,
  l.share_count, l.created_at, l.updated_at, l.sort_at, l.bumped_at,
  l.filled_at, l.filled_via_lease_up, l.roommate_prefs, l.display_name,
  l.deposit_amount, l.deposit_escrow_enabled,
  (COALESCE(l.view_count, 0) + public.listing_engagement_score(l.id))::bigint AS trending_score
FROM public.listings l
WHERE l.is_active = true
  AND COALESCE(l.flagged, false) = false;