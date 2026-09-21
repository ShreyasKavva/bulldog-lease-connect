DROP POLICY "Anyone can create an email alert" ON public.saved_searches;

CREATE POLICY "Anyone can create an email alert"
ON public.saved_searches
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (
    (user_id IS NULL AND email IS NOT NULL)
    OR user_id = auth.uid()
  )
  AND (
    email IS NULL
    OR (
      email ~* '^[^@\s]+@[^@\s.]+\.[a-z]{2,}$'
      AND length(email) <= 254
    )
  )
  AND (
    auth.uid() IS NULL
    OR email IS NULL
    OR lower(email) = lower(auth.jwt() ->> 'email')
  )
);