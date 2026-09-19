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
  v_is_edu boolean;
BEGIN
  v_domain := lower(split_part(NEW.email, '@', 2));
  v_is_edu := v_domain LIKE '%.edu';

  SELECT campus_id INTO v_campus FROM public.campus_email_domains WHERE domain = v_domain LIMIT 1;
  IF v_campus IS NULL THEN
    SELECT id INTO v_campus FROM public.campuses WHERE domain = v_domain LIMIT 1;
  END IF;

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
    v_is_edu,
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