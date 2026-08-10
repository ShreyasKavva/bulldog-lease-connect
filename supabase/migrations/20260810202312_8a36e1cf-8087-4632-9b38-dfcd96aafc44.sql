CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_email_filters_uniq
  ON public.saved_searches (lower(email), md5(filters::text))
  WHERE email IS NOT NULL;