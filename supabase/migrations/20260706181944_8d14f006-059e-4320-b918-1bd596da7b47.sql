
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS bumped_at timestamptz;
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS sort_at timestamptz
  GENERATED ALWAYS AS (COALESCE(bumped_at, created_at)) STORED;
CREATE INDEX IF NOT EXISTS listings_sort_at_desc_idx ON public.listings (sort_at DESC);

CREATE OR REPLACE FUNCTION public.bump_listing(_listing_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_last timestamptz;
  v_new timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id, bumped_at INTO v_owner, v_last
    FROM public.listings WHERE id = _listing_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;
  IF v_owner <> v_uid THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF v_last IS NOT NULL AND v_last > now() - interval '7 days' THEN
    RAISE EXCEPTION 'Can only bump once every 7 days';
  END IF;

  UPDATE public.listings SET bumped_at = now()
    WHERE id = _listing_id
    RETURNING bumped_at INTO v_new;

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_listing(uuid) TO authenticated;
