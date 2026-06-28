
-- 1. Market stats view (security_invoker so RLS on listings applies to caller)
CREATE OR REPLACE VIEW public.campus_price_stats
WITH (security_invoker = on) AS
SELECT
  campus_id,
  beds,
  COUNT(*)::int AS listing_count,
  ROUND(AVG(price))::int AS avg_price,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::int AS median_price,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price)::int AS p25_price,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price)::int AS p75_price,
  MIN(price)::int AS min_price,
  MAX(price)::int AS max_price
FROM public.listings
WHERE is_active = true
  AND created_at > now() - interval '90 days'
  AND beds IS NOT NULL
  AND price IS NOT NULL
GROUP BY campus_id, beds
HAVING COUNT(*) >= 3;

GRANT SELECT ON public.campus_price_stats TO anon, authenticated, service_role;

-- 2. Helper: label a price
CREATE OR REPLACE FUNCTION public.get_price_label(
  listing_price integer,
  campus uuid,
  bed_count integer
) RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE stats record;
BEGIN
  SELECT * INTO stats FROM public.campus_price_stats
   WHERE campus_id = campus AND beds = bed_count;
  IF NOT FOUND THEN RETURN 'no_data'; END IF;
  IF listing_price <= stats.p25_price * 0.92 THEN RETURN 'great_deal';
  ELSIF listing_price <= stats.median_price THEN RETURN 'good_price';
  ELSIF listing_price <= stats.p75_price * 1.05 THEN RETURN 'fair_price';
  ELSE RETURN 'above_market';
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_price_label(integer, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_price_label(integer, uuid, integer) TO anon, authenticated, service_role;

-- 3. Full stats (used by guidance UI + detail bar)
CREATE OR REPLACE FUNCTION public.get_campus_price_stats(campus uuid, bed_count integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE stats record;
BEGIN
  SELECT * INTO stats FROM public.campus_price_stats
   WHERE campus_id = campus AND beds = bed_count;
  IF NOT FOUND THEN RETURN jsonb_build_object('has_data', false); END IF;
  RETURN jsonb_build_object(
    'has_data', true,
    'listing_count', stats.listing_count,
    'min_price', stats.min_price,
    'p25_price', stats.p25_price,
    'median_price', stats.median_price,
    'avg_price', stats.avg_price,
    'p75_price', stats.p75_price,
    'max_price', stats.max_price
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.get_campus_price_stats(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_campus_price_stats(uuid, integer) TO anon, authenticated, service_role;

-- 4. Stale-listing nudge: active 21+ days, zero inbound messages
CREATE OR REPLACE FUNCTION public.get_stale_listings_for_user(_uid uuid)
RETURNS TABLE(listing_id uuid, title text, price int, beds int, campus_id uuid, days_active int, median_price int)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _uid IS NULL OR auth.uid() <> _uid THEN RETURN; END IF;
  RETURN QUERY
  SELECT l.id, l.title, l.price, l.beds, l.campus_id,
         EXTRACT(day FROM now() - l.created_at)::int,
         COALESCE(s.median_price, 0)
  FROM public.listings l
  LEFT JOIN public.campus_price_stats s ON s.campus_id = l.campus_id AND s.beds = l.beds
  WHERE l.user_id = _uid
    AND l.is_active = true
    AND COALESCE(l.status, 'active') = 'active'
    AND l.created_at < now() - interval '21 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.messages m ON m.conversation_id = c.id
      WHERE c.listing_id = l.id AND m.sender_id <> l.user_id
    );
END $$;

REVOKE EXECUTE ON FUNCTION public.get_stale_listings_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stale_listings_for_user(uuid) TO authenticated, service_role;

-- 5. Avg price by neighborhood for /market
CREATE OR REPLACE FUNCTION public.get_neighborhood_price_breakdown(campus uuid)
RETURNS TABLE(area text, listing_count int, avg_price int, median_price int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(area, 'Other') AS area,
    COUNT(*)::int,
    ROUND(AVG(price))::int,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::int
  FROM public.listings
  WHERE is_active = true
    AND campus_id = campus
    AND price IS NOT NULL
    AND created_at > now() - interval '90 days'
  GROUP BY COALESCE(area, 'Other')
  HAVING COUNT(*) >= 1
  ORDER BY COUNT(*) DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_neighborhood_price_breakdown(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_neighborhood_price_breakdown(uuid) TO anon, authenticated, service_role;
