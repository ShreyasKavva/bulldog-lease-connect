CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT id,
    name,
    avatar_emoji,
    banner_color,
    bio,
    year,
    major,
    campus_id,
    vibe_tags,
    is_ambassador,
    verified_email,
    currently_emoji,
    currently_status,
    currently_updated_at,
    created_at,
    updated_at,
    avatar_url,
    CASE WHEN auth.uid() IS NOT NULL THEN date_trunc('day', last_seen) ELSE NULL END AS last_seen,
    referral_count,
    CASE WHEN auth.uid() IS NOT NULL THEN instagram_handle ELSE NULL END AS instagram_handle,
    response_rate
FROM profiles
WHERE EXISTS (
        SELECT 1 FROM public.listings l
        WHERE l.user_id = profiles.id AND l.is_active = true AND l.status = 'active'
    )
    OR EXISTS (
        SELECT 1 FROM public.looking_for_posts lf
        WHERE lf.user_id = profiles.id AND lf.is_active = true
    )
    OR profiles.id = auth.uid();

GRANT SELECT ON public.profiles_public TO anon, authenticated;