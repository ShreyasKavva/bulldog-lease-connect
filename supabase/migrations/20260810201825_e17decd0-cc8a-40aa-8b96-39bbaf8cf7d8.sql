ALTER TABLE public.saved_searches
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN name SET DEFAULT 'My alert',
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS filters jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.saved_searches
  ADD CONSTRAINT saved_searches_owner_or_email CHECK (user_id IS NOT NULL OR email IS NOT NULL);

GRANT INSERT ON public.saved_searches TO anon;

CREATE POLICY "Anyone can create an email alert"
ON public.saved_searches
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (user_id IS NULL AND email IS NOT NULL)
  OR user_id = auth.uid()
);