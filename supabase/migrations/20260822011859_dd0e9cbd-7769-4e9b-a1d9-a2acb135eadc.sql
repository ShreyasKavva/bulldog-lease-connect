-- Q179: full US institution directory support

ALTER TABLE public.campuses
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS level smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ipeds_unitid integer,
  ADD COLUMN IF NOT EXISTS aliases text;

COMMENT ON COLUMN public.campuses.level IS '1 = 4-year institution, 2 = 2-year / community college';

CREATE UNIQUE INDEX IF NOT EXISTS campuses_ipeds_unitid_key ON public.campuses (ipeds_unitid) WHERE ipeds_unitid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS campuses_slug_key ON public.campuses (slug);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.campuses
  ADD COLUMN IF NOT EXISTS search_text text
  GENERATED ALWAYS AS (
    lower(coalesce(name,'') || ' ' || coalesce(short_name,'') || ' ' || coalesce(city,'') || ' ' || coalesce(state,'') || ' ' || coalesce(aliases,''))
  ) STORED;

CREATE INDEX IF NOT EXISTS campuses_search_text_trgm ON public.campuses USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS listings_campus_active_idx ON public.listings (campus_id) WHERE is_active = true AND status = 'active';

-- Campuses that actually have inventory (homepage grid, footer, default suggestions)
CREATE OR REPLACE FUNCTION public.campuses_with_listings()
RETURNS TABLE (
  id uuid, name text, short_name text, city text, state text,
  lat double precision, lng double precision, domain text, slug text,
  level smallint, listing_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.short_name, c.city, c.state, c.lat, c.lng, c.domain, c.slug, c.level,
         count(l.id)::int AS listing_count
  FROM public.campuses c
  JOIN public.listings l
    ON l.campus_id = c.id AND l.is_active = true AND l.status = 'active'
  GROUP BY c.id
  ORDER BY listing_count DESC, c.name;
$$;

-- Server-side typeahead across the full directory, inventory-first ranking
CREATE OR REPLACE FUNCTION public.search_campuses(_q text, _limit integer DEFAULT 8)
RETURNS TABLE (
  id uuid, name text, short_name text, city text, state text,
  lat double precision, lng double precision, domain text, slug text,
  level smallint, listing_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (SELECT lower(btrim(coalesce(_q, ''))) AS t),
  counts AS (
    SELECT campus_id, count(*)::int AS n
    FROM public.listings
    WHERE is_active = true AND status = 'active'
    GROUP BY campus_id
  )
  SELECT c.id, c.name, c.short_name, c.city, c.state, c.lat, c.lng, c.domain, c.slug, c.level,
         coalesce(ct.n, 0) AS listing_count
  FROM public.campuses c
  CROSS JOIN q
  LEFT JOIN counts ct ON ct.campus_id = c.id
  WHERE q.t <> '' AND (
        c.search_text LIKE q.t || '%'
     OR c.search_text LIKE '% ' || q.t || '%'
     OR lower(coalesce(c.short_name,'')) = q.t
     OR c.search_text % q.t
  )
  ORDER BY
    (coalesce(ct.n, 0) > 0) DESC,
    coalesce(ct.n, 0) DESC,
    (lower(c.name) LIKE q.t || '%' OR lower(coalesce(c.short_name,'')) LIKE q.t || '%') DESC,
    c.level ASC,
    similarity(c.search_text, q.t) DESC,
    c.name ASC
  LIMIT greatest(1, least(coalesce(_limit, 8), 25));
$$;

-- Nearest campuses that DO have listings (empty-campus rail)
CREATE OR REPLACE FUNCTION public.nearby_campuses_with_listings(_campus_id uuid, _limit integer DEFAULT 4)
RETURNS TABLE (
  id uuid, name text, short_name text, city text, state text,
  lat double precision, lng double precision, domain text, slug text,
  level smallint, listing_count integer, distance_miles integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH origin AS (SELECT lat, lng FROM public.campuses WHERE id = _campus_id),
  counts AS (
    SELECT campus_id, count(*)::int AS n
    FROM public.listings
    WHERE is_active = true AND status = 'active'
    GROUP BY campus_id
  )
  SELECT c.id, c.name, c.short_name, c.city, c.state, c.lat, c.lng, c.domain, c.slug, c.level,
         ct.n AS listing_count,
         round(
           3958.8 * 2 * asin(sqrt(
             power(sin(radians(c.lat - o.lat) / 2), 2) +
             cos(radians(o.lat)) * cos(radians(c.lat)) *
             power(sin(radians(c.lng - o.lng) / 2), 2)
           ))
         )::int AS distance_miles
  FROM public.campuses c
  JOIN counts ct ON ct.campus_id = c.id
  CROSS JOIN origin o
  WHERE c.id <> _campus_id
  ORDER BY distance_miles ASC
  LIMIT greatest(1, least(coalesce(_limit, 4), 12));
$$;

REVOKE ALL ON FUNCTION public.campuses_with_listings() FROM public;
REVOKE ALL ON FUNCTION public.search_campuses(text, integer) FROM public;
REVOKE ALL ON FUNCTION public.nearby_campuses_with_listings(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.campuses_with_listings() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_campuses(text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.nearby_campuses_with_listings(uuid, integer) TO anon, authenticated, service_role;

-- "Notify me when a sublease is posted here"
CREATE TABLE IF NOT EXISTS public.campus_notify_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campus_id, email)
);

GRANT INSERT ON public.campus_notify_signups TO anon;
GRANT SELECT, INSERT ON public.campus_notify_signups TO authenticated;
GRANT ALL ON public.campus_notify_signups TO service_role;

ALTER TABLE public.campus_notify_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can request notifications"
  ON public.campus_notify_signups FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Users can see their own notify signups"
  ON public.campus_notify_signups FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER campus_notify_signups_updated_at
  BEFORE UPDATE ON public.campus_notify_signups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();