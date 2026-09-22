-- Q410 — close anonymous access to stored files.
-- Reads move behind signed URLs minted server-side with the service role.
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "listing_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;

CREATE POLICY "avatars_auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "listing_photos_auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'listing-photos');

CREATE POLICY "avatars_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

REVOKE ALL ON TABLE storage.objects FROM anon;