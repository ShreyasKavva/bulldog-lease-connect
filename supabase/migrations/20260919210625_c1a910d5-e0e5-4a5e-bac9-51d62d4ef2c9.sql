ALTER TABLE public.listings DISABLE TRIGGER listings_updated;

WITH ranked AS (
  SELECT id, (row_number() OVER (ORDER BY created_at, id)) - 1 AS rn
  FROM public.listings
  WHERE user_id = 'd0000000-0000-4000-8000-000000000001'
)
UPDATE public.listings l
SET photos = array_prepend(
      'seed-covers/seed-' || lpad(r.rn::text, 3, '0') || '.jpg',
      COALESCE(l.photos, ARRAY[]::text[])
    )
FROM ranked r
WHERE l.id = r.id;

ALTER TABLE public.listings ENABLE TRIGGER listings_updated;