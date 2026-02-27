-- Seed data for storage-js integration tests
-- This file is loaded after migrations during `supabase db reset`

-- Insert test users into auth.users
-- Note: Supabase CLI's auth schema has more columns than the old Docker setup
-- We use the minimum required columns for testing
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES
    (
        '00000000-0000-0000-0000-000000000000',
        '317eadce-631a-4429-a0bb-f19a7a517b4a',
        'authenticated',
        'authenticated',
        'test-user1@supabase.io',
        crypt('password123', gen_salt('bf')),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{}',
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        '4d56e902-f0a0-4662-8448-a4d9e643c142',
        'authenticated',
        'authenticated',
        'test-user2@supabase.io',
        crypt('password123', gen_salt('bf')),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{}',
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        'd8c7bce9-cfeb-497b-bd61-e66ce2cbdaa2',
        'authenticated',
        'authenticated',
        'test-admin@supabase.io',
        crypt('password123', gen_salt('bf')),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{}',
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    );

-- Insert test buckets (using fixed timestamp for snapshot tests)
INSERT INTO storage.buckets (id, name, owner, created_at, updated_at, public) VALUES
    ('bucket2', 'bucket2', '4d56e902-f0a0-4662-8448-a4d9e643c142', '2021-02-17T04:43:32.770Z', '2021-02-17T04:43:32.770Z', false),
    ('bucket3', 'bucket3', '4d56e902-f0a0-4662-8448-a4d9e643c142', '2021-02-17T04:43:32.770Z', '2021-02-17T04:43:32.770Z', false),
    ('bucket4', 'bucket4', '317eadce-631a-4429-a0bb-f19a7a517b4a', '2021-02-17T04:43:32.770Z', '2021-02-17T04:43:32.770Z', false),
    ('bucket5', 'bucket5', '317eadce-631a-4429-a0bb-f19a7a517b4a', '2021-02-17T04:43:32.770Z', '2021-02-17T04:43:32.770Z', false),
    ('bucket-move', 'bucket-move', '317eadce-631a-4429-a0bb-f19a7a517b4a', '2021-02-17T04:43:32.770Z', '2021-02-17T04:43:32.770Z', false);

