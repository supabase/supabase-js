import { supabase } from './client'

// Every chain below is a plain supabase-js call. `postgrest-mapper` finds it in this file, asks the real PostgREST
// planner what it returns, and writes the answer into src/supabase.types.d.ts. Hover the variable on the left
// of each `await` to see what the planner derived.

export async function selects() {
  // --- To-one embeds: the validated foreign key against the NOT VALID one ----------------------------------------

  // HOVER `embeds`. `author` is `{ name: string }`, never null: posts.author_id is NOT NULL and its foreign key is
  // validated. `editor` is `{ name: string } | null`: posts.editor_id is NOT NULL too, but its foreign key is NOT
  // VALID, so Postgres does not promise the row exists and the planner types the embed as nullable.
  const { data: embeds } = await supabase
    .from('posts')
    .select('title, author:authors!author_id(name), editor:authors!editor_id(name)')

  // --- To-many embed, aliases, spread, !inner -------------------------------------------------------------------

  // HOVER `toMany`. `comments` is an array (a to-many embed); `heading` is the aliased `title`.
  const { data: toMany } = await supabase
    .from('posts')
    .select('id, heading:title, comments(commenter, likes)')

  // HOVER `spread`. `...authors!author_id(name, email)` merges the author's columns into the post row.
  const { data: spread } = await supabase
    .from('posts')
    .select('title, ...authors!author_id(name, email)')

  // HOVER `inner`. `!inner` makes the embed an inner join: posts without comments are left out of the result.
  const { data: inner } = await supabase.from('posts').select('title, comments!inner(commenter)')

  // --- Aggregates (PostgREST `db-aggregates-enabled`, set in db/schema.sql) ---------------------------------------

  // HOVER `aggregates`. `count()` is a number; `sum` and `avg` follow the Postgres result type of the column.
  const { data: aggregates } = await supabase
    .from('posts')
    .select('status, views.sum(), rating.avg(), count()')

  // HOVER `embeddedCount`. An aggregate on an embedded relation: how many comments each post has.
  const { data: embeddedCount } = await supabase.from('posts').select('title, comments(count)')

  // --- Casts and JSON paths --------------------------------------------------------------------------------------

  // HOVER `casts`. `views::text` is a `string`: the cast replaces the column's type.
  const { data: casts } = await supabase.from('posts').select('title, views::text')

  // HOVER `jsonPath`. `metadata` has a JSON Schema CHECK (pg_jsonschema), so its TypeScript type is that schema.
  // `seo_title` reads into it with a JSON path (`->seo->>title`): hover it to see a `PgrstJsonText<Schema, ['seo',
  // 'title']>`, which the type system resolves to the text at that path (`string | null`); `tags` is the array.
  const { data: jsonPath } = await supabase
    .from('posts')
    .select('title, metadata, seo_title:metadata->seo->>title, tags:metadata->tags')

  // --- Computed field and view -----------------------------------------------------------------------------------

  // HOVER `computed`. `excerpt` is the SQL function `excerpt(posts)`: PostgREST reads it like a column.
  const { data: computed } = await supabase.from('posts').select('title, excerpt')

  // HOVER `view`. The view `post_summaries` joins posts with authors: `author_name` comes from an inner join,
  // `editor_name` from a left join, and the planner traces that through the view definition.
  const { data: view } = await supabase
    .from('post_summaries')
    .select('title, author_name, editor_name')

  return {
    embeds,
    toMany,
    spread,
    inner,
    aggregates,
    embeddedCount,
    casts,
    jsonPath,
    computed,
    view,
  }
}
