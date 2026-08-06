ALTER TABLE public.saved_listings
  ADD COLUMN IF NOT EXISTS collection_name text NOT NULL DEFAULT 'Saved';

ALTER TABLE public.saved_listings
  DROP CONSTRAINT IF EXISTS saved_listings_user_id_listing_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS saved_listings_user_listing_collection_key
  ON public.saved_listings (user_id, listing_id, collection_name);

CREATE INDEX IF NOT EXISTS saved_listings_user_collection_idx
  ON public.saved_listings (user_id, collection_name);