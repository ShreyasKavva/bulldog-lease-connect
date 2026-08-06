ALTER TABLE public.listing_reports ALTER COLUMN reporter_id DROP NOT NULL;

DROP POLICY IF EXISTS "reports_insert_any_auth" ON public.listing_reports;

CREATE POLICY "reports_insert_authenticated"
ON public.listing_reports FOR INSERT TO authenticated
WITH CHECK (reporter_id IS NULL OR auth.uid() = reporter_id);

CREATE POLICY "reports_insert_anonymous"
ON public.listing_reports FOR INSERT TO anon
WITH CHECK (reporter_id IS NULL);

GRANT INSERT ON public.listing_reports TO anon;