CREATE OR REPLACE FUNCTION public.campus_for_email_domain(_domain text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  d text := lower(btrim(_domain));
  v uuid;
BEGIN
  IF d IS NULL OR d = '' THEN RETURN NULL; END IF;
  WHILE d LIKE '%.%.%' OR d LIKE '%.%' LOOP
    SELECT campus_id INTO v FROM public.campus_email_domains WHERE domain = d LIMIT 1;
    IF v IS NOT NULL THEN RETURN v; END IF;
    SELECT id INTO v FROM public.campuses WHERE domain = d LIMIT 1;
    IF v IS NOT NULL THEN RETURN v; END IF;
    EXIT WHEN position('.' in d) = 0;
    d := substring(d from position('.' in d) + 1);
    EXIT WHEN position('.' in d) = 0;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.campus_for_email_domain(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.campus_for_email_domain(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_domain text;
  v_campus uuid;
  v_ref_code text;
  v_referrer uuid;
  v_is_edu boolean;
BEGIN
  v_domain := lower(split_part(NEW.email, '@', 2));
  v_is_edu := v_domain LIKE '%.edu';

  v_campus := public.campus_for_email_domain(v_domain);

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
$function$;