-- Insert test objects
INSERT INTO storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata) VALUES
    ('03e458f9-892f-4db2-8cb9-d3401a689e25', 'bucket2', 'public/sadcat-upload23.png', '317eadce-631a-4429-a0bb-f19a7a517b4a', NOW(), NOW(), NOW(), '{"mimetype": "image/svg+xml", "size": 1234}'),
    ('070825af-a11d-44fe-9f1d-abdc76f686f2', 'bucket2', 'public/sadcat-upload.png', '317eadce-631a-4429-a0bb-f19a7a517b4a', NOW(), NOW(), NOW(), '{"mimetype": "image/png", "size": 1234}'),
    ('0cac5609-11e1-4f21-b486-d0eeb60909f6', 'bucket2', 'curlimage.jpg', 'd8c7bce9-cfeb-497b-bd61-e66ce2cbdaa2', NOW(), NOW(), NOW(), '{"size": 1234}'),
    ('147c6795-94d5-4008-9d81-f7ba3b4f8a9f', 'bucket2', 'folder/only_uid.jpg', 'd8c7bce9-cfeb-497b-bd61-e66ce2cbdaa2', NOW(), NOW(), NOW(), '{"size": 1234}'),
    ('65a3aa9c-0ff2-4adc-85d0-eab673c27443', 'bucket2', 'authenticated/casestudy.png', 'd8c7bce9-cfeb-497b-bd61-e66ce2cbdaa2', NOW(), NOW(), NOW(), '{"size": 1234}'),
    ('10abe273-d77a-4bda-b410-6fc0ca3e6adc', 'bucket2', 'authenticated/cat.jpg', 'd8c7bce9-cfeb-497b-bd61-e66ce2cbdaa2', NOW(), NOW(), NOW(), '{"size": 1234}'),
    ('1edccac7-0876-4e9f-89da-a08d2a5f654b', 'bucket2', 'authenticated/delete.png', '317eadce-631a-4429-a0bb-f19a7a517b4a', NOW(), NOW(), NOW(), '{"mimetype": "image/png", "size": 1234}'),
    ('1a911f3c-8c1d-4661-93c1-8e065e4d757e', 'bucket2', 'authenticated/delete1.png', '317eadce-631a-4429-a0bb-f19a7a517b4a', NOW(), NOW(), NOW(), '{"mimetype": "image/png", "size": 1234}'),
    ('372d5d74-e24d-49dc-abe8-47d7eb226a2e', 'bucket2', 'authenticated/delete-multiple1.png', '317eadce-631a-4429-a0bb-f19a7a517b4a', NOW(), NOW(), NOW(), '{"mimetype": "image/png", "size": 1234}'),
    ('34811c1b-85e5-4eb6-a5e3-d607b2f6986e', 'bucket2', 'authenticated/delete-multiple2.png', '317eadce-631a-4429-a0bb-f19a7a517b4a', NOW(), NOW(), NOW(), '{"mimetype": "image/png", "size": 1234}'),
    ('45950ff2-d3a8-4add-8e49-bafc01198340', 'bucket2', 'authenticated/delete-multiple3.png', '317eadce-631a-4429-a0bb-f19a7a517b4a', NOW(), NOW(), NOW(), '{"mimetype": "image/png", "size": 1234}'),
    ('469b0216-5419-41f6-9a37-2abfd7fad29c', 'bucket2', 'authenticated/delete-multiple4.png', '317eadce-631a-4429-a0bb-f19a7a517b4a', NOW(), NOW(), NOW(), '{"mimetype": "image/png", "size": 1234}'),
    ('55930619-a668-4dbc-aea3-b93dfe101e7f', 'bucket2', 'authenticated/delete-multiple7.png', '317eadce-631a-4429-a0bb-f19a7a517b4a', NOW(), NOW(), NOW(), '{"mimetype": "image/png", "size": 1234}'),
    ('d1ce4e4f-03e2-473d-858b-301d7989b581', 'bucket2', 'authenticated/move-orig.png', '317eadce-631a-4429-a0bb-f19a7a517b4a', NOW(), NOW(), NOW(), '{"mimetype": "image/png", "size": 1234}'),
    ('222b3d1e-bc17-414c-b336-47894aa4d697', 'bucket2', 'authenticated/move-orig-2.png', '317eadce-631a-4429-a0bb-f19a7a517b4a', NOW(), NOW(), NOW(), '{"mimetype": "image/png", "size": 1234}'),
    ('8f7d643d-1e82-4d39-ae39-d9bd6b0cfe9c', 'bucket2', 'authenticated/move-orig-3.png', '317eadce-631a-4429-a0bb-f19a7a517b4a', NOW(), NOW(), NOW(), '{"mimetype": "image/png", "size": 1234}'),
    ('8377527d-3518-4dc8-8290-c6926470e795', 'bucket2', 'folder/subfolder/public-all-permissions.png', 'd8c7bce9-cfeb-497b-bd61-e66ce2cbdaa2', NOW(), NOW(), NOW(), '{"size": 1234}'),
    ('b39ae4ab-802b-4c42-9271-3f908c34363c', 'bucket2', 'private/sadcat-upload3.png', '317eadce-631a-4429-a0bb-f19a7a517b4a', NOW(), NOW(), NOW(), '{"mimetype": "image/svg+xml", "size": 1234}'),
    ('8098e1ac-c744-4368-86df-71b60ccde221', 'bucket3', 'sadcat-upload3.png', '317eadce-631a-4429-a0bb-f19a7a517b4a', NOW(), NOW(), NOW(), '{"mimetype": "image/svg+xml", "size": 1234}'),
    ('d3eb488e-94f4-46cd-86d3-242c13b95bac', 'bucket3', 'sadcat-upload2.png', '317eadce-631a-4429-a0bb-f19a7a517b4a', NOW(), NOW(), NOW(), '{"mimetype": "image/svg+xml", "size": 1234}');

-- RLS Policies for storage.objects
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
