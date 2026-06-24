CREATE TABLE public.looking_for_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES public.campuses(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  budget_max INTEGER,
  move_in_date DATE,
  move_out_date DATE,
  beds_min INTEGER,
  area TEXT,
  furnished BOOLEAN,
  pets_ok BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.looking_for_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.looking_for_posts TO authenticated;
GRANT ALL ON public.looking_for_posts TO service_role;
ALTER TABLE public.looking_for_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lf_select_all" ON public.looking_for_posts FOR SELECT USING (true);
CREATE POLICY "lf_insert_own" ON public.looking_for_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lf_update_own" ON public.looking_for_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "lf_delete_own" ON public.looking_for_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER lf_updated_at BEFORE UPDATE ON public.looking_for_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.lease_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  summary TEXT,
  risk_score INTEGER,
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_excerpt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.lease_analyses TO authenticated;
GRANT ALL ON public.lease_analyses TO service_role;
ALTER TABLE public.lease_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "la_select_own" ON public.lease_analyses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "la_insert_own" ON public.lease_analyses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "la_delete_own" ON public.lease_analyses FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS safe_score INTEGER;

CREATE OR REPLACE FUNCTION public.compute_listing_safe_score(_listing_id UUID)
RETURNS INTEGER LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_score INTEGER := 0;
  v_listing RECORD;
  v_profile RECORD;
  v_photo_count INTEGER;
BEGIN
  SELECT * INTO v_listing FROM public.listings WHERE id = _listing_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_listing.user_id;

  v_photo_count := COALESCE(array_length(v_listing.photos, 1), 0);
  IF v_photo_count >= 3 THEN v_score := v_score + 15;
  ELSIF v_photo_count >= 1 THEN v_score := v_score + 10; END IF;

  IF length(COALESCE(v_listing.description,'')) >= 200 THEN v_score := v_score + 15;
  ELSIF length(COALESCE(v_listing.description,'')) >= 50 THEN v_score := v_score + 8; END IF;

  IF v_listing.price IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_listing.available_from IS NOT NULL AND v_listing.available_to IS NOT NULL THEN v_score := v_score + 10; END IF;
  IF v_listing.address IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_listing.lat IS NOT NULL AND v_listing.lng IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_listing.beds IS NOT NULL AND v_listing.baths IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_listing.furnished IS NOT NULL THEN v_score := v_score + 3; END IF;
  IF v_listing.area IS NOT NULL THEN v_score := v_score + 2; END IF;

  IF v_profile.verified_email THEN v_score := v_score + 15; END IF;
  IF v_profile.avatar_emoji IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_profile.year IS NOT NULL AND v_profile.major IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF length(COALESCE(v_profile.bio,'')) >= 30 THEN v_score := v_score + 5; END IF;
  IF v_profile.phone IS NOT NULL THEN v_score := v_score + 5; END IF;

  RETURN LEAST(v_score, 100);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_listing_safe_score_after()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.listings SET safe_score = public.compute_listing_safe_score(NEW.id) WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_safe_score_after ON public.listings;
CREATE TRIGGER listings_safe_score_after
AFTER INSERT OR UPDATE OF photos, description, price, available_from, available_to, address, lat, lng, beds, baths, furnished, area
ON public.listings FOR EACH ROW EXECUTE FUNCTION public.refresh_listing_safe_score_after();

CREATE OR REPLACE FUNCTION public.refresh_user_listings_safe_score()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.listings SET safe_score = public.compute_listing_safe_score(id) WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_safe_score_refresh ON public.profiles;
CREATE TRIGGER profiles_safe_score_refresh
AFTER UPDATE OF verified_email, avatar_emoji, year, major, bio, phone ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.refresh_user_listings_safe_score();

UPDATE public.listings SET safe_score = public.compute_listing_safe_score(id);