
-- Looking For board polish: soft delete, found-deals, interests, expiry cron

ALTER TABLE public.looking_for_posts
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS expiry_notified_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen timestamptz;

-- closed_deals
CREATE TABLE IF NOT EXISTS public.closed_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campus_id uuid REFERENCES public.campuses(id) ON DELETE SET NULL,
  looking_for_post_id uuid REFERENCES public.looking_for_posts(id) ON DELETE SET NULL,
  found_via_lease_up boolean NOT NULL DEFAULT false,
  closed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.closed_deals TO authenticated;
GRANT SELECT ON public.closed_deals TO anon;
GRANT ALL ON public.closed_deals TO service_role;
ALTER TABLE public.closed_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own deals" ON public.closed_deals;
CREATE POLICY "Users manage own deals" ON public.closed_deals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Anyone can read closed deals" ON public.closed_deals;
CREATE POLICY "Anyone can read closed deals" ON public.closed_deals
  FOR SELECT USING (true);

-- looking_for_interests
CREATE TABLE IF NOT EXISTS public.looking_for_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.looking_for_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.looking_for_interests TO authenticated;
GRANT ALL ON public.looking_for_interests TO service_role;
ALTER TABLE public.looking_for_interests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own interests" ON public.looking_for_interests;
CREATE POLICY "Users manage own interests" ON public.looking_for_interests
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Post owners read interests" ON public.looking_for_interests;
CREATE POLICY "Post owners read interests" ON public.looking_for_interests
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.looking_for_posts p
    WHERE p.id = request_id AND p.user_id = auth.uid()
  ));

-- Trigger: when an interested user posts a matching listing, notify them
CREATE OR REPLACE FUNCTION public.notify_listing_for_interested_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  IF NEW.is_active IS NOT TRUE THEN RETURN NEW; END IF;
  FOR r IN
    SELECT lfi.user_id AS viewer_id,
           lf.id       AS lf_id,
           lf.user_id  AS poster_id,
           lf.title    AS lf_title,
           p.name      AS poster_name
    FROM public.looking_for_interests lfi
    JOIN public.looking_for_posts lf ON lf.id = lfi.request_id
    LEFT JOIN public.profiles p ON p.id = lf.user_id
    WHERE lfi.user_id = NEW.user_id
      AND lf.is_active = true
      AND (lf.campus_id IS NULL OR lf.campus_id = NEW.campus_id)
      AND (lf.budget_max IS NULL OR NEW.price <= lf.budget_max)
      AND (lf.beds_min  IS NULL OR NEW.beds  >= lf.beds_min)
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, data)
    VALUES (
      r.viewer_id,
      'interest_match',
      'You might have a place for ' || COALESCE(r.poster_name, 'a student'),
      'You marked interest in their "Looking For" post — they are still looking. Message them?',
      '/looking-for',
      jsonb_build_object(
        'listing_id', NEW.id,
        'looking_for_post_id', r.lf_id,
        'poster_id', r.poster_id
      )
    );
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_listing_for_interested_request ON public.listings;
CREATE TRIGGER trg_notify_listing_for_interested_request
AFTER INSERT ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.notify_listing_for_interested_request();

-- Daily expiry processing
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.process_looking_for_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Expire posts older than 90 days
  UPDATE public.looking_for_posts
  SET is_active = false
  WHERE is_active = true
    AND created_at < now() - interval '90 days';

  -- 3-day warning: posts 87+ days old, still active, not yet warned
  INSERT INTO public.notifications (user_id, type, title, body, link, data)
  SELECT
    lf.user_id,
    'looking_for_expiring',
    'Your Looking For post expires in 3 days',
    'Still looking? Renew "' || lf.title || '" for 90 more days.',
    '/looking-for',
    jsonb_build_object('looking_for_post_id', lf.id)
  FROM public.looking_for_posts lf
  WHERE lf.is_active = true
    AND lf.expiry_notified_at IS NULL
    AND lf.created_at < now() - interval '87 days'
    AND lf.created_at >= now() - interval '90 days';

  UPDATE public.looking_for_posts
  SET expiry_notified_at = now()
  WHERE is_active = true
    AND expiry_notified_at IS NULL
    AND created_at < now() - interval '87 days'
    AND created_at >= now() - interval '90 days';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'looking-for-expiry-daily') THEN
    PERFORM cron.schedule(
      'looking-for-expiry-daily',
      '0 9 * * *',
      $cmd$SELECT public.process_looking_for_expiry();$cmd$
    );
  END IF;
END $$;

-- Enable realtime on the new social tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.closed_deals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.looking_for_interests;
