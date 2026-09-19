-- 1. verified_email is system/admin managed
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN RAISE EXCEPTION 'Not authorized to change is_admin'; END IF;
  IF NEW.banned IS DISTINCT FROM OLD.banned THEN RAISE EXCEPTION 'Not authorized to change banned'; END IF;
  IF NEW.verified_email IS DISTINCT FROM OLD.verified_email THEN RAISE EXCEPTION 'Not authorized to change verified_email'; END IF;
  IF NEW.is_ambassador IS DISTINCT FROM OLD.is_ambassador THEN RAISE EXCEPTION 'Not authorized to change is_ambassador'; END IF;
  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN RAISE EXCEPTION 'Referral code cannot be changed'; END IF;
  IF NEW.referral_count IS DISTINCT FROM OLD.referral_count THEN RAISE EXCEPTION 'Referral count is system managed'; END IF;
  IF NEW.referred_by IS DISTINCT FROM OLD.referred_by THEN RAISE EXCEPTION 'Referred_by is system managed'; END IF;
  RETURN NEW;
END;
$$;

-- 2. listing sanity validation
CREATE OR REPLACE FUNCTION public.validate_listing()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_listing() FROM anon, authenticated, public;
DROP TRIGGER IF EXISTS trg_validate_listing ON public.listings;
CREATE TRIGGER trg_validate_listing BEFORE INSERT OR UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.validate_listing();

-- 3. system-managed counters: remove direct client write access
REVOKE UPDATE ON public.listings FROM authenticated, anon;
GRANT UPDATE (user_id, campus_id, title, description, type, price, beds, baths, area, address,
  lat, lng, furnished, utilities_included, pet_friendly, parking, available_from, available_to,
  semester, amenities, photos, is_active, updated_at, flagged, status, filled_at,
  filled_with_user_id, filled_via_lease_up, deposit_amount, deposit_escrow_enabled,
  pending_review, pending_review_since, bumped_at, sort_at, wifi_included, laundry,
  roommate_prefs, display_name) ON public.listings TO authenticated;

REVOKE UPDATE ON public.looking_for_posts FROM authenticated, anon;
GRANT UPDATE (campus_id, title, description, budget_max, move_in_date, move_out_date, beds_min,
  area, furnished, pets_ok, updated_at, is_active, num_people, display_name)
  ON public.looking_for_posts TO authenticated;

-- 4. messages must have content
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_not_blank CHECK (btrim(content) <> '') NOT VALID;

-- 5. reviews require a real interaction
CREATE OR REPLACE FUNCTION public.has_interacted(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE (c.participant_1_id = _a AND c.participant_2_id = _b)
       OR (c.participant_1_id = _b AND c.participant_2_id = _a)
  ) OR EXISTS (
    SELECT 1 FROM public.tour_bookings t
    WHERE (t.poster_id = _a AND t.subletter_id = _b)
       OR (t.poster_id = _b AND t.subletter_id = _a)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.has_interacted(uuid, uuid) FROM anon;

DROP POLICY IF EXISTS "Users write own reviews" ON public.reviews;
CREATE POLICY "Users write own reviews" ON public.reviews FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = reviewer_id
  AND reviewer_id <> reviewed_user_id
  AND public.has_interacted(reviewer_id, reviewed_user_id)
);

-- 6. tour availability only for listings you own
DROP POLICY IF EXISTS "Poster manages own availability" ON public.tour_availability;
CREATE POLICY "Poster manages own availability" ON public.tour_availability FOR ALL TO authenticated
USING (auth.uid() = poster_id)
WITH CHECK (
  auth.uid() = poster_id
  AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.user_id = auth.uid())
);

-- 7. closed roommate posts hidden from the public
DROP POLICY IF EXISTS lf_select_all ON public.looking_for_posts;
CREATE POLICY lf_select_all ON public.looking_for_posts FOR SELECT TO anon, authenticated
USING (is_active = true OR auth.uid() = user_id OR public.is_admin(auth.uid()));

-- 8. upvote returns the real total on a repeat click
CREATE OR REPLACE FUNCTION public.upvote_looking_for_post(_post_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _rows integer;
  _new integer;
BEGIN
  IF _uid IS NULL THEN
    RETURN COALESCE((SELECT upvotes FROM public.looking_for_posts WHERE id = _post_id), 0);
  END IF;

  INSERT INTO public.looking_for_upvotes (post_id, user_id)
  VALUES (_post_id, _uid)
  ON CONFLICT (post_id, user_id) DO NOTHING;
  GET DIAGNOSTICS _rows = ROW_COUNT;

  IF _rows > 0 THEN
    UPDATE public.looking_for_posts
       SET upvotes = COALESCE(upvotes, 0) + 1
     WHERE id = _post_id AND is_active = true
    RETURNING upvotes INTO _new;
  END IF;

  RETURN COALESCE(_new, (SELECT upvotes FROM public.looking_for_posts WHERE id = _post_id), 0);
END;
$$;