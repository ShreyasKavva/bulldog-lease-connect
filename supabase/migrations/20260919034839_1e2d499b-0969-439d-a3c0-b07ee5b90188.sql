-- 1. Ban enforcement -------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_banned(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT banned FROM public.profiles WHERE id = _uid), false);
$function$;

REVOKE EXECUTE ON FUNCTION public.is_banned(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_banned(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS listings_owner_insert ON public.listings;
CREATE POLICY listings_owner_insert ON public.listings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_banned(auth.uid()));

DROP POLICY IF EXISTS lf_insert_own ON public.looking_for_posts;
CREATE POLICY lf_insert_own ON public.looking_for_posts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_banned(auth.uid()));

DROP POLICY IF EXISTS msg_sender_insert ON public.messages;
CREATE POLICY msg_sender_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND NOT public.is_banned(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (auth.uid() = c.participant_1_id OR auth.uid() = c.participant_2_id)
        AND (messages.recipient_id = c.participant_1_id OR messages.recipient_id = c.participant_2_id)
        AND messages.recipient_id <> auth.uid()
    )
  );

-- 2. One upvote per student per post ---------------------------------
CREATE TABLE IF NOT EXISTS public.looking_for_upvotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.looking_for_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

GRANT SELECT ON public.looking_for_upvotes TO authenticated;
GRANT ALL ON public.looking_for_upvotes TO service_role;
ALTER TABLE public.looking_for_upvotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lfu_select_own ON public.looking_for_upvotes;
CREATE POLICY lfu_select_own ON public.looking_for_upvotes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.upvote_looking_for_post(_post_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _new integer;
  _inserted boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RETURN COALESCE((SELECT upvotes FROM public.looking_for_posts WHERE id = _post_id), 0);
  END IF;

  INSERT INTO public.looking_for_upvotes (post_id, user_id)
  VALUES (_post_id, _uid)
  ON CONFLICT (post_id, user_id) DO NOTHING;

  GET DIAGNOSTICS _new = ROW_COUNT;
  _inserted := _new > 0;

  IF _inserted THEN
    UPDATE public.looking_for_posts
       SET upvotes = COALESCE(upvotes, 0) + 1
     WHERE id = _post_id AND is_active = true
    RETURNING upvotes INTO _new;
  END IF;

  RETURN COALESCE(_new, (SELECT upvotes FROM public.looking_for_posts WHERE id = _post_id), 0);
END;
$function$;