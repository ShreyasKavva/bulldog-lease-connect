-- Q459 step 2: anon may no longer read location columns on listings.
REVOKE SELECT ON public.listings FROM anon;

GRANT SELECT (
  id, user_id, campus_id, title, description, type, price, beds, baths,
  furnished, utilities_included, pet_friendly, parking, wifi_included, laundry,
  amenities, photos, available_from, available_to, semester, status, is_active,
  is_featured, featured_until, pending_review, verification_tier, flagged,
  safe_score, view_count, views, saves_count, share_count, created_at,
  updated_at, sort_at, bumped_at, filled_at, filled_via_lease_up,
  filled_with_user_id, roommate_prefs, display_name, deposit_amount,
  deposit_escrow_enabled
) ON public.listings TO anon;

-- Q459 step 3: the neighborhood breakdown must never hand a raw street
-- address to a caller. Mirrors src/lib/leaseup/area.ts: rows whose area
-- starts with a house number or contains a street suffix are dropped
-- server-side. Return shape and the >= 1 HAVING floor are unchanged, so
-- /market's own MIN_COMPS = 3 filter keeps behaving exactly as today.
CREATE OR REPLACE FUNCTION public.get_neighborhood_price_breakdown(campus uuid)
 RETURNS TABLE(area text, listing_count integer, avg_price integer, median_price integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(l.area, 'Other') AS area,
    COUNT(*)::int,
    ROUND(AVG(l.price))::int,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY l.price)::int
  FROM public.listings l
  WHERE l.is_active = true
    AND l.campus_id = campus
    AND l.price IS NOT NULL
    AND l.created_at > now() - interval '90 days'
    AND (
      l.area IS NULL
      OR (
        btrim(l.area) !~ '^\s*#?\d+\s+\S'
        AND btrim(l.area) !~* '\y(st|street|ave|av|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court|way|pkwy|parkway|ter|terrace|cir|circle|hwy|highway|apt|unit|suite|ste)\.?\y'
        AND length(btrim(l.area)) >= 3
      )
    )
  GROUP BY COALESCE(l.area, 'Other')
  HAVING COUNT(*) >= 1
  ORDER BY COUNT(*) DESC;
$function$;