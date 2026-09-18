CREATE OR REPLACE FUNCTION public.get_listing_benchmark(_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing RECORD;
  v_avg_views numeric;
  v_avg_price numeric;
  v_median_price numeric;
  v_min_price integer;
  v_max_price integer;
BEGIN
  SELECT l.* FROM public.listings l WHERE l.id = _listing_id INTO v_listing;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;

  SELECT
    AVG(view_count),
    AVG(price),
    MIN(price),
    MAX(price),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)
  INTO v_avg_views, v_avg_price, v_min_price, v_max_price, v_median_price
  FROM public.listings
  WHERE campus_id = v_listing.campus_id
    AND beds = v_listing.beds
    AND is_active = true
    AND created_at > now() - interval '30 days'
    AND id <> _listing_id;

  RETURN jsonb_build_object(
    'avg_views', COALESCE(v_avg_views, 0),
    'avg_price', COALESCE(v_avg_price, 0),
    'median_price', COALESCE(v_median_price, 0),
    'min_price', COALESCE(v_min_price, 0),
    'max_price', COALESCE(v_max_price, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_listing_benchmark(uuid) TO anon, authenticated, service_role;