
-- 1. Listings columns
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS pending_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_tier text NOT NULL DEFAULT 'unverified'
    CHECK (verification_tier IN ('unverified','basic','verified','premium')),
  ADD COLUMN IF NOT EXISTS auto_flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_review_since timestamptz;

-- 2. Reports columns
ALTER TABLE public.listing_reports
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('urgent','high','normal','low')),
  ADD COLUMN IF NOT EXISTS auto_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_flagged boolean NOT NULL DEFAULT false;

-- 3. Verification tier
CREATE OR REPLACE FUNCTION public.compute_verification_tier(_listing_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l RECORD; p RECORD; photo_count int; review_count int; avg_stars numeric;
BEGIN
  SELECT * INTO l FROM public.listings WHERE id = _listing_id;
  IF NOT FOUND THEN RETURN 'unverified'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = l.user_id;
  photo_count := COALESCE(array_length(l.photos,1),0);
  SELECT COUNT(*), COALESCE(AVG(stars),0) INTO review_count, avg_stars
    FROM public.reviews WHERE reviewed_user_id = l.user_id AND is_removed = false;

  IF COALESCE(p.verified_email,false)
     AND photo_count >= 3
     AND length(COALESCE(l.description,'')) > 100
     AND l.available_from IS NOT NULL AND l.available_to IS NOT NULL
     AND l.furnished IS NOT NULL AND l.utilities_included IS NOT NULL
     AND review_count >= 2 AND avg_stars >= 4.0
     AND COALESCE(l.safe_score,0) >= 80 THEN RETURN 'premium';
  ELSIF COALESCE(p.verified_email,false)
     AND photo_count >= 3
     AND length(COALESCE(l.description,'')) > 100
     AND l.available_from IS NOT NULL AND l.available_to IS NOT NULL
     AND l.furnished IS NOT NULL AND l.utilities_included IS NOT NULL THEN RETURN 'verified';
  ELSIF COALESCE(p.verified_email,false)
     AND photo_count >= 1
     AND l.available_from IS NOT NULL AND l.available_to IS NOT NULL THEN RETURN 'basic';
  ELSE RETURN 'unverified';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_verification_tier_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tier text;
BEGIN
  tier := public.compute_verification_tier(NEW.id);
  IF tier IS DISTINCT FROM NEW.verification_tier THEN
    UPDATE public.listings SET verification_tier = tier WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS listings_refresh_tier ON public.listings;
CREATE TRIGGER listings_refresh_tier
AFTER INSERT OR UPDATE OF photos, description, available_from, available_to,
  furnished, utilities_included, safe_score
ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.refresh_verification_tier_after();

-- 4. Report auto-priority + auto-hide
CREATE OR REPLACE FUNCTION public.score_and_hide_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cnt int; pri text := 'normal'; score int := 0; pending boolean;
BEGIN
  SELECT pending_review INTO pending FROM public.listings WHERE id = NEW.listing_id;
  SELECT COUNT(DISTINCT reporter_id) INTO cnt FROM public.listing_reports WHERE listing_id = NEW.listing_id;

  IF cnt >= 3 THEN pri := 'urgent'; score := 100;
  ELSIF NEW.reason IN ('scam','fraud') THEN pri := 'high'; score := 80;
  ELSIF NEW.reason = 'inappropriate' AND COALESCE(length(NEW.details),0) > 0 THEN pri := 'high'; score := 70;
  ELSIF pending THEN pri := 'high'; score := 60;
  ELSIF NEW.reason = 'wrong_info' THEN pri := 'normal'; score := 30;
  ELSIF NEW.reason = 'other' THEN pri := 'low'; score := 10;
  END IF;

  UPDATE public.listing_reports SET priority = pri, auto_score = score WHERE id = NEW.id;

  IF cnt >= 3 THEN
    UPDATE public.listings
      SET is_active = false, pending_review = true, pending_review_since = COALESCE(pending_review_since, now())
      WHERE id = NEW.listing_id;
    INSERT INTO public.notifications (user_id, type, title, body, link, data)
    SELECT user_id, 'listing_flagged',
      'Your listing was temporarily hidden',
      'Your listing received multiple reports and is hidden pending review. Our team responds within 24 hours.',
      '/my-listings',
      jsonb_build_object('listing_id', NEW.listing_id)
    FROM public.listings WHERE id = NEW.listing_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS report_score_and_hide ON public.listing_reports;
CREATE TRIGGER report_score_and_hide
AFTER INSERT ON public.listing_reports
FOR EACH ROW EXECUTE FUNCTION public.score_and_hide_report();

-- 5. Suspicious listings view
CREATE OR REPLACE VIEW public.suspicious_listings AS
SELECT l.id, l.user_id, l.title, l.price, l.beds, l.campus_id,
  l.view_count, l.created_at, l.photos, l.pending_review, l.verification_tier,
  cps.median_price, cps.p25_price, cps.p75_price,
  CASE
    WHEN cps.p25_price IS NOT NULL AND l.price < cps.p25_price * 0.5 THEN 'price_too_low'
    WHEN cps.p75_price IS NOT NULL AND l.price > cps.p75_price * 2 THEN 'price_too_high'
    WHEN l.view_count > 500
      AND NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.listing_id = l.id) THEN 'high_views_no_messages'
    WHEN COALESCE(array_length(l.photos,1),0) = 0 THEN 'no_photos'
    ELSE NULL
  END as flag_reason
