CREATE POLICY "Anyone reads save counts" ON public.saved_listings FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.saved_listings TO anon;