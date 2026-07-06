CREATE INDEX IF NOT EXISTS listings_status_available_to_campus_idx
  ON public.listings (status, available_to, campus_id)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.get_public_profile(_uid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'active_listing_count', (SELECT COUNT(*) FROM public.listings WHERE user_id = p.id AND is_active = true),
    'completed_count', (SELECT COUNT(*) FROM public.listings WHERE user_id = p.id AND status = 'filled')
  )
  FROM public.profiles p
  LEFT JOIN public.campuses c ON c.id = p.campus_id
  LEFT JOIN public.roommate_profiles rp ON rp.user_id = p.id
  WHERE p.id = _uid;
$function$;