ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_listing_share(_listing_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.listings SET share_count = share_count + 1
    WHERE id = _listing_id
    RETURNING share_count INTO v_count;
  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_listing_share(uuid) TO anon, authenticated;