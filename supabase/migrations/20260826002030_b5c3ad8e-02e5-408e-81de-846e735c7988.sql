ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS looking_post_id uuid REFERENCES public.looking_for_posts(id) ON DELETE SET NULL;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_participant_1_id_participant_2_id_listing_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_participants_context_key
  ON public.conversations (participant_1_id, participant_2_id, listing_id, looking_post_id)
  NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS conversations_looking_post_id_idx
  ON public.conversations (looking_post_id);