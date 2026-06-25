
-- 1. Fix profiles public email exposure: restrict SELECT to authenticated users.
DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
CREATE POLICY "profiles_auth_read" ON public.profiles
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.profiles FROM anon;

-- 2. Prevent self-promotion to admin / self-unban via profiles_self_update.
-- Use a trigger so non-admin users cannot change is_admin or banned on their own row.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'Not authorized to change is_admin';
  END IF;
  IF NEW.banned IS DISTINCT FROM OLD.banned THEN
    RAISE EXCEPTION 'Not authorized to change banned';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_priv_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_priv_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 3. Restrict message inserts to actual conversation participants.
DROP POLICY IF EXISTS "msg_sender_insert" ON public.messages;
CREATE POLICY "msg_sender_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (auth.uid() = c.participant_1_id OR auth.uid() = c.participant_2_id)
        AND (recipient_id = c.participant_1_id OR recipient_id = c.participant_2_id)
        AND recipient_id <> auth.uid()
    )
  );

-- 4. Revoke EXECUTE on SECURITY DEFINER helpers from anon/authenticated.
-- These run via RLS policy evaluation or triggers and never need direct callable access.
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.compute_listing_safe_score(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.refresh_listing_safe_score_after() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.refresh_user_listings_safe_score() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM anon, authenticated, public;
