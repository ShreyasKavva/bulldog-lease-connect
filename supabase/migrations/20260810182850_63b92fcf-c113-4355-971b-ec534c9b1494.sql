ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS saves_count integer NOT NULL DEFAULT 0;

UPDATE public.listings l
SET saves_count = COALESCE(s.c, 0)
FROM (SELECT listing_id, count(*)::int AS c FROM public.saved_listings GROUP BY listing_id) s
WHERE s.listing_id = l.id;

CREATE OR REPLACE FUNCTION public.sync_listing_saves_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.listings SET saves_count = saves_count + 1 WHERE id = NEW.listing_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.listings SET saves_count = GREATEST(saves_count - 1, 0) WHERE id = OLD.listing_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_listing_saves_count ON public.saved_listings;
CREATE TRIGGER trg_sync_listing_saves_count
AFTER INSERT OR DELETE ON public.saved_listings
FOR EACH ROW EXECUTE FUNCTION public.sync_listing_saves_count();