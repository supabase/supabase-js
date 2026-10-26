import { supabase } from './client'

// `rpc()` is typed from the function's signature: the name is checked, the argument keys pick the overload, and the
// value types come from the matched signature.

export async function rpcs() {
  // HOVER `recent`. `recent_posts` returns SETOF posts: rows, so `.select()`, embeds and filters work on them like
  // on a table. `max_rows` has a default, so the argument is optional. The function is a single STABLE SQL query
  // over `posts`, so the mapper traces its body: the columns keep their table's NOT NULL constraints and JSON
  // Schema, and the `author` embed is non-null through the validated foreign key. A function the mapper can't trace
  // would type every column `| null`, since Postgres doesn't check a table's constraints on a function's result.
  const { data: recent } = await supabase
    .rpc('recent_posts', { max_rows: 3 })
    .select('id, title, author:authors!author_id(name)')

  // HOVER `count`. A scalar function: `number | null` (a function result can always be null in Postgres).
  const { data: count } = await supabase.rpc('author_post_count', { author_id: 1 })

  // HOVER `byTerm` and `byAuthor`. `find_posts` has two overloads, picked by the argument KEYS:
  // `{ term }` matches `find_posts(term text)` and returns posts; `{ author_id, status }` matches
  // `find_posts(author_id bigint, status post_status)` and returns `{ id, title, views }` rows.
  const { data: byTerm } = await supabase.rpc('find_posts', { term: 'compiler' })
  const { data: byAuthor } = await supabase.rpc('find_posts', { author_id: 1, status: 'published' })

  // The value types come from the matched overload.
  // @ts-expect-error `author_id` is a bigint: a string is not accepted
  supabase.rpc('find_posts', { author_id: 'one' })
  // @ts-expect-error there is no function with this name
  supabase.rpc('no_such_function', {})

  // `posts_matching(criteria jsonb)` is called with a POST (the default): an object argument is fine.
  const { data: matching } = await supabase.rpc('posts_matching', { criteria: { featured: true } })

  // `{ get: true }` sends the arguments in the query string, which cannot carry an object: the planner reports
  // PGRSTJS01 and the call does not compile. Hover the red squiggle: the argument must be the string
  // "GET and HEAD refuse an object value for 'criteria'".
  // @ts-expect-error PGRSTJS01
  supabase.rpc('posts_matching', { criteria: { featured: true } }, { get: true })

  return { recent, count, byTerm, byAuthor, matching }
}
