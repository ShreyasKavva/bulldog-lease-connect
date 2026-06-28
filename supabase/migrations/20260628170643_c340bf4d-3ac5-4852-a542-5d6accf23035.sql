
CREATE TABLE IF NOT EXISTS public.listing_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  share_type text NOT NULL CHECK (share_type IN ('story_graphic','link_copy','native_share')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_shares_listing ON public.listing_shares(listing_id, created_at DESC);

GRANT SELECT, INSERT ON public.listing_shares TO authenticated;
GRANT SELECT, INSERT ON public.listing_shares TO anon;
GRANT ALL ON public.listing_shares TO service_role;

ALTER TABLE public.listing_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a share"
  ON public.listing_shares FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Poster reads their listing shares"
  ON public.listing_shares FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM public.listings WHERE id = listing_shares.listing_id)
  );
