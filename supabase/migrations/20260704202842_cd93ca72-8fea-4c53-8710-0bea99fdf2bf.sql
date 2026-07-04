
-- Allow anonymous and signed-in users to see basic public info for profiles
-- that own an active listing (so listing cards can show the poster name).
GRANT SELECT ON public.profiles TO anon;

CREATE POLICY "profiles_public_listing_owner_read"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.user_id = profiles.id AND l.is_active = true
  )
);
