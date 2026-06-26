
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'Not authorized to change is_admin';
  END IF;
  IF NEW.banned IS DISTINCT FROM OLD.banned THEN
    RAISE EXCEPTION 'Not authorized to change banned';
  END IF;
  IF NEW.is_ambassador IS DISTINCT FROM OLD.is_ambassador THEN
    RAISE EXCEPTION 'Not authorized to change is_ambassador';
  END IF;
  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    RAISE EXCEPTION 'Referral code cannot be changed';
  END IF;
  IF NEW.referral_count IS DISTINCT FROM OLD.referral_count THEN
    RAISE EXCEPTION 'Referral count is system managed';
  END IF;
  IF NEW.referred_by IS DISTINCT FROM OLD.referred_by THEN
    RAISE EXCEPTION 'Referred_by is system managed';
  END IF;
  RETURN NEW;
END;
$$;
