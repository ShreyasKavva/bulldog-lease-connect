-- Tour scheduling tables
CREATE TABLE IF NOT EXISTS public.tour_availability (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  poster_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  available_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_duration_minutes integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tour_availability TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tour_availability TO authenticated;
GRANT ALL ON public.tour_availability TO service_role;

ALTER TABLE public.tour_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active availability" ON public.tour_availability FOR SELECT USING (is_active = true);
CREATE POLICY "Poster manages own availability" ON public.tour_availability FOR ALL USING (auth.uid() = poster_id) WITH CHECK (auth.uid() = poster_id);

CREATE INDEX IF NOT EXISTS idx_tour_availability_listing ON public.tour_availability(listing_id, available_date);

CREATE TABLE IF NOT EXISTS public.tour_bookings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  availability_id uuid REFERENCES public.tour_availability(id) ON DELETE SET NULL,
  poster_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subletter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled_poster','cancelled_subletter','completed','no_show')),
  message text,
  poster_survey text CHECK (poster_survey IN ('yes','no_show','filled')),
  subletter_survey text CHECK (subletter_survey IN ('went_well','didnt_work')),
  survey_prompted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tour_bookings TO authenticated;
GRANT ALL ON public.tour_bookings TO service_role;

ALTER TABLE public.tour_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties read own bookings" ON public.tour_bookings FOR SELECT USING (auth.uid() = poster_id OR auth.uid() = subletter_id);
CREATE POLICY "Subletters create bookings" ON public.tour_bookings FOR INSERT WITH CHECK (auth.uid() = subletter_id);
CREATE POLICY "Parties update own bookings" ON public.tour_bookings FOR UPDATE USING (auth.uid() = poster_id OR auth.uid() = subletter_id);

CREATE INDEX IF NOT EXISTS idx_tour_bookings_listing ON public.tour_bookings(listing_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tour_bookings_poster ON public.tour_bookings(poster_id, status);
CREATE INDEX IF NOT EXISTS idx_tour_bookings_subletter ON public.tour_bookings(subletter_id, status);

-- Notify poster on new booking request
CREATE OR REPLACE FUNCTION public.notify_on_tour_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_listing RECORD;
  v_sub_name text;
  v_poster_name text;
BEGIN
  SELECT id, title FROM public.listings WHERE id = NEW.listing_id INTO v_listing;
  SELECT COALESCE(name, split_part(email,'@',1)) INTO v_sub_name FROM public.profiles WHERE id = NEW.subletter_id;
  SELECT COALESCE(name, split_part(email,'@',1)) INTO v_poster_name FROM public.profiles WHERE id = NEW.poster_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, data)
    VALUES (
      NEW.poster_id, 'tour_request',
      '📅 ' || COALESCE(v_sub_name,'Someone') || ' wants to tour your listing',
      v_listing.title || ' — ' || to_char(NEW.scheduled_date, 'Mon DD') || ' at ' || to_char(NEW.scheduled_time, 'HH12:MI AM'),
      '/tours',
      jsonb_build_object('booking_id', NEW.id, 'listing_id', NEW.listing_id)
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'confirmed' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, data)
      VALUES (
        NEW.subletter_id, 'tour_confirmed',
        '✅ Your tour is confirmed!',
        v_listing.title || ' on ' || to_char(NEW.scheduled_date, 'Mon DD') || ' at ' || to_char(NEW.scheduled_time, 'HH12:MI AM'),
        '/tours',
        jsonb_build_object('booking_id', NEW.id, 'listing_id', NEW.listing_id)
      );
    ELSIF NEW.status = 'cancelled_poster' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, data)
      VALUES (
        NEW.subletter_id, 'tour_cancelled',
        COALESCE(v_poster_name, 'The poster') || ' can''t make that time',
        'Check their other availability →',
        '/?listing=' || NEW.listing_id::text,
        jsonb_build_object('booking_id', NEW.id, 'listing_id', NEW.listing_id)
      );
    ELSIF NEW.status = 'cancelled_subletter' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, data)
      VALUES (
        NEW.poster_id, 'tour_cancelled',
        COALESCE(v_sub_name, 'A subletter') || ' cancelled their tour',
        v_listing.title || ' — ' || to_char(NEW.scheduled_date, 'Mon DD') || ' at ' || to_char(NEW.scheduled_time, 'HH12:MI AM'),
        '/tours',
        jsonb_build_object('booking_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_tour_booking_ins ON public.tour_bookings;
CREATE TRIGGER trg_notify_tour_booking_ins AFTER INSERT ON public.tour_bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_tour_booking();

DROP TRIGGER IF EXISTS trg_notify_tour_booking_upd ON public.tour_bookings;
CREATE TRIGGER trg_notify_tour_booking_upd AFTER UPDATE ON public.tour_bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_tour_booking();

-- Post-tour survey cron
CREATE OR REPLACE FUNCTION public.process_post_tour_surveys()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tb.*, l.title AS listing_title,
           ps.name AS poster_name, ss.name AS subletter_name
    FROM public.tour_bookings tb
    JOIN public.listings l ON l.id = tb.listing_id
    LEFT JOIN public.profiles ps ON ps.id = tb.poster_id
    LEFT JOIN public.profiles ss ON ss.id = tb.subletter_id
    WHERE tb.status = 'confirmed'
      AND tb.survey_prompted_at IS NULL
      AND (tb.scheduled_date + tb.scheduled_time + interval '24 hours') <= now()
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, data)
    VALUES (
      r.subletter_id, 'tour_followup_subletter',
      'How was your tour of ' || r.listing_title || '?',
      'Tap to let us know →',
      '/tours?survey=' || r.id::text,
      jsonb_build_object('booking_id', r.id, 'listing_id', r.listing_id)
    );
    INSERT INTO public.notifications (user_id, type, title, body, link, data)
    VALUES (
      r.poster_id, 'tour_followup_poster',
      'Did ' || COALESCE(r.subletter_name, 'they') || ' tour your place?',
      r.listing_title,
      '/tours?survey=' || r.id::text,
      jsonb_build_object('booking_id', r.id, 'listing_id', r.listing_id)
    );
    UPDATE public.tour_bookings SET survey_prompted_at = now() WHERE id = r.id;
  END LOOP;
END $$;

-- Schedule hourly
DO $$
BEGIN
  PERFORM cron.unschedule('post-tour-surveys');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'post-tour-surveys',
  '0 * * * *',
  $$ SELECT public.process_post_tour_surveys(); $$
);
