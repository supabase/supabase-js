INSERT INTO
    public.users (username, status, age_range)
VALUES
    ('supabot', 'ONLINE', '[1,2)'::int4range),
    ('kiwicopple', 'OFFLINE', '[25,35)'::int4range),
    ('awailas', 'ONLINE', '[25,35)'::int4range),
    ('dragarcia', 'ONLINE', '[20,30)'::int4range);

INSERT INTO
    public.channels (slug)
VALUES
    ('public'),
    ('random');

INSERT INTO
    public.messages (message, channel_id, username)
VALUES
    ('Hello World 👋', 1, 'supabot'),
    ('Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.', 2, 'supabot');

INSERT INTO
    personal.users (username, status, age_range)
VALUES
    ('supabot', 'ONLINE', '[1,2)'::int4range),
    ('kiwicopple', 'OFFLINE', '[25,35)'::int4range),
    ('awailas', 'ONLINE', '[25,35)'::int4range),
    ('dragarcia', 'ONLINE', '[20,30)'::int4range),
    ('leroyjenkins', 'ONLINE', '[20,40)'::int4range);