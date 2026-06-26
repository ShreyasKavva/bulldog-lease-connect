
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  campus_id UUID REFERENCES public.campuses(id) ON DELETE SET NULL,
  area TEXT,
  max_price INTEGER,
  min_beds INTEGER,
  furnished_only BOOLEAN NOT NULL DEFAULT false,
  pet_friendly_only BOOLEAN NOT NULL DEFAULT false,
  keyword TEXT,
  notify BOOLEAN NOT NULL DEFAULT true,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
GRANT ALL ON public.saved_searches TO service_role;

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own saved searches"
ON public.saved_searches FOR ALL
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_saved_searches_updated_at
BEFORE UPDATE ON public.saved_searches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_saved_searches_user ON public.saved_searches(user_id);

CREATE OR REPLACE FUNCTION public.notify_saved_search_matches()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s RECORD;
BEGIN
  IF NEW.is_active = false THEN RETURN NEW; END IF;
  FOR s IN
    SELECT * FROM public.saved_searches
    WHERE notify = true
      AND user_id <> NEW.user_id
      AND (campus_id IS NULL OR campus_id = NEW.campus_id)
      AND (area IS NULL OR area = NEW.area)
      AND (max_price IS NULL OR NEW.price <= max_price)
      AND (min_beds IS NULL OR NEW.beds >= min_beds)
      AND (furnished_only = false OR NEW.furnished = true)
      AND (pet_friendly_only = false OR NEW.pet_friendly = true)
      AND (keyword IS NULL OR keyword = '' OR
           NEW.title ILIKE '%' || keyword || '%' OR
           COALESCE(NEW.description, '') ILIKE '%' || keyword || '%')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, listing_id)
    VALUES (
      s.user_id, 'saved_search_match',
      'New match for "' || s.name || '"',
      NEW.title || ' · $' || NEW.price::text || '/mo' || COALESCE(' · ' || NEW.area, ''),
      NEW.id
    );
    UPDATE public.saved_searches SET last_notified_at = now() WHERE id = s.id;
  END LOOP;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.notify_saved_search_matches() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notify_saved_search_matches
AFTER INSERT ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.notify_saved_search_matches();
