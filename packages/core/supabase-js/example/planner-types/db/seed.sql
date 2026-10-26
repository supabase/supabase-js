insert into public.authors (name, email, bio, socials) values
  ('Ada Lovelace', 'ada@example.com', 'Wrote the first program.', '{"github": "ada", "mastodon": "@ada@example.social"}'),
  ('Grace Hopper', 'grace@example.com', null, null),
  ('Linus Pauling', 'linus@example.com', 'Two Nobel prizes.', '{"github": "linus"}');

insert into public.posts (author_id, editor_id, title, slug, body, status, views, rating, metadata, published_at) values
  (1, 2, 'Notes on the Analytical Engine', 'analytical-engine', 'Notes on the engine, with a long enough body to cut an excerpt out of it.', 'published', 1200, 4.8,
    '{"tags": ["history", "math"], "featured": true, "theme": "dark", "seo": {"title": "The Analytical Engine", "description": "A first look"}}', now() - interval '30 days'),
  (1, 3, 'On Bernoulli numbers', 'bernoulli-numbers', 'Computing Bernoulli numbers by machine.', 'published', 640, 4.2,
    '{"tags": ["math"], "seo": {"title": "Bernoulli numbers"}}', now() - interval '20 days'),
  (2, 1, 'The first compiler', 'first-compiler', 'A compiler turns a language people read into one machines run.', 'published', 2100, 4.9,
    '{"tags": ["compilers", "history"], "featured": true, "theme": "light"}', now() - interval '10 days'),
  (2, 1, 'COBOL for everyone', 'cobol-for-everyone', 'Why a business language should read like English.', 'draft', 15, null,
    '{"tags": ["cobol"]}', null),
  (3, 2, 'Vitamin C and the common cold', 'vitamin-c', 'A claim that deserves a careful reading.', 'archived', 90, 2.5,
    null, now() - interval '200 days'),
  (3, 3, 'The nature of the chemical bond', 'chemical-bond', 'Resonance, hybridisation and electronegativity.', 'published', 480, null,
    '{"tags": ["chemistry"], "seo": {"title": "The chemical bond", "description": "Resonance explained"}}', now() - interval '5 days');

insert into public.comments (post_id, commenter, body, likes) values
  (1, 'charles', 'Marvellous.', 12),
  (1, 'augusta', 'Thank you.', 3),
  (1, 'mary', 'Could you explain the loop?', 0),
  (2, 'charles', 'Where is the proof?', 4),
  (3, 'alan', 'A turning point.', 25),
  (3, 'edsger', 'But does it halt?', 8),
  (6, 'dorothy', 'Beautifully put.', 2);
