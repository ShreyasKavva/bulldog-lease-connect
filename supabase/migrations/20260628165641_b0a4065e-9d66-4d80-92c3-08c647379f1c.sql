
-- Messages: read_at, content_type, attachment_url, attachment_name, attachment_size
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_size integer;

DO $$ BEGIN
  ALTER TABLE public.messages
    ADD CONSTRAINT messages_content_type_chk CHECK (content_type IN ('text','image','document'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill read_at from existing `read` boolean for already-read messages
UPDATE public.messages SET read_at = COALESCE(read_at, created_at) WHERE read = true AND read_at IS NULL;

CREATE INDEX IF NOT EXISTS messages_recipient_unread_idx ON public.messages(recipient_id) WHERE read_at IS NULL;

-- Conversations: pin / mute / soft-delete per participant
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS pinned_by_p1 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_by_p2 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS muted_by_p1 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS muted_by_p2 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_by_p1 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_by_p2 boolean NOT NULL DEFAULT false;

-- Message reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Helper: is the user a participant in the conversation that owns this message?
CREATE OR REPLACE FUNCTION public.user_in_message_convo(_user uuid, _message uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.id = _message
      AND (c.participant_1_id = _user OR c.participant_2_id = _user)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.user_in_message_convo(uuid,uuid) FROM PUBLIC, anon, authenticated;

CREATE POLICY "reactions_select_participant" ON public.message_reactions
  FOR SELECT TO authenticated
  USING (public.user_in_message_convo(auth.uid(), message_id));

CREATE POLICY "reactions_insert_self" ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.user_in_message_convo(auth.uid(), message_id));

CREATE POLICY "reactions_delete_self" ON public.message_reactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
