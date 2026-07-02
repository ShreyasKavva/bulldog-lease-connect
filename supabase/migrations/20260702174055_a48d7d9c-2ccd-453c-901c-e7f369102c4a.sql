
-- 1. closed_deals: restrict SELECT to participants + admins
DROP POLICY IF EXISTS "Anyone can read closed deals" ON public.closed_deals;
CREATE POLICY "Closed deals visible to participants or admins"
  ON public.closed_deals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- 2. listing_shares: remove WITH CHECK (true); require self or anonymous
DROP POLICY IF EXISTS "Anyone can record a share" ON public.listing_shares;
CREATE POLICY "Users can record their own shares"
  ON public.listing_shares FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- 3. profiles: prevent broad PII exposure via column-level grants.
--    RLS still allows row visibility, but sensitive columns are not selectable
--    by clients. Sensitive fields (email, phone) are readable via auth.user()
--    for the current user; is_admin is checked via the is_admin() RPC.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, name, year, major, campus_id, bio, avatar_emoji, banner_color,
  vibe_tags, verified_email, created_at, updated_at,
  currently_status, currently_emoji, currently_updated_at, last_seen,
  referral_code, referral_count, is_ambassador, onboarding_completed, intent
) ON public.profiles TO authenticated;
GRANT SELECT (
  id, name, campus_id, bio, avatar_emoji, banner_color, vibe_tags,
  verified_email, created_at, is_ambassador
) ON public.profiles TO anon;

-- 4. Set immutable search_path on remaining SECURITY DEFINER functions
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

-- 5. Revoke EXECUTE from anon/authenticated on internal SECURITY DEFINER
--    functions. Keep the small set of client-callable RPCs executable.
DO $$
DECLARE
  r RECORD;
  keep text[] := ARRAY[
    'is_admin',
    'count_saved_search_matches',
    'get_campus_price_stats',
    'get_neighborhood_price_breakdown',
    'get_listing_benchmark',
    'get_price_label',
    'get_stale_listings_for_user',
    'increment_listing_view'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    IF NOT (r.proname = ANY(keep)) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    END IF;
  END LOOP;
END $$;
