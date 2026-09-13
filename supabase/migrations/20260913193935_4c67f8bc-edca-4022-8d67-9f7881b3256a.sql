-- 1. Backfill: status is the source of truth for "live"
UPDATE public.listings
SET is_active = (status = 'active')
WHERE is_active IS DISTINCT FROM (status = 'active');

-- 2. Keep the two in sync going forward
CREATE OR REPLACE FUNCTION public.sync_listing_active_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.is_active := (NEW.status = 'active');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.is_active := (NEW.status = 'active');
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    NEW.status := CASE WHEN NEW.is_active THEN 'active' ELSE 'inactive' END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_listing_active_status ON public.listings;
CREATE TRIGGER sync_listing_active_status
BEFORE INSERT OR UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.sync_listing_active_status();

-- 3. Market stats view must use the same definition of "live"
CREATE OR REPLACE VIEW public.campus_price_stats AS
SELECT campus_id,
  beds,
  count(*)::integer AS listing_count,
  round(avg(price))::integer AS avg_price,
  percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (price::double precision))::integer AS median_price,
  percentile_cont(0.25::double precision) WITHIN GROUP (ORDER BY (price::double precision))::integer AS p25_price,
  percentile_cont(0.75::double precision) WITHIN GROUP (ORDER BY (price::double precision))::integer AS p75_price,
  min(price) AS min_price,
  max(price) AS max_price
FROM public.listings
WHERE status = 'active'
  AND is_active = true
  AND created_at > (now() - '90 days'::interval)
  AND beds IS NOT NULL
  AND price IS NOT NULL
GROUP BY campus_id, beds
HAVING count(*) >= 3;