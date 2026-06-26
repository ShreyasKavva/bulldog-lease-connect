-- Reactions
CREATE TABLE IF NOT EXISTS public.listing_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type text NOT NULL CHECK (reaction_type IN ('fire','love','wow','pricey','suspicious')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_reactions TO authenticated;
GRANT SELECT ON public.listing_reactions TO anon;
GRANT ALL ON public.listing_reactions TO service_role;

ALTER TABLE public.listing_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reactions"
  ON public.listing_reactions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own reactions"
  ON public.listing_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reactions"
  ON public.listing_reactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions"
  ON public.listing_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS listing_reactions_listing_idx
  ON public.listing_reactions (listing_id);
CREATE INDEX IF NOT EXISTS listing_reactions_created_idx
  ON public.listing_reactions (created_at DESC);

-- Realtime for the activity feed
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.listing_reactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.listings; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_listings; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.looking_for_posts; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
