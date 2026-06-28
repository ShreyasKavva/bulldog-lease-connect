
-- Queue 18: Analytics
-- 1) Make increment_listing_view skip self-views
CREATE OR REPLACE FUNCTION public.increment_listing_view(_listing_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
  v_listing RECORD;
  v_uid uuid := auth.uid();
BEGIN
  SELECT user_id, title, view_count INTO v_listing FROM public.listings WHERE id = _listing_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Do not count the poster viewing their own listing
  IF v_uid IS NOT NULL AND v_uid = v_listing.user_id THEN
    RETURN COALESCE(v_listing.view_count, 0);
  END IF;

  UPDATE public.listings SET view_count = view_count + 1 WHERE id = _listing_id RETURNING view_count INTO v_count;

  IF v_count IN (50, 100, 250, 500, 1000) THEN
    IF v_listing.user_id IS NOT NULL AND public.notif_pref_enabled(v_listing.user_id, 'view_milestone') THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, data)
      VALUES (
        v_listing.user_id,
        'listing_viewed_milestone',
        'Your listing hit ' || v_count || ' views! 🎉',
        v_listing.title || ' is getting attention.',
        '/?listing=' || _listing_id::text,
        jsonb_build_object('listing_id', _listing_id, 'views', v_count)
      );
    END IF;
  END IF;
  RETURN COALESCE(v_count, 0);
END; $function$;

-- 2) Daily snapshot table
CREATE TABLE IF NOT EXISTS public.listing_stats_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  date date NOT NULL,
  views integer NOT NULL DEFAULT 0,
  saves integer NOT NULL DEFAULT 0,
  messages integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id, date)
);

GRANT SELECT ON public.listing_stats_daily TO authenticated;
GRANT ALL ON public.listing_stats_daily TO service_role;

ALTER TABLE public.listing_stats_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stats_owner_read" ON public.listing_stats_daily
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.user_id = auth.uid()));

CREATE POLICY "stats_admin_read" ON public.listing_stats_daily
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS listing_stats_daily_listing_date_idx
  ON public.listing_stats_daily (listing_id, date DESC);

-- 3) Snapshot function — compute daily DELTAS from running totals
CREATE OR REPLACE FUNCTION public.snapshot_listing_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := CURRENT_DATE;
BEGIN
  INSERT INTO public.listing_stats_daily (listing_id, date, views, saves, messages)
  SELECT
    l.id,
    v_today,
    l.view_count,
    COALESCE((SELECT COUNT(*) FROM public.saved_listings s WHERE s.listing_id = l.id), 0),
    COALESCE((SELECT COUNT(DISTINCT m.sender_id)
      FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE c.listing_id = l.id AND m.sender_id <> l.user_id), 0)
  FROM public.listings l
  WHERE l.is_active = true
  ON CONFLICT (listing_id, date) DO UPDATE SET
    views = EXCLUDED.views,
    saves = EXCLUDED.saves,
    messages = EXCLUDED.messages;
END;
$$;

-- 4) Schedule nightly snapshot at midnight UTC
DO $$ BEGIN
  PERFORM cron.unschedule('snapshot-listing-stats');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('snapshot-listing-stats', '0 0 * * *', $$SELECT public.snapshot_listing_stats();$$);

-- 5) Listing analytics aggregate RPC (campus + bed-count benchmark)
CREATE OR REPLACE FUNCTION public.get_listing_benchmark(_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_listing RECORD;
  v_avg_views numeric;
  v_avg_price numeric;
  v_median_price numeric;
  v_min_price integer;
  v_max_price integer;
  v_avg_save_rate numeric;
  v_msg_rate numeric;
BEGIN
  SELECT l.*, p.user_id AS poster FROM public.listings l
    LEFT JOIN public.profiles p ON p.id = l.user_id
    WHERE l.id = _listing_id INTO v_listing;
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
END; $$;

GRANT EXECUTE ON FUNCTION public.get_listing_benchmark(uuid) TO authenticated;

-- 6) Saved-search match-count helper
CREATE OR REPLACE FUNCTION public.count_saved_search_matches(_search_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s RECORD;
  v_count integer;
BEGIN
  SELECT * INTO s FROM public.saved_searches WHERE id = _search_id AND user_id = auth.uid();
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT COUNT(*) INTO v_count FROM public.listings l
   WHERE l.is_active = true
     AND (s.campus_id IS NULL OR l.campus_id = s.campus_id)
     AND (s.area IS NULL OR l.area = s.area)
     AND (s.max_price IS NULL OR l.price <= s.max_price)
     AND (s.min_beds IS NULL OR l.beds >= s.min_beds)
     AND (s.furnished_only = false OR l.furnished = true)
     AND (s.pet_friendly_only = false OR l.pet_friendly = true)
     AND (s.keyword IS NULL OR s.keyword = '' OR
          l.title ILIKE '%' || s.keyword || '%' OR
          COALESCE(l.description, '') ILIKE '%' || s.keyword || '%');
  RETURN COALESCE(v_count, 0);
END; $$;

GRANT EXECUTE ON FUNCTION public.count_saved_search_matches(uuid) TO authenticated;

-- 7) Seed snapshot for today so charts have something on day 1
SELECT public.snapshot_listing_stats();