FROM public.listings l
LEFT JOIN public.campus_price_stats cps ON cps.campus_id = l.campus_id AND cps.beds = l.beds
WHERE l.is_active = true
  AND l.verification_tier IN ('unverified','basic');

CREATE OR REPLACE VIEW public.suspicious_listings_filtered AS
SELECT * FROM public.suspicious_listings WHERE flag_reason IS NOT NULL;

-- 6. User risk score view
CREATE OR REPLACE VIEW public.user_risk_scores AS
SELECT p.id, p.name, p.email, p.banned, p.verified_email, p.created_at,
  COALESCE((SELECT COUNT(*) FROM public.listing_reports r
            JOIN public.listings l ON r.listing_id = l.id WHERE l.user_id = p.id), 0) as reports_received,
  COALESCE((SELECT COUNT(*) FROM public.listing_reports r WHERE r.reporter_id = p.id), 0) as reports_filed,
  COALESCE((SELECT AVG(stars) FROM public.reviews WHERE reviewed_user_id = p.id AND is_removed = false), 0)::numeric(3,2) as avg_rating,
  CASE
    WHEN p.banned THEN 'banned'
    WHEN (SELECT COUNT(*) FROM public.listing_reports r JOIN public.listings l ON r.listing_id = l.id WHERE l.user_id = p.id) >= 3 THEN 'high_risk'
    WHEN COALESCE((SELECT AVG(stars) FROM public.reviews WHERE reviewed_user_id = p.id AND is_removed = false), 0) > 0
      AND COALESCE((SELECT AVG(stars) FROM public.reviews WHERE reviewed_user_id = p.id AND is_removed = false), 0) < 3.0 THEN 'low_trust'
    WHEN p.verified_email = false THEN 'unverified'
    ELSE 'good_standing'
  END as risk_level
FROM public.profiles p;

GRANT SELECT ON public.suspicious_listings TO authenticated, service_role;
GRANT SELECT ON public.suspicious_listings_filtered TO authenticated, service_role;
GRANT SELECT ON public.user_risk_scores TO authenticated, service_role;

-- 7. Auto-approve after 24h
CREATE OR REPLACE FUNCTION public.auto_approve_pending_listings()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.listings
    SET pending_review = false, is_active = true
    WHERE pending_review = true
      AND pending_review_since IS NOT NULL
      AND pending_review_since < now() - interval '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.listing_reports r
        WHERE r.listing_id = listings.id AND r.status = 'open'
      );
END $$;

DO $$ BEGIN PERFORM cron.unschedule('auto-approve-pending-listings');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'auto-approve-pending-listings',
  '*/30 * * * *',
  $$SELECT public.auto_approve_pending_listings();$$
);
