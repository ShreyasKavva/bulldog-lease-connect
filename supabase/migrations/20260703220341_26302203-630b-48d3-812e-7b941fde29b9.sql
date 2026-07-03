
-- Add profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS instagram_handle text,
  ADD COLUMN IF NOT EXISTS response_rate integer;

-- Public profile RPC exposing safe columns only
CREATE OR REPLACE FUNCTION public.get_public_profile(_uid uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'year', p.year,
    'major', p.major,
    'bio', p.bio,
    'avatar_url', p.avatar_url,
    'avatar_emoji', p.avatar_emoji,
    'banner_color', p.banner_color,
    'vibe_tags', COALESCE(rp.vibe_tags, p.vibe_tags),
    'instagram_handle', p.instagram_handle,
    'verified_email', p.verified_email,
    'campus_id', p.campus_id,
    'campus_name', c.name,
    'created_at', p.created_at,
    'response_rate', p.response_rate,
    'avg_rating', (SELECT ROUND(AVG(stars)::numeric, 1) FROM public.reviews WHERE reviewed_user_id = p.id AND is_removed = false),
    'review_count', (SELECT COUNT(*) FROM public.reviews WHERE reviewed_user_id = p.id AND is_removed = false),
    'listing_count', (SELECT COUNT(*) FROM public.listings WHERE user_id = p.id),
    'active_listing_count', (SELECT COUNT(*) FROM public.listings WHERE user_id = p.id AND is_active = true)
  )
  FROM public.profiles p
  LEFT JOIN public.campuses c ON c.id = p.campus_id
  LEFT JOIN public.roommate_profiles rp ON rp.user_id = p.id
  WHERE p.id = _uid;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated;

-- Public listings for a user (RLS on listings already permits is_active reads publicly if that policy exists — call from client via existing fetch)
