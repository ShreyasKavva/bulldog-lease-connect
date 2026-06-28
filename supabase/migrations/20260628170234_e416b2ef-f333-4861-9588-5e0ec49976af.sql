
-- Notification preferences on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT
    '{"new_message":true,"listing_match":true,"price_drop":true,"listing_saved":true,"view_milestone":false,"new_review":true,"looking_for_interest":true,"lease_expiring":true}'::jsonb;

-- Performance index for unread counts
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC) WHERE read = false;

-- Helper: pref check (defaults true if missing)
CREATE OR REPLACE FUNCTION public.notif_pref_enabled(_uid uuid, _key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT (notification_preferences ->> _key)::boolean FROM public.profiles WHERE id = _uid),
    true
  );
$$;

-- Patch existing message notification to respect preferences and use 'new_message' type
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sender_name TEXT;
BEGIN
  IF NOT public.notif_pref_enabled(NEW.recipient_id, 'new_message') THEN RETURN NEW; END IF;
  SELECT COALESCE(name, split_part(email, '@', 1))
    INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, type, title, body, link, data)
  VALUES (
    NEW.recipient_id,
    'new_message',
    COALESCE(v_sender_name, 'Someone') || ' sent you a message',
    LEFT(NEW.content, 140),
    '/?conversation=' || NEW.conversation_id::text,
    jsonb_build_object('conversation_id', NEW.conversation_id, 'sender_id', NEW.sender_id)
  );
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_on_price_drop()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.price < OLD.price THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, data)
    SELECT s.user_id, 'price_drop',
      'Price drop on a saved listing',
      NEW.title || ' dropped from $' || OLD.price || ' to $' || NEW.price,
      '/?listing=' || NEW.id::text,
      jsonb_build_object('listing_id', NEW.id, 'old_price', OLD.price, 'new_price', NEW.price)
    FROM public.saved_listings s
    WHERE s.listing_id = NEW.id
      AND s.user_id <> NEW.user_id
      AND public.notif_pref_enabled(s.user_id, 'price_drop');
  END IF;
  RETURN NEW;
END; $$;

-- Listing saved trigger (notify the poster)
CREATE OR REPLACE FUNCTION public.notify_on_listing_saved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_listing RECORD;
BEGIN
  SELECT id, user_id, title INTO v_listing FROM public.listings WHERE id = NEW.listing_id;
  IF v_listing.user_id IS NULL OR v_listing.user_id = NEW.user_id THEN RETURN NEW; END IF;
  IF NOT public.notif_pref_enabled(v_listing.user_id, 'listing_saved') THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link, data)
  VALUES (
    v_listing.user_id,
    'listing_saved',
    'Someone saved your listing',
    v_listing.title,
    '/?listing=' || v_listing.id::text,
    jsonb_build_object('listing_id', v_listing.id)
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_listing_saved_notify ON public.saved_listings;
CREATE TRIGGER on_listing_saved_notify
AFTER INSERT ON public.saved_listings
FOR EACH ROW EXECUTE FUNCTION public.notify_on_listing_saved();

-- View milestone: extend increment fn
CREATE OR REPLACE FUNCTION public.increment_listing_view(_listing_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER; v_listing RECORD;
BEGIN
  UPDATE public.listings SET view_count = view_count + 1 WHERE id = _listing_id RETURNING view_count INTO v_count;
  IF v_count IN (50, 100, 250, 500, 1000) THEN
    SELECT user_id, title INTO v_listing FROM public.listings WHERE id = _listing_id;
    IF v_listing.user_id IS NOT NULL AND public.notif_pref_enabled(v_listing.user_id, 'view_milestone') THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, data)
      VALUES (
        v_listing.user_id,
        'listing_viewed_milestone',
        'Your listing hit ' || v_count || ' views! 🎉',
        v_listing.title || ' is getting attention.',
        '/?listing=' || _listing_id::text,
        jsonb_build_object('listing_id', _listing_id, 'views', v_count)
      );
    END IF;
  END IF;
  RETURN COALESCE(v_count, 0);
END; $$;
