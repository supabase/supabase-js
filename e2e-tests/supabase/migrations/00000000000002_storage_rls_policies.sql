-- Storage RLS Policies (from storage-js)
-- Note: service_role key bypasses RLS, but we add these for tests that use anon/authenticated roles

-- Allow user 317eadce-631a-4429-a0bb-f19a7a517b4a to CRUD all buckets and objects
CREATE POLICY crud_buckets ON storage.buckets FOR ALL USING (auth.uid() = '317eadce-631a-4429-a0bb-f19a7a517b4a'::uuid);
CREATE POLICY crud_objects ON storage.objects FOR ALL USING (auth.uid() = '317eadce-631a-4429-a0bb-f19a7a517b4a'::uuid);

-- Allow public CRUD access to the public folder in bucket2
CREATE POLICY crud_public_folder ON storage.objects FOR ALL USING (bucket_id = 'bucket2' AND (storage.foldername(name))[1] = 'public');

-- Allow public CRUD access to a particular file in bucket2
CREATE POLICY crud_public_file ON storage.objects FOR ALL USING (bucket_id = 'bucket2' AND name = 'folder/subfolder/public-all-permissions.png');

-- Allow public CRUD access to a folder in bucket2 to a user with a given id
CREATE POLICY crud_uid_folder ON storage.objects FOR ALL USING (bucket_id = 'bucket2' AND (storage.foldername(name))[1] = 'only_uid' AND auth.uid() = 'd8c7bce9-cfeb-497b-bd61-e66ce2cbdaa2'::uuid);

-- Allow public CRUD access to a file in bucket2 to a user with a given id
CREATE POLICY crud_uid_file ON storage.objects FOR ALL USING (bucket_id = 'bucket2' AND name = 'folder/only_uid.jpg' AND auth.uid() = 'd8c7bce9-cfeb-497b-bd61-e66ce2cbdaa2'::uuid);

-- Allow CRUD access to a folder in bucket2 to all authenticated users
CREATE POLICY authenticated_folder ON storage.objects FOR ALL USING (bucket_id = 'bucket2' AND (storage.foldername(name))[1] = 'authenticated' AND auth.role() = 'authenticated');

-- Allow CRUD access to a folder in bucket2 to its owners
CREATE POLICY crud_owner_only ON storage.objects FOR ALL USING (bucket_id = 'bucket2' AND (storage.foldername(name))[1] = 'only_owner' AND owner_id = auth.uid()::text);

-- Allow CRUD access to bucket4
CREATE POLICY open_all_update ON storage.objects FOR ALL WITH CHECK (bucket_id = 'bucket4');

-- Allow CRUD access to my-private-bucket for specific user
CREATE POLICY crud_my_bucket ON storage.objects FOR ALL USING (bucket_id = 'my-private-bucket' AND auth.uid() = '317eadce-631a-4429-a0bb-f19a7a517b4a'::uuid);
