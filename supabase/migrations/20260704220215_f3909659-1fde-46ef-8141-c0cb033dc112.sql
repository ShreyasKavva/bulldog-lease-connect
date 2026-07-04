
-- 1. listing_reactions: drop public read, add owner-only read, expose aggregates via views
DROP POLICY IF EXISTS "Anyone can read reactions" ON public.listing_reactions;

CREATE POLICY "Users read own reactions"
  ON public.listing_reactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE VIEW public.listing_reaction_counts AS
  SELECT listing_id, reaction_type, count(*)::int AS count
  FROM public.listing_reactions
  GROUP BY listing_id, reaction_type;

CREATE OR REPLACE VIEW public.listing_reaction_events AS
  SELECT listing_id, reaction_type, created_at
  FROM public.listing_reactions;

GRANT SELECT ON public.listing_reaction_counts TO anon, authenticated;
GRANT SELECT ON public.listing_reaction_events TO anon, authenticated;

-- 2. saved_listings: drop public read; owner + listing-owner read; expose counts/events via views
DROP POLICY IF EXISTS "Anyone reads save counts" ON public.saved_listings;

CREATE POLICY "Listing owner can read saves"
  ON public.saved_listings FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = saved_listings.listing_id
      AND l.user_id = auth.uid()
  ));

CREATE OR REPLACE VIEW public.saved_listing_counts AS
  SELECT listing_id, count(*)::int AS save_count
  FROM public.saved_listings
  GROUP BY listing_id;

CREATE OR REPLACE VIEW public.saved_listing_events AS
  SELECT listing_id, created_at
  FROM public.saved_listings;

GRANT SELECT ON public.saved_listing_counts TO anon, authenticated;
GRANT SELECT ON public.saved_listing_events TO anon, authenticated;

-- 3. Revoke EXECUTE from anon/authenticated on internal-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_price_label(integer, uuid, integer) FROM anon, authenticated, PUBLIC;
