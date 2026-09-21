DROP POLICY "Anyone can request notifications" ON public.campus_notify_signups;

CREATE POLICY "Anyone can request notifications"
ON public.campus_notify_signups
FOR INSERT
TO anon, authenticated
WITH CHECK (
  ((user_id IS NULL) OR (user_id = auth.uid()))
  AND (
    auth.uid() IS NULL
    OR lower(email) = lower(auth.jwt() ->> 'email')
  )
  AND email ~* '^[^@\s]+@[^@\s.]+\.[a-z]{2,}$'
  AND length(email) <= 254
);