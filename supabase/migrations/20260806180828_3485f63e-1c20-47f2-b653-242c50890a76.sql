DROP POLICY IF EXISTS "Users write own reviews when eligible" ON public.reviews;

CREATE POLICY "Users write own reviews"
ON public.reviews FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reviewer_id AND reviewer_id <> reviewed_user_id);

CREATE POLICY "Users update own reviews"
ON public.reviews FOR UPDATE TO authenticated
USING (auth.uid() = reviewer_id)
WITH CHECK (auth.uid() = reviewer_id);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_listing_per_user
ON public.reviews (listing_id, reviewer_id)
WHERE listing_id IS NOT NULL;