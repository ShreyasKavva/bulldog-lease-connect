ALTER TABLE public.saved_listings
  ADD CONSTRAINT saved_listings_user_listing_unique UNIQUE (user_id, listing_id);