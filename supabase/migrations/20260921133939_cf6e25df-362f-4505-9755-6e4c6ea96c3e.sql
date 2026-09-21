CREATE OR REPLACE FUNCTION public.sync_conversation_preview()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
     SET last_message = NEW.content,
         last_message_at = NEW.created_at
   WHERE id = NEW.conversation_id
     AND (last_message_at IS NULL OR last_message_at <= NEW.created_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_conversation_preview ON public.messages;
CREATE TRIGGER trg_sync_conversation_preview
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.sync_conversation_preview();

UPDATE public.conversations c
   SET last_message = m.content,
       last_message_at = m.created_at
  FROM (
    SELECT DISTINCT ON (conversation_id) conversation_id, content, created_at
      FROM public.messages
     ORDER BY conversation_id, created_at DESC
  ) m
 WHERE m.conversation_id = c.id
   AND (c.last_message IS NULL OR c.last_message_at IS NULL);