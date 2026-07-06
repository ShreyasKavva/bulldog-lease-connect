
CREATE TABLE public.campus_email_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  domain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.campus_email_domains TO anon, authenticated;
GRANT ALL ON public.campus_email_domains TO service_role;

ALTER TABLE public.campus_email_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read campus email domains"
  ON public.campus_email_domains FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Admins can manage campus email domains"
  ON public.campus_email_domains FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Seed from the existing campuses.domain single-value column
INSERT INTO public.campus_email_domains (campus_id, domain)
SELECT id, lower(domain) FROM public.campuses
WHERE domain IS NOT NULL AND length(trim(domain)) > 0
ON CONFLICT (domain) DO NOTHING;

-- Add well-known additional / alternate domains
INSERT INTO public.campus_email_domains (campus_id, domain)
SELECT c.id, d.domain
FROM public.campuses c
JOIN (VALUES
  ('university-of-georgia', 'uga.edu'),
  ('georgia-tech', 'gatech.edu'),
  ('auburn-university', 'auburn.edu'),
  ('clemson-university', 'clemson.edu'),
  ('duke-university', 'duke.edu'),
  ('florida-state-university', 'fsu.edu'),
  ('florida-state-university', 'my.fsu.edu'),
  ('indiana-university', 'iu.edu'),
  ('indiana-university', 'indiana.edu'),
  ('louisiana-state-university', 'lsu.edu'),
  ('mississippi-state-university', 'msstate.edu'),
  ('nc-state-university', 'ncsu.edu'),
  ('ohio-state-university', 'osu.edu'),
  ('ohio-state-university', 'buckeyemail.osu.edu'),
  ('penn-state-university', 'psu.edu'),
  ('purdue-university', 'purdue.edu'),
  ('texas-a-m-university', 'tamu.edu'),
  ('university-of-alabama', 'ua.edu'),
  ('university-of-alabama', 'crimson.ua.edu'),
  ('university-of-arkansas', 'uark.edu'),
  ('university-of-central-florida', 'ucf.edu'),
  ('university-of-central-florida', 'knights.ucf.edu'),
  ('university-of-florida', 'ufl.edu'),
  ('university-of-illinois', 'illinois.edu'),
  ('university-of-kentucky', 'uky.edu'),
  ('university-of-miami', 'miami.edu'),
  ('university-of-michigan', 'umich.edu'),
  ('university-of-mississippi', 'olemiss.edu'),
  ('university-of-mississippi', 'go.olemiss.edu'),
  ('university-of-north-carolina', 'unc.edu'),
  ('university-of-north-carolina', 'email.unc.edu'),
  ('university-of-notre-dame', 'nd.edu'),
  ('university-of-south-carolina', 'sc.edu'),
  ('university-of-south-carolina', 'email.sc.edu'),
  ('university-of-tennessee', 'utk.edu'),
  ('university-of-tennessee', 'vols.utk.edu'),
  ('university-of-texas', 'utexas.edu'),
  ('university-of-texas-at-austin', 'utexas.edu'),
  ('university-of-virginia', 'virginia.edu'),
  ('university-of-wisconsin', 'wisc.edu'),
  ('vanderbilt.edu', 'vanderbilt.edu'),
  ('vanderbilt-university', 'vanderbilt.edu'),
  ('virginia-tech', 'vt.edu')
) AS d(slug, domain) ON d.slug = c.slug
ON CONFLICT (domain) DO NOTHING;

CREATE INDEX IF NOT EXISTS campus_email_domains_domain_idx
  ON public.campus_email_domains (domain);
