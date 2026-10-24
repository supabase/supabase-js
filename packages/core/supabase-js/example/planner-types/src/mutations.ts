import { supabase } from './client'

// Writes are typed from the table: `Insert` requires only the columns that are NOT NULL with no default (identity
// and generated columns are left out), `Update` makes everything optional, and a `.select()` after the write is
// planned like a read. Each run uses a fresh slug so the demo can run many times.

export async function mutations() {
  const slug = `demo-${Date.now()}`

  // HOVER `inserted`. The insert payload needs `author_id`, `editor_id`, `title` and `slug` (the NOT NULL columns
  // with no default); the other columns are optional and `id` is not accepted (a GENERATED ALWAYS identity). `.select('id, title, status')` plans the returned row; `.single()` makes it one row.
  const { data: inserted } = await supabase
    .from('posts')
    .insert({ author_id: 1, editor_id: 2, title: 'A demo post', slug })
    .select('id, title, status')
    .single()

  // A missing required column is a compile error.
  // @ts-expect-error `slug` is required: NOT NULL with no default
  supabase.from('posts').insert({ author_id: 1, editor_id: 2, title: 'No slug' })
  // The metadata CHECK is a type: `tags` is required and `theme` is a union.
  // @ts-expect-error 'blue' is not a theme allowed by the JSON Schema CHECK
  supabase.from('posts').update({ metadata: { tags: [], theme: 'blue' } })

  // HOVER `updated`. `.maybeSingle()`: `{ id, views } | null`, since no row may match the filter.
  const { data: updated } = await supabase
    .from('posts')
    .update({ views: 42, status: 'published', published_at: new Date().toISOString() })
    .eq('slug', slug)
    .select('id, views')
    .maybeSingle()

  // HOVER `upserted`. `upsert` takes the same payload as `insert`; `onConflict` names the unique column. An embed
  // in the response of a write is typed nullable (`author` is `{ name: string } | null`, where a read of the same
  // select has it non-null): the planner does not carry the read's guarantee over to a write response.
  const { data: upserted } = await supabase
    .from('posts')
    .upsert(
      { author_id: 1, editor_id: 2, title: 'Renamed demo post', slug },
      { onConflict: 'slug' }
    )
    .select('title, author:authors!author_id(name)')
    .single()

  // HOVER `counted`. `{ count: 'exact', head: true }` sends a HEAD request: `data` is `null`, `count` is the number.
  const counted = await supabase.from('posts').select('id', { count: 'exact', head: true })

  // HOVER `csv`. `.csv()` turns the result into a `string`.
  const { data: csv } = await supabase.from('authors').select('name, email').csv()

  // Clean up the demo row.
  await supabase.from('posts').delete().eq('slug', slug)

  return { inserted, updated, upserted, count: counted.count, countData: counted.data, csv }
}
