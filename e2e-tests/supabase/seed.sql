-- Consolidated Seed Data for E2E Integration Tests
-- Combines seed data from postgrest-js and storage-js

-- ============================================================================
-- PostgREST Test Data
-- ============================================================================

INSERT INTO
    public.users (username, status, age_range, catchphrase, data)
VALUES
    ('supabot', 'ONLINE', '[1,2)'::int4range, 'fat cat'::tsvector, NULL),
    ('kiwicopple', 'OFFLINE', '[25,35)'::int4range, 'cat bat'::tsvector, NUlL),
    ('awailas', 'ONLINE', '[25,35)'::int4range, 'bat rat'::tsvector, NULL),
    ('dragarcia', 'ONLINE', '[20,30)'::int4range, 'rat fat'::tsvector, NULL),
    ('jsonuser', 'ONLINE', '[20,30)'::int4range, 'json test'::tsvector, '{"foo": {"bar": {"nested": "value"}, "baz": "string value"}}'::jsonb);

INSERT INTO
    public.channels (slug)
VALUES
    ('public'),
    ('random'),
    ('other');

INSERT INTO
    public.messages (message, channel_id, username)
VALUES
    ('Hello World 👋', 1, 'supabot'),
    ('Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.', 2, 'supabot'),
    ('Some message on channel without details', 3, 'supabot'),
    ('Some message on channel without details', 3, 'supabot');

INSERT INTO
    personal.users (username, status, age_range)
VALUES
    ('supabot', 'ONLINE', '[1,2)'::int4range),
    ('kiwicopple', 'OFFLINE', '[25,35)'::int4range),
    ('awailas', 'ONLINE', '[25,35)'::int4range),
    ('dragarcia', 'ONLINE', '[20,30)'::int4range),
    ('leroyjenkins', 'ONLINE', '[20,40)'::int4range);

INSERT INTO shops(id, address, shop_geom)
VALUES
  (1, '1369 Cambridge St', 'SRID=4326;POINT(-71.10044 42.373695)');

INSERT INTO public.channel_details (id, details)
VALUES
    (1, 'Details for public channel'),
    (2, 'Details for random channel');

INSERT INTO user_profiles (id, username)
VALUES
  (1, 'supabot'),
  (2, NULL);

INSERT INTO best_friends(id, first_user, second_user, third_wheel)
VALUES
  (1, 'supabot', 'kiwicopple', 'awailas'),
  (2, 'supabot', 'awailas', NULL);

INSERT INTO public.collections (id, description, parent_id)
VALUES
  (1, 'Root Collection', NULL),
  (2, 'Child of Root', 1),
  (3, 'Another Child of Root', 1),
  (4, 'Grandchild', 2),
  (5, 'Sibling of Grandchild', 2),
  (6, 'Child of Another Root', 3);

-- Insert sample products
INSERT INTO public.products (id, name, description, price)
VALUES
  (1, 'Laptop', 'High-performance laptop', 999.99),
  (2, 'Smartphone', 'Latest model smartphone', 699.99),
  (3, 'Headphones', 'Noise-cancelling headphones', 199.99);

-- Insert sample categories
INSERT INTO public.categories (id, name, description)
VALUES
  (1, 'Electronics', 'Electronic devices and gadgets'),
  (2, 'Computers', 'Computer and computer accessories'),
  (3, 'Audio', 'Audio equipment');

-- Insert product-category relationships
INSERT INTO public.product_categories (product_id, category_id)
VALUES
  (1, 1), -- Laptop is in Electronics
  (1, 2), -- Laptop is also in Computers
  (2, 1), -- Smartphone is in Electronics
  (3, 1), -- Headphones are in Electronics
  (3, 3); -- Headphones are also in Audio

INSERT INTO public.cornercase (id, array_column)
VALUES
  (1, ARRAY['test', 'one']),
  (2, ARRAY['another']),
  (3, ARRAY['test2']);

-- Insert sample hotels
INSERT INTO hotel (id, name)
VALUES
  (1, 'Sunset Resort'),
  (2, 'Mountain View Hotel'),
  (3, 'Beachfront Inn'),
  (4, NULL);

-- Insert bookings with various relationship scenarios
INSERT INTO booking (id, hotel_id)
VALUES
  (1, 1),                -- Valid booking for Sunset Resort
  (2, 1),                -- Another booking for Sunset Resort (duplicate reference)
  (3, 2),                -- Booking for Mountain View Hotel
  (4, NULL),             -- Booking with no hotel (null reference)
  (5, 3),                -- Booking for Beachfront Inn
  (6, 1),                -- Third booking for Sunset Resort
  (7, NULL),             -- Another booking with no hotel
  (8, 4);                -- Booking for hotel with null name

-- Insert users audit
INSERT INTO public.users_audit (id, previous_value)
VALUES
  (1, 42),
  (2, 42),
  (3, 42),
  (4, 42),
  (5, 42);

-- Insert events test data
INSERT INTO public.events (created_at, event_type, data)
VALUES
  ('2024-06-15', 'login', '{"user": "alice"}'),
  ('2025-03-20', 'logout', '{"user": "bob"}');

-- ============================================================================
-- Storage Test Data
-- ============================================================================

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
