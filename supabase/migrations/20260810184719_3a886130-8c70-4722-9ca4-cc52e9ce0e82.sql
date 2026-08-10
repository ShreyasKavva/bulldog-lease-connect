-- 1. Public-safe profile view (owner-rights so it can serve public columns
--    without granting table-wide row access on public.profiles).
CREATE OR REPLACE VIEW public.profiles_public AS
  SELECT id, name, avatar_emoji, banner_color, bio, year, major, campus_id,
         vibe_tags, is_ambassador, verified_email, currently_emoji,
         currently_status, currently_updated_at, created_at, updated_at,
         avatar_url, last_seen, referral_count, instagram_handle, response_rate
    FROM public.profiles;

ALTER VIEW public.profiles_public SET (security_invoker = false);

GRANT SELECT ON public.profiles_public TO anon, authenticated;
GRANT ALL ON public.profiles_public TO service_role;

-- 2. Remove the broad row-level read that exposed every profile column
--    (email, phone, is_admin, banned, notification_preferences, referral data)
--    to anon/authenticated whenever the owner had an active listing.
DROP POLICY IF EXISTS profiles_public_listing_owner_read ON public.profiles;

-- 3. Narrow email lookup for first-message notification emails: callers may
--    only read the email of the other participant in their own conversation.
CREATE OR REPLACE FUNCTION public.get_conversation_participant_email(
  _conversation_id uuid, _user_id uuid
) RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.email
  FROM public.conversations c
  JOIN public.profiles p ON p.id = _user_id
  WHERE c.id = _conversation_id
    AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
    AND (c.participant_1_id = _user_id OR c.participant_2_id = _user_id);
$$;

REVOKE ALL ON FUNCTION public.get_conversation_participant_email(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_conversation_participant_email(uuid, uuid) TO authenticated;
