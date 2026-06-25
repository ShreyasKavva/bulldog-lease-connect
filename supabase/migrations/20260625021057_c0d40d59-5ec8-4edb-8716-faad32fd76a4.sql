
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications select"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own notifications update"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own notifications delete"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON public.notifications (user_id) WHERE read = false;

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger: new message -> notify recipient
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sender_name TEXT;
BEGIN
  SELECT COALESCE(name, split_part(email, '@', 1))
    INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, type, title, body, link, data)
  VALUES (
    NEW.recipient_id,
    'message',
    COALESCE(v_sender_name, 'Someone') || ' sent you a message',
    LEFT(NEW.content, 140),
    '/?conversation=' || NEW.conversation_id::text,
    jsonb_build_object('conversation_id', NEW.conversation_id, 'sender_id', NEW.sender_id)
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_on_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- Trigger: price drop on a listing -> notify users who saved it
CREATE OR REPLACE FUNCTION public.notify_on_price_drop()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.price < OLD.price THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, data)
    SELECT
      s.user_id,
      'price_drop',
      'Price drop on a saved listing',
      NEW.title || ' dropped from $' || OLD.price || ' to $' || NEW.price,
      '/?listing=' || NEW.id::text,
      jsonb_build_object('listing_id', NEW.id, 'old_price', OLD.price, 'new_price', NEW.price)
    FROM public.saved_listings s
    WHERE s.listing_id = NEW.id AND s.user_id <> NEW.user_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_on_price_drop
AFTER UPDATE OF price ON public.listings
FOR EACH ROW WHEN (NEW.price IS DISTINCT FROM OLD.price)
EXECUTE FUNCTION public.notify_on_price_drop();

-- Trigger: new listing -> notify matching Looking For authors
CREATE OR REPLACE FUNCTION public.notify_on_listing_match()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_active IS NOT TRUE THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link, data)
  SELECT
    lf.user_id,
    'looking_for_match',
    'New listing matches your search',
    NEW.title || ' — $' || NEW.price,
    '/?listing=' || NEW.id::text,
    jsonb_build_object('listing_id', NEW.id, 'looking_for_post_id', lf.id)
  FROM public.looking_for_posts lf
  WHERE lf.campus_id = NEW.campus_id
    AND lf.user_id <> NEW.user_id
    AND (lf.budget_max IS NULL OR NEW.price <= lf.budget_max)
    AND (lf.beds_min IS NULL OR NEW.beds >= lf.beds_min);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_on_listing_match
AFTER INSERT ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.notify_on_listing_match();
