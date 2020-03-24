INSERT INTO
    public.users (username, status)
VALUES
    ('supabot', 'ONLINE'),
    ('kiwicopple', 'OFFLINE'),
    ('awailas', 'ONLINE'),
    ('dragarcia', 'ONLINE');

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