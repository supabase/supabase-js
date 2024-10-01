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
    ('Some message on channel wihtout details', 3, 'supabot'),
    ('Some message on channel wihtout details', 3, 'supabot');

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
