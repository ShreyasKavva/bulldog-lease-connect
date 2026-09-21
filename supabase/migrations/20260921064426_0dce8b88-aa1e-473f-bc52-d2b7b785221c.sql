ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_content_not_blank;
ALTER TABLE public.messages ADD CONSTRAINT messages_content_not_blank
  CHECK (content ~ '\S' OR attachment_url IS NOT NULL);