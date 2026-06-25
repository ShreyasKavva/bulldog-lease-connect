
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_listing_view(_listing_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.listings SET view_count = view_count + 1 WHERE id = _listing_id RETURNING view_count INTO v_count;
  RETURN COALESCE(v_count, 0);
END; $$;

GRANT EXECUTE ON FUNCTION public.increment_listing_view(UUID) TO anon, authenticated;
