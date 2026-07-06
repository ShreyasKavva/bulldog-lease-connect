
CREATE TABLE IF NOT EXISTS public.listing_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  how_found_renter text NOT NULL,
  additional_comments text,
  is_testimonial boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.listing_feedback TO authenticated;
GRANT ALL ON public.listing_feedback TO service_role;

ALTER TABLE public.listing_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can insert feedback for their listings"
  ON public.listing_feedback FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_feedback.listing_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all listing feedback"
  ON public.listing_feedback FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update testimonial flag"
  ON public.listing_feedback FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.renter_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  how_found text NOT NULL,
  additional_comments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT ON public.renter_feedback TO authenticated;
GRANT ALL ON public.renter_feedback TO service_role;

ALTER TABLE public.renter_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own renter feedback"
  ON public.renter_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read their own renter feedback"
  ON public.renter_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all renter feedback"
  ON public.renter_feedback FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
