DO $$
DECLARE
  t text;
  keep_insert text[] := ARRAY['ambassador_applications','campus_notify_signups','listing_reports','listing_shares','saved_searches'];
  skip text[] := ARRAY['deposit_agreements','boost_purchases','payment_intents','notifications','listings'];
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND NOT (c.relname = ANY(skip))
    ORDER BY c.relname
  LOOP
    IF t = ANY(keep_insert) THEN
      EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON public.%I FROM anon', t);
    ELSE
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon', t);
    END IF;
  END LOOP;
END $$;