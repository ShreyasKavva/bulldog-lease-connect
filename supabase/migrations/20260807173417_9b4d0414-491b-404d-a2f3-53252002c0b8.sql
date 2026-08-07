DROP TRIGGER IF EXISTS listings_safe_score_after ON public.listings;
DROP TRIGGER IF EXISTS profiles_safe_score_refresh ON public.profiles;
DROP TRIGGER IF EXISTS refresh_safe_score_on_review_trg ON public.reviews;

DROP FUNCTION IF EXISTS public.refresh_listing_safe_score_after() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_user_listings_safe_score() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_safe_score_on_review() CASCADE;
DROP FUNCTION IF EXISTS public.compute_listing_safe_score(uuid) CASCADE;