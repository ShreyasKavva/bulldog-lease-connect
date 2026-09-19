CREATE OR REPLACE FUNCTION public.notify_saved_search_matches()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    INSERT INTO public.notifications (user_id, type, title, body, link, data)
    VALUES (
      s.user_id, 'saved_search_match',
      'New match for "' || s.name || '"',
      NEW.title || ' · $' || NEW.price::text || '/mo' || COALESCE(' · ' || NEW.area, ''),
      '/listing/' || NEW.id::text,
      jsonb_build_object('listing_id', NEW.id, 'saved_search_id', s.id)
    );
    UPDATE public.saved_searches SET last_notified_at = now() WHERE id = s.id;
  END LOOP;
  RETURN NEW;
END; $function$;