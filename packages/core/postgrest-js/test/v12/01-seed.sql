-- PostgREST v12 backward compatibility tests seed data
-- TODO (@mandarini): Remove this file when v3 ships (early 2025)

-- Users
INSERT INTO public.users (username, status, age_range, catchphrase, data)
VALUES
    ('supabot', 'ONLINE', '[1,2)'::int4range, 'fat cat'::tsvector, NULL),
    ('kiwicopple', 'OFFLINE', '[25,35)'::int4range, 'cat bat'::tsvector, NULL),
    ('awailas', 'ONLINE', '[25,35)'::int4range, 'bat rat'::tsvector, NULL),
    ('dragarcia', 'ONLINE', '[20,30)'::int4range, 'rat fat'::tsvector, NULL);

-- Channels
INSERT INTO public.channels (slug)
VALUES
    ('public'),
    ('random'),
    ('other');

-- Channel details (one-to-one with channels)
INSERT INTO public.channel_details (id, details)
VALUES
    (1, 'Details for public channel'),
    (2, 'Details for random channel');

-- Messages (multiple per channel - for testing spread on many relation)
INSERT INTO public.messages (message, channel_id, username)
VALUES
    ('Hello World', 1, 'supabot'),
    ('Perfection is attained', 2, 'supabot'),
    ('Some message on channel without details', 3, 'supabot'),
    ('Another message', 1, 'kiwicopple');

-- Personal schema users
INSERT INTO personal.users (username, status, age_range)
VALUES
    ('supabot', 'ONLINE', '[1,2)'::int4range),
    ('kiwicopple', 'OFFLINE', '[25,35)'::int4range);
