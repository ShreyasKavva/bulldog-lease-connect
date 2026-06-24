
-- Add URL slug to campuses for public landing pages
ALTER TABLE public.campuses ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE public.campuses SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;
UPDATE public.campuses SET slug = regexp_replace(slug, '(^-|-$)', '', 'g');

ALTER TABLE public.campuses ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS campuses_slug_idx ON public.campuses(slug);

-- Helper for unread count
CREATE OR REPLACE FUNCTION public.unread_message_count(_user uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.messages
  WHERE recipient_id = _user AND read = false;
$$;
GRANT EXECUTE ON FUNCTION public.unread_message_count(uuid) TO authenticated;
