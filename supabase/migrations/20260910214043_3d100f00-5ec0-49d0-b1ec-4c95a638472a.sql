DROP POLICY IF EXISTS "Users insert own pending boost" ON public.boost_purchases;
CREATE POLICY "Users insert own pending boost" ON public.boost_purchases
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Subletter inserts own pending agreement" ON public.deposit_agreements;
CREATE POLICY "Subletter inserts own pending agreement" ON public.deposit_agreements
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = subletter_id AND status = 'pending' AND paid_at IS NULL AND released_at IS NULL);