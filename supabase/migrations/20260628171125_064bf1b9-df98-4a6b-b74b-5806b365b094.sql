
-- ============ roommate_profiles ============
CREATE TABLE public.roommate_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  campus_id uuid REFERENCES public.campuses(id) ON DELETE SET NULL,
  budget_min integer,
  budget_max integer,
  move_in_date date,
  lease_length text CHECK (lease_length IN ('semester','academic_year','full_year','flexible')),
  beds_wanted integer,
  areas_preferred text[] NOT NULL DEFAULT '{}',
  lifestyle_early_bird boolean NOT NULL DEFAULT false,
  lifestyle_night_owl boolean NOT NULL DEFAULT false,
  lifestyle_studious boolean NOT NULL DEFAULT false,
  lifestyle_social boolean NOT NULL DEFAULT false,
  lifestyle_clean integer CHECK (lifestyle_clean BETWEEN 1 AND 5),
  lifestyle_quiet integer CHECK (lifestyle_quiet BETWEEN 1 AND 5),
  has_pets boolean NOT NULL DEFAULT false,
  pet_friendly boolean NOT NULL DEFAULT false,
  smokes boolean NOT NULL DEFAULT false,
  smoker_ok boolean NOT NULL DEFAULT false,
  gender_preference text NOT NULL DEFAULT 'no_preference'
    CHECK (gender_preference IN ('no_preference','same_gender','any')),
  about_me text,
  vibe_tags text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roommate_profiles TO authenticated;
GRANT ALL ON public.roommate_profiles TO service_role;

ALTER TABLE public.roommate_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roommate_profiles_read_active" ON public.roommate_profiles
  FOR SELECT TO authenticated USING (is_active = true OR auth.uid() = user_id);

CREATE POLICY "roommate_profiles_insert_own" ON public.roommate_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "roommate_profiles_update_own" ON public.roommate_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "roommate_profiles_delete_own" ON public.roommate_profiles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_roommate_profiles_campus_active
  ON public.roommate_profiles (campus_id) WHERE is_active = true;

CREATE TRIGGER trg_roommate_profiles_updated_at
  BEFORE UPDATE ON public.roommate_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ roommate_interests ============
CREATE TABLE public.roommate_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_user_id, to_user_id),
  CHECK (from_user_id <> to_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roommate_interests TO authenticated;
GRANT ALL ON public.roommate_interests TO service_role;

ALTER TABLE public.roommate_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roommate_interests_read_own" ON public.roommate_interests
  FOR SELECT TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "roommate_interests_insert_own" ON public.roommate_interests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "roommate_interests_update_participant" ON public.roommate_interests
  FOR UPDATE TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "roommate_interests_delete_own" ON public.roommate_interests
  FOR DELETE TO authenticated USING (auth.uid() = from_user_id);

-- ============ Trigger: notify on interest, auto-match on mutual ============
CREATE OR REPLACE FUNCTION public.handle_roommate_interest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reverse RECORD;
  v_from_name text;
  v_to_name text;
  v_conv_id uuid;
  v_a uuid;
  v_b uuid;
BEGIN
  SELECT COALESCE(name, split_part(email,'@',1)) INTO v_from_name FROM public.profiles WHERE id = NEW.from_user_id;
  SELECT COALESCE(name, split_part(email,'@',1)) INTO v_to_name   FROM public.profiles WHERE id = NEW.to_user_id;

  -- Look for the reciprocal pending row
  SELECT * INTO v_reverse FROM public.roommate_interests
    WHERE from_user_id = NEW.to_user_id AND to_user_id = NEW.from_user_id;

  IF FOUND AND v_reverse.status <> 'declined' THEN
    -- Mutual match: accept both
    UPDATE public.roommate_interests SET status='accepted' WHERE id = v_reverse.id;
    NEW.status := 'accepted';

    -- Deterministic participant order to match the unique constraint
    IF NEW.from_user_id < NEW.to_user_id THEN v_a := NEW.from_user_id; v_b := NEW.to_user_id;
    ELSE v_a := NEW.to_user_id;   v_b := NEW.from_user_id; END IF;

    -- Find or create a roommate (listing_id NULL) conversation
    SELECT id INTO v_conv_id FROM public.conversations
      WHERE participant_1_id = v_a AND participant_2_id = v_b AND listing_id IS NULL
      LIMIT 1;

    IF v_conv_id IS NULL THEN
      INSERT INTO public.conversations (participant_1_id, participant_2_id, listing_id, last_message, last_message_at)
      VALUES (v_a, v_b, NULL,
              'You matched as potential roommates on LeaseUp. Say hi! 👋', now())
      RETURNING id INTO v_conv_id;

      INSERT INTO public.messages (conversation_id, sender_id, recipient_id, content, content_type, read_at)
      VALUES (v_conv_id, NEW.from_user_id, NEW.to_user_id,
              'You and ' || v_to_name || ' matched as potential roommates on LeaseUp. Say hi! 👋',
              'text', now());
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, link, data) VALUES
      (NEW.from_user_id, 'roommate_match',
       '🎉 You and ' || v_to_name || ' matched!',
       'Start chatting →', '/?conversation=' || v_conv_id::text,
       jsonb_build_object('conversation_id', v_conv_id, 'other_user_id', NEW.to_user_id)),
      (NEW.to_user_id, 'roommate_match',
       '🎉 You and ' || v_from_name || ' matched!',
       'Start chatting →', '/?conversation=' || v_conv_id::text,
       jsonb_build_object('conversation_id', v_conv_id, 'other_user_id', NEW.from_user_id));
  ELSE
    -- One-way request: notify recipient
    INSERT INTO public.notifications (user_id, type, title, body, link, data)
    VALUES (
      NEW.to_user_id,
      'roommate_interest',
      v_from_name || ' wants to be your roommate',
      COALESCE(LEFT(NEW.note, 140), 'View their profile and reply →'),
      '/roommates?from=' || NEW.from_user_id::text,
      jsonb_build_object('from_user_id', NEW.from_user_id, 'interest_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_roommate_interest_after
  BEFORE INSERT ON public.roommate_interests
  FOR EACH ROW EXECUTE FUNCTION public.handle_roommate_interest();
