
CREATE POLICY "msg_attachments_select_participant"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'messages-attachments'
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::text = split_part(name, '/', 1)
      AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
  )
);

CREATE POLICY "msg_attachments_insert_participant"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'messages-attachments'
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::text = split_part(name, '/', 1)
      AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
  )
);

CREATE POLICY "msg_attachments_delete_owner"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'messages-attachments'
  AND owner = auth.uid()
);
