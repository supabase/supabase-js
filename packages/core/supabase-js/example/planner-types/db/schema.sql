-- The schema of the example. Everything here shows up in the types.
-- Run once by the Postgres image (see docker-compose.yml).

create extension if not exists pg_jsonschema with schema extensions;

-- PostgREST features this example uses. `db-config` is on by default, so PostgREST reads these role settings.
alter role authenticator with password 'postgres';
alter role authenticator set pgrst.db_aggregates_enabled to 'true';
alter role authenticator set pgrst.db_anon_role to 'anon';

-- An enum: a union of its labels in the types.
create type public.post_status as enum ('draft', 'published', 'archived');

-- A domain: it resolves to its base type (`string`) in the types.
create domain public.slug as text check (value ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

create table public.authors (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null unique,
  bio text,
  -- A jsonb column with no CHECK: `Json | null`, until src/overrides.ts states its shape with SupabaseColumnTypes.
  socials jsonb
);

create table public.posts (
  id bigint generated always as identity primary key,
  -- Two foreign keys to authors. `author_id` is validated and NOT NULL: its embed is never null.
  author_id bigint not null references public.authors (id),
  -- `editor_id` is NOT NULL too, but its foreign key is added NOT VALID below: Postgres does not promise
  -- that every existing row satisfies it, so its embed is typed as possibly null.
  editor_id bigint not null,
  title text not null,
  slug public.slug not null unique,
  body text not null default '',
  status public.post_status not null default 'draft',
  views integer not null default 0,
  rating numeric(3, 1),
  -- A jsonb column with a JSON Schema CHECK (pg_jsonschema): the CHECK becomes the column's TypeScript type.
  metadata jsonb check (
    metadata is null
    or extensions.jsonb_matches_schema(
      '{
        "type": "object",
        "additionalProperties": false,
        "required": ["tags"],
        "properties": {
          "tags": { "type": "array", "items": { "type": "string" } },
          "featured": { "type": "boolean" },
          "theme": { "enum": ["light", "dark"] },
          "seo": {
            "type": "object",
            "additionalProperties": false,
            "required": ["title"],
            "properties": {
              "title": { "type": "string" },
              "description": { "type": "string" }
            }
          }
        }
      }'::json,
      metadata
    )
  ),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.posts
  add constraint posts_editor_id_fkey foreign key (editor_id) references public.authors (id) not valid;

create table public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts (id) on delete cascade,
  commenter text not null,
  body text not null,
  likes integer not null default 0,
  created_at timestamptz not null default now()
);

-- A view over posts joined with authors. The planner traces it: `author_name` comes from an inner join (never null),
-- `editor_name` from a left join (nullable).
create view public.post_summaries as
select
  p.id,
  p.title,
  p.slug,
  p.status,
  p.views,
  a.name as author_name,
  e.name as editor_name
from public.posts p
join public.authors a on a.id = p.author_id
left join public.authors e on e.id = p.editor_id;

-- A computed field: `select('title, excerpt')` reads it like a column.
create function public.excerpt(p public.posts)
returns text
language sql
stable
as $$ select left(p.body, 40) $$;

-- An RPC returning SETOF posts: embeds and filters work on its rows.
create function public.recent_posts(max_rows integer default 5)
returns setof public.posts
language sql
stable
as $$ select * from public.posts order by created_at desc, id desc limit max_rows $$;

-- A scalar RPC.
create function public.author_post_count(author_id bigint)
returns integer
language sql
stable
as $$ select count(*)::integer from public.posts p where p.author_id = author_post_count.author_id $$;

-- An RPC with an object argument: it can be sent in a POST body, not in a GET query string.
create function public.posts_matching(criteria jsonb)
returns setof public.posts
language sql
stable
as $$ select * from public.posts p where p.metadata @> criteria $$;

-- Overloads, dispatched by the argument names of the call.
create function public.find_posts(term text)
returns setof public.posts
language sql
stable
as $$ select * from public.posts p where p.title ilike '%' || term || '%' $$;

create function public.find_posts(author_id bigint, status public.post_status default null)
returns table (id bigint, title text, views integer)
language sql
stable
as $$
  select p.id, p.title, p.views
  from public.posts p
  where p.author_id = find_posts.author_id and (find_posts.status is null or p.status = find_posts.status)
$$;

-- A single anonymous role, with every right on everything. Plenty for a local demo.
grant usage on schema public to anon;
grant select, insert, update, delete on all tables in schema public to anon;
grant usage on all sequences in schema public to anon;
grant execute on all functions in schema public to anon;
