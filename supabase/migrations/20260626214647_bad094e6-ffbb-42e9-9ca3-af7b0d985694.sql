
-- Referral + ambassador columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_ambassador boolean NOT NULL DEFAULT false;

-- Generator: 6-char uppercase alphanumeric, retry on collision
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_i int;
BEGIN
  LOOP
    v_code := '';
    FOR v_i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

-- Backfill existing profiles
UPDATE public.profiles SET referral_code = public.generate_referral_code() WHERE referral_code IS NULL;

-- Update handle_new_user to assign code + apply referrer from raw_user_meta_data.ref
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain text;
  v_campus uuid;
  v_ref_code text;
  v_referrer uuid;
BEGIN
  v_domain := lower(split_part(NEW.email, '@', 2));
  SELECT id INTO v_campus FROM public.campuses WHERE domain = v_domain LIMIT 1;

  v_ref_code := NULLIF(upper(NEW.raw_user_meta_data->>'ref'), '');
  IF v_ref_code IS NOT NULL THEN
    SELECT id INTO v_referrer FROM public.profiles WHERE referral_code = v_ref_code LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, name, campus_id, verified_email, referral_code, referred_by)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    v_campus,
    v_campus IS NOT NULL,
    public.generate_referral_code(),
    v_referrer
  );

  IF v_referrer IS NOT NULL THEN
    INSERT INTO public.referral_events (referrer_id, referred_id, campus_id)
    VALUES (v_referrer, NEW.id, v_campus);
    UPDATE public.profiles SET referral_count = referral_count + 1 WHERE id = v_referrer;
  END IF;

  RETURN NEW;
END;
$$;

-- Referral events table
CREATE TABLE IF NOT EXISTS public.referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campus_id uuid REFERENCES public.campuses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.referral_events TO authenticated;
GRANT ALL ON public.referral_events TO service_role;

ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own referrals"
ON public.referral_events FOR SELECT
TO authenticated
USING (auth.uid() = referrer_id);

-- Trending listings view (uses view_count and conversations->messages)
CREATE OR REPLACE VIEW public.trending_listings AS
SELECT
  l.*,
  (
    COALESCE((SELECT COUNT(*) FROM public.saved_listings s
              WHERE s.listing_id = l.id AND s.created_at > now() - interval '7 days'), 0) * 3
    + COALESCE(l.view_count, 0) * 1
    + COALESCE((SELECT COUNT(*) FROM public.messages m
                JOIN public.conversations c ON c.id = m.conversation_id
                WHERE c.listing_id = l.id AND m.created_at > now() - interval '7 days'), 0) * 2
  ) AS trending_score
FROM public.listings l
WHERE l.is_active = true AND COALESCE(l.flagged, false) = false;

GRANT SELECT ON public.trending_listings TO authenticated, anon;
