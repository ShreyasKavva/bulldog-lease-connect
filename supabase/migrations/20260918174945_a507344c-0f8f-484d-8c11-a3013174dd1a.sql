DROP POLICY IF EXISTS "Anyone can sign up for notifications" ON public.campus_notify_signups;
DROP POLICY IF EXISTS "Anyone can insert notify signups" ON public.campus_notify_signups;
DROP POLICY IF EXISTS "campus_notify_signups_insert" ON public.campus_notify_signups;

CREATE POLICY "notify_signup_insert_self"
ON public.campus_notify_signups
FOR INSERT
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL)
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
);