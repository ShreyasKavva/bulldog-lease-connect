CREATE OR REPLACE FUNCTION public.validate_listing()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  privileged boolean;
BEGIN
  IF NEW.price IS NULL OR NEW.price <= 0 THEN
    RAISE EXCEPTION 'Price must be greater than zero';
  END IF;
  IF NEW.price > 100000 THEN
    RAISE EXCEPTION 'Price is unrealistically high';
  END IF;
  IF NEW.available_from IS NOT NULL AND NEW.available_to IS NOT NULL
     AND NEW.available_to < NEW.available_from THEN
    RAISE EXCEPTION 'End date cannot be before start date';
  END IF;
  IF NEW.title IS NULL OR regexp_replace(NEW.title, '\s', '', 'g') = '' THEN
    RAISE EXCEPTION 'Title cannot be empty';
  END IF;
  IF NEW.description IS NULL OR regexp_replace(NEW.description, '\s', '', 'g') = '' THEN
    RAISE EXCEPTION 'Description cannot be empty';
  END IF;
  IF NEW.beds IS NULL OR NEW.beds < 0 OR NEW.beds > 20 THEN
    RAISE EXCEPTION 'Bedrooms must be between 0 and 20';
  END IF;
  IF NEW.baths IS NULL OR NEW.baths < 0 OR NEW.baths > 20 THEN
    RAISE EXCEPTION 'Bathrooms must be between 0 and 20';
  END IF;

  IF TG_OP = 'INSERT' THEN
    privileged := (auth.uid() IS NULL) OR public.is_admin(auth.uid());
    IF NOT privileged THEN
      NEW.is_featured := false;
      NEW.featured_until := NULL;
      NEW.featured_purchased_at := NULL;
      NEW.view_count := 0;
      NEW.views := 0;
      NEW.saves_count := 0;
      NEW.share_count := 0;
      NEW.safe_score := NULL;
      NEW.verification_tier := 'unverified';
      NEW.flagged := false;
      NEW.auto_flagged_at := NULL;
      NEW.filled_at := NULL;
      NEW.filled_with_user_id := NULL;
      NEW.filled_via_lease_via := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;