DROP POLICY "Users manage their own saved searches" ON public.saved_searches;

CREATE POLICY "Users read their own saved searches"
ON public.saved_searches FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users update their own saved searches"
ON public.saved_searches FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    email IS NULL
    OR lower(email) = lower(auth.jwt() ->> 'email')
  )
);

CREATE POLICY "Users delete their own saved searches"
ON public.saved_searches FOR DELETE
USING (auth.uid() = user_id);