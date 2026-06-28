
-- 1. Reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewed_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  stars integer NOT NULL CHECK (stars >= 1 AND stars <= 5),
  content text,
  reviewer_role text CHECK (reviewer_role IN ('subletter', 'poster')),
  is_removed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reviewer_id, reviewed_user_id, listing_id),
  CHECK (reviewer_id <> reviewed_user_id)
);

GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read non-removed reviews" ON public.reviews
  FOR SELECT USING (is_removed = false OR public.is_admin(auth.uid()));

-- Eligibility-gated insert: reviewer must have a conversation with reviewed_user
CREATE POLICY "Users write own reviews when eligible" ON public.reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id
    AND reviewer_id <> reviewed_user_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE (c.participant_1_id = auth.uid() AND c.participant_2_id = reviewed_user_id)
         OR (c.participant_2_id = auth.uid() AND c.participant_1_id = reviewed_user_id)
    )
  );

CREATE POLICY "Users delete own reviews" ON public.reviews
  FOR DELETE USING (auth.uid() = reviewer_id);

CREATE POLICY "Admins update reviews (moderation)" ON public.reviews
  FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS reviews_reviewed_user_idx ON public.reviews(reviewed_user_id, created_at DESC) WHERE is_removed = false;
CREATE INDEX IF NOT EXISTS reviews_listing_idx ON public.reviews(listing_id);

-- 2. Add listing status fields (for "marked as filled")
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'filled', 'inactive')),
  ADD COLUMN IF NOT EXISTS filled_at timestamptz,
  ADD COLUMN IF NOT EXISTS filled_with_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS filled_via_lease_up boolean NOT NULL DEFAULT false;

-- 3. Update compute_listing_safe_score to incorporate reviews
CREATE OR REPLACE FUNCTION public.compute_listing_safe_score(_listing_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_score INTEGER := 0;
  v_listing RECORD;
  v_profile RECORD;
  v_photo_count INTEGER;
  v_avg numeric;
  v_count integer;
  v_bonus numeric := 0;
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

  -- Reviews contribution (scored on 100-pt scale: ×10 from spec which is 0-10)
  SELECT AVG(stars)::numeric, COUNT(*) INTO v_avg, v_count
  FROM public.reviews
  WHERE reviewed_user_id = v_listing.user_id AND is_removed = false;

  IF v_count > 0 THEN
    IF v_avg >= 4.5 THEN v_bonus := v_bonus + 2.0;
    ELSIF v_avg >= 3.5 THEN v_bonus := v_bonus + 1.0;
    END IF;
    IF v_count >= 10 THEN v_bonus := v_bonus + 1.0;
    ELSIF v_count >= 3 THEN v_bonus := v_bonus + 0.5;
    END IF;
  END IF;

  v_score := v_score + (v_bonus * 10)::integer;

  RETURN LEAST(v_score, 100);
END;
$function$;

-- 4. Trigger to refresh safe_score on review insert/delete/update
CREATE OR REPLACE FUNCTION public.refresh_safe_score_on_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid;
BEGIN
  v_user := COALESCE(NEW.reviewed_user_id, OLD.reviewed_user_id);
  UPDATE public.listings SET safe_score = public.compute_listing_safe_score(id) WHERE user_id = v_user;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS refresh_safe_score_on_review_trg ON public.reviews;
CREATE TRIGGER refresh_safe_score_on_review_trg
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.refresh_safe_score_on_review();

-- 5. Notification trigger: prompt last messenger to review when listing marked as filled
CREATE OR REPLACE FUNCTION public.notify_review_on_listing_filled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_last_messenger uuid;
  v_poster_name text;
BEGIN
  IF NEW.status = 'filled' AND COALESCE(OLD.status, 'active') <> 'filled' THEN
    NEW.filled_at := COALESCE(NEW.filled_at, now());

    SELECT COALESCE(name, split_part(email, '@', 1)) INTO v_poster_name
      FROM public.profiles WHERE id = NEW.user_id;

    -- Find the other participant in the most recent conversation about this listing
    SELECT CASE WHEN c.participant_1_id = NEW.user_id THEN c.participant_2_id ELSE c.participant_1_id END
      INTO v_last_messenger
    FROM public.conversations c
    WHERE c.listing_id = NEW.id
      AND (c.participant_1_id = NEW.user_id OR c.participant_2_id = NEW.user_id)
    ORDER BY c.last_message_at DESC NULLS LAST
    LIMIT 1;

    IF v_last_messenger IS NOT NULL AND v_last_messenger <> NEW.user_id THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, data)
      VALUES (
        v_last_messenger,
        'review_prompt',
        'Did you end up taking ' || NEW.title || '?',
        'Leave ' || COALESCE(v_poster_name, 'them') || ' a review →',
        '/profile/' || NEW.user_id::text || '?review=1&listing=' || NEW.id::text,
        jsonb_build_object('listing_id', NEW.id, 'reviewed_user_id', NEW.user_id, 'role', 'subletter')
      );

      -- Also store who the listing was filled with (if not already set)
      NEW.filled_with_user_id := COALESCE(NEW.filled_with_user_id, v_last_messenger);
      NEW.filled_via_lease_up := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_review_on_listing_filled_trg ON public.listings;
CREATE TRIGGER notify_review_on_listing_filled_trg
BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.notify_review_on_listing_filled();

-- 6. Scheduled job function: post-move-in review prompt for poster (run daily)
CREATE OR REPLACE FUNCTION public.process_review_prompts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r RECORD;
BEGIN
  -- Trigger 2: 7 days after available_from for filled listings -> prompt poster
  FOR r IN
    SELECT l.id AS listing_id, l.user_id AS poster_id, l.title,
           (SELECT CASE WHEN c.participant_1_id = l.user_id THEN c.participant_2_id ELSE c.participant_1_id END
              FROM public.conversations c
              WHERE c.listing_id = l.id
                AND (c.participant_1_id = l.user_id OR c.participant_2_id = l.user_id)
              ORDER BY c.last_message_at DESC NULLS LAST LIMIT 1) AS other_user_id
    FROM public.listings l
    WHERE l.status = 'filled'
      AND l.available_from IS NOT NULL
      AND l.available_from <= (current_date - INTERVAL '7 days')
      AND l.available_from >= (current_date - INTERVAL '8 days')
  LOOP
    IF r.other_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, data)
      SELECT r.poster_id, 'review_prompt',
             'How did the sublease go?',
             'Leave ' || COALESCE(p.name, split_part(p.email,'@',1)) || ' a review →',
             '/profile/' || r.other_user_id::text || '?review=1&listing=' || r.listing_id::text,
             jsonb_build_object('listing_id', r.listing_id, 'reviewed_user_id', r.other_user_id, 'role', 'poster')
      FROM public.profiles p WHERE p.id = r.other_user_id
      AND NOT EXISTS (
        SELECT 1 FROM public.reviews rv
        WHERE rv.reviewer_id = r.poster_id
          AND rv.reviewed_user_id = r.other_user_id
          AND rv.listing_id = r.listing_id
      );
    END IF;
  END LOOP;
END;
$$;
