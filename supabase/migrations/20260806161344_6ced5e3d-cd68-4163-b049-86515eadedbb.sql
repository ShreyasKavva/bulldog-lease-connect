ALTER TABLE public.looking_for_posts
  ADD COLUMN IF NOT EXISTS num_people integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.get_host_stats(host_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int := 0;
  v_replied int := 0;
  v_hours numeric;
  v_active int := 0;
  v_reviews int := 0;
BEGIN
  WITH convs AS (
    SELECT c.id,
           (SELECT MIN(m.created_at) FROM public.messages m
             WHERE m.conversation_id = c.id AND m.sender_id <> host_id) AS first_in,
           (SELECT MIN(m.created_at) FROM public.messages m
             WHERE m.conversation_id = c.id AND m.sender_id = host_id) AS first_out
    FROM public.conversations c
    JOIN public.listings l ON l.id = c.listing_id
    WHERE l.user_id = host_id
  )
  SELECT COUNT(*) FILTER (WHERE first_in IS NOT NULL),
         COUNT(*) FILTER (WHERE first_in IS NOT NULL AND first_out IS NOT NULL AND first_out > first_in)
    INTO v_total, v_replied
  FROM convs;

  SELECT AVG(EXTRACT(epoch FROM (first_out - first_in)) / 3600.0)
    INTO v_hours
  FROM (
    SELECT (SELECT MIN(m.created_at) FROM public.messages m
              WHERE m.conversation_id = c.id AND m.sender_id <> host_id) AS first_in,
           (SELECT MIN(m.created_at) FROM public.messages m
              WHERE m.conversation_id = c.id AND m.sender_id = host_id) AS first_out
    FROM public.conversations c
    JOIN public.listings l ON l.id = c.listing_id
    WHERE l.user_id = host_id
    ORDER BY c.last_message_at DESC NULLS LAST
    LIMIT 10
  ) recent
  WHERE first_in IS NOT NULL AND first_out IS NOT NULL AND first_out > first_in;

  SELECT COUNT(*) INTO v_active
    FROM public.listings
    WHERE user_id = host_id AND is_active = true AND COALESCE(status,'active') = 'active';

  SELECT COUNT(*) INTO v_reviews
    FROM public.reviews
    WHERE reviewed_user_id = host_id AND is_removed = false;

  RETURN jsonb_build_object(
    'response_rate', CASE WHEN v_total >= 3 THEN ROUND((v_replied::numeric / v_total) * 100)::int ELSE NULL END,
    'conversation_count', v_total,
    'avg_response_hours', CASE WHEN v_hours IS NULL THEN NULL ELSE ROUND(v_hours)::int END,
    'active_listing_count', v_active,
    'total_review_count', v_reviews
  );
END $$;

REVOKE ALL ON FUNCTION public.get_host_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_host_stats(uuid) TO anon, authenticated, service_role;