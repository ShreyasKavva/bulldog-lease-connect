ALTER TABLE public.looking_for_posts ADD COLUMN IF NOT EXISTS upvotes integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.upvote_looking_for_post(_post_id uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new integer;
BEGIN
  UPDATE public.looking_for_posts
     SET upvotes = COALESCE(upvotes, 0) + 1
   WHERE id = _post_id AND is_active = true
  RETURNING upvotes INTO _new;
  RETURN COALESCE(_new, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upvote_looking_for_post(uuid) TO anon, authenticated;