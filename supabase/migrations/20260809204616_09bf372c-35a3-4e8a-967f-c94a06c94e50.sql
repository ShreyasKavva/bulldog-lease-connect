WITH gt AS (
  SELECT l.id, row_number() OVER (ORDER BY l.id) AS rn
  FROM public.listings l
  JOIN public.campuses c ON c.id = l.campus_id
  WHERE c.slug = 'georgia-tech'
)
UPDATE public.listings l
SET available_from = v.af, available_to = v.at
FROM gt, LATERAL (
  SELECT CASE
    WHEN gt.rn <= 3 THEN DATE '2026-08-20'
    WHEN gt.rn <= 6 THEN DATE '2026-09-01'
    WHEN gt.rn <= 8 THEN DATE '2026-08-25'
    ELSE DATE '2027-01-10'
  END AS af,
  CASE
    WHEN gt.rn <= 3 THEN DATE '2026-12-20'
    WHEN gt.rn <= 6 THEN DATE '2027-05-15'
    WHEN gt.rn <= 8 THEN DATE '2027-01-10'
    ELSE DATE '2027-05-10'
  END AS at
) v
WHERE l.id = gt.id;