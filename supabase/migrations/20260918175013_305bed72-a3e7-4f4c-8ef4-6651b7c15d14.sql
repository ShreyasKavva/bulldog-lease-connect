DROP POLICY IF EXISTS "notify_signup_insert_self" ON public.campus_notify_signups;

CREATE POLICY "notify_signup_insert_self"
ON public.campus_notify_signups
FOR INSERT
WITH CHECK (user_id IS NULL OR user_id = auth.uid());