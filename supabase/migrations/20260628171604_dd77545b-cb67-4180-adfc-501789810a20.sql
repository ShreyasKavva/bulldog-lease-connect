
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS deposit_amount integer,
  ADD COLUMN IF NOT EXISTS deposit_escrow_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_listings_featured ON public.listings(is_featured, featured_until) WHERE is_featured = true;

-- payment_intents
CREATE TABLE IF NOT EXISTS public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  payer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  payee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  purpose text NOT NULL DEFAULT 'deposit' CHECK (purpose IN ('deposit','featured_boost')),
  stripe_payment_intent_id text UNIQUE,
  stripe_checkout_session_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','held','released','refunded','disputed','succeeded','failed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  refunded_at timestamptz
);
GRANT SELECT ON public.payment_intents TO authenticated;
GRANT ALL ON public.payment_intents TO service_role;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read own payments" ON public.payment_intents
  FOR SELECT TO authenticated
  USING (auth.uid() = payer_id OR auth.uid() = payee_id);
CREATE POLICY "Admins read all payments" ON public.payment_intents
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE TRIGGER set_payment_intents_updated_at
  BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- deposit_waitlist
CREATE TABLE IF NOT EXISTS public.deposit_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('poster','subletter')),
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id, role)
);
GRANT SELECT, INSERT ON public.deposit_waitlist TO authenticated;
GRANT ALL ON public.deposit_waitlist TO service_role;
ALTER TABLE public.deposit_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own waitlist row" ON public.deposit_waitlist
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own waitlist rows" ON public.deposit_waitlist
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read full waitlist" ON public.deposit_waitlist
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Update SafeScore to reward escrow
CREATE OR REPLACE FUNCTION public.compute_listing_safe_score(_listing_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_score INTEGER := 0;
  v_listing RECORD;
  v_profile RECORD;
  v_photo_count INTEGER;
  v_avg numeric;
  v_count integer;
  v_bonus numeric := 0;
BEGIN
  SELECT * INTO v_listing FROM public.listings WHERE id = _listing_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_listing.user_id;

  v_photo_count := COALESCE(array_length(v_listing.photos, 1), 0);
  IF v_photo_count >= 3 THEN v_score := v_score + 15;
  ELSIF v_photo_count >= 1 THEN v_score := v_score + 10; END IF;

  IF length(COALESCE(v_listing.description,'')) >= 200 THEN v_score := v_score + 15;
  ELSIF length(COALESCE(v_listing.description,'')) >= 50 THEN v_score := v_score + 8; END IF;

  IF v_listing.price IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_listing.available_from IS NOT NULL AND v_listing.available_to IS NOT NULL THEN v_score := v_score + 10; END IF;
  IF v_listing.address IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_listing.lat IS NOT NULL AND v_listing.lng IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_listing.beds IS NOT NULL AND v_listing.baths IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_listing.furnished IS NOT NULL THEN v_score := v_score + 3; END IF;
  IF v_listing.area IS NOT NULL THEN v_score := v_score + 2; END IF;

  IF v_profile.verified_email THEN v_score := v_score + 15; END IF;
  IF v_profile.avatar_emoji IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_profile.year IS NOT NULL AND v_profile.major IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF length(COALESCE(v_profile.bio,'')) >= 30 THEN v_score := v_score + 5; END IF;
  IF v_profile.phone IS NOT NULL THEN v_score := v_score + 5; END IF;

  -- Secure deposit boost
  IF v_listing.deposit_escrow_enabled THEN v_score := v_score + 5; END IF;

  SELECT AVG(stars)::numeric, COUNT(*) INTO v_avg, v_count
  FROM public.reviews
  WHERE reviewed_user_id = v_listing.user_id AND is_removed = false;

  IF v_count > 0 THEN
    IF v_avg >= 4.5 THEN v_bonus := v_bonus + 2.0;
    ELSIF v_avg >= 3.5 THEN v_bonus := v_bonus + 1.0;
    END IF;
    IF v_count >= 10 THEN v_bonus := v_bonus + 1.0;
    ELSIF v_count >= 3 THEN v_bonus := v_bonus + 0.5;
    END IF;
  END IF;

  v_score := v_score + (v_bonus * 10)::integer;

  RETURN LEAST(v_score, 100);
END;
$function$;
