
-- 1. Prevent profile privilege escalation via trigger
DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 2. Restrict full-row profile reads; expose safe fields via view
DROP POLICY IF EXISTS profiles_auth_read ON public.profiles;

CREATE POLICY profiles_self_read ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY profiles_admin_read ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT
  id, name, avatar_emoji, banner_color, bio, year, major,
  campus_id, vibe_tags, is_ambassador, verified_email,
  currently_emoji, currently_status, currently_updated_at,
  created_at, updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated, anon;

-- 3. Boost purchases: explicit admin-only UPDATE policy
DROP POLICY IF EXISTS "Admins can update boost purchases" ON public.boost_purchases;
CREATE POLICY "Admins can update boost purchases" ON public.boost_purchases
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 4. Deposit agreements: explicit admin-only UPDATE policy
DROP POLICY IF EXISTS "Admins can update deposit agreements" ON public.deposit_agreements;
CREATE POLICY "Admins can update deposit agreements" ON public.deposit_agreements
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 5. Lock down SECURITY DEFINER functions from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.auto_approve_pending_listings() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_listing_safe_score(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_verification_tier(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_roommate_interest() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notif_pref_enabled(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_listing_for_interested_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_listing_match() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_listing_saved() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_price_drop() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_tour_booking() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_review_on_listing_filled() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_saved_search_matches() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_looking_for_expiry() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_post_tour_surveys() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_review_prompts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_safe_score_on_review() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_verification_tier_after() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.score_and_hide_report() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.snapshot_listing_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_in_message_convo(uuid, uuid) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.count_saved_search_matches(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_listing_benchmark(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_stale_listings_for_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_campus_price_stats(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_neighborhood_price_breakdown(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_price_label(integer, uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_listing_view(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.count_saved_search_matches(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_listing_benchmark(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stale_listings_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campus_price_stats(uuid, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_neighborhood_price_breakdown(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_price_label(integer, uuid, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.increment_listing_view(uuid) TO authenticated, anon;
