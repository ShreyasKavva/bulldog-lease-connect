ALTER TABLE public.campus_notify_signups
  ADD CONSTRAINT campus_notify_signups_email_format
  CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

CREATE UNIQUE INDEX campus_notify_signups_campus_email_key
  ON public.campus_notify_signups (campus_id, lower(email));

DROP POLICY "Anyone can request notifications" ON public.campus_notify_signups;

CREATE POLICY "Anyone can request notifications"
  ON public.campus_notify_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND (auth.uid() IS NULL OR user_id IS NULL OR lower(email) = lower(auth.jwt() ->> 'email'))
  );