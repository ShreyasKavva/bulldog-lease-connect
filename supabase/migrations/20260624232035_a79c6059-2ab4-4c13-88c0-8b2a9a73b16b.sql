
CREATE POLICY "listing_photos_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'listing-photos');
CREATE POLICY "listing_photos_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listing-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "listing_photos_auth_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'listing-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "listing_photos_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'listing-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
