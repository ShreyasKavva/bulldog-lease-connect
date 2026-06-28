
-- Extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS featured_purchased_at timestamptz;

-- boost_purchases
CREATE TABLE IF NOT EXISTS public.boost_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  amount_cents integer NOT NULL DEFAULT 999,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
GRANT SELECT, INSERT ON public.boost_purchases TO authenticated;
GRANT ALL ON public.boost_purchases TO service_role;
ALTER TABLE public.boost_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own boost purchases" ON public.boost_purchases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own pending boost" ON public.boost_purchases
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all boost purchases" ON public.boost_purchases
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- deposit_agreements
CREATE TABLE IF NOT EXISTS public.deposit_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  poster_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  subletter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deposit_amount_cents integer NOT NULL,
  platform_fee_cents integer GENERATED ALWAYS AS (ROUND(deposit_amount_cents * 0.025)) STORED,
  total_charged_cents integer GENERATED ALWAYS AS (deposit_amount_cents + ROUND(deposit_amount_cents * 0.025)) STORED,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','held','released','refunded','disputed')),
  stripe_payment_intent_id text UNIQUE,
  move_in_date date,
  agreed_at timestamptz,
  paid_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  disputed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.deposit_agreements TO authenticated;
GRANT ALL ON public.deposit_agreements TO service_role;
ALTER TABLE public.deposit_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties read own agreement" ON public.deposit_agreements
  FOR SELECT TO authenticated
  USING (auth.uid() = poster_id OR auth.uid() = subletter_id);
CREATE POLICY "Subletter inserts own pending agreement" ON public.deposit_agreements
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = subletter_id);
CREATE POLICY "Admins read all agreements" ON public.deposit_agreements
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE TRIGGER set_deposit_agreements_updated_at
  BEFORE UPDATE ON public.deposit_agreements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Daily cron: expire featured listings
SELECT cron.schedule(
  'expire-featured-listings',
  '0 * * * *', -- hourly
  $$ UPDATE public.listings SET is_featured = false WHERE is_featured = true AND featured_until < now(); $$
);
