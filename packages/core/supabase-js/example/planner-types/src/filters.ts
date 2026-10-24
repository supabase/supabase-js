import { supabase } from './client'

// Filters are typed against the column they name: the value must fit the column's type.

export async function filters() {
  // HOVER `eq`. `status` is an enum, so `.eq` accepts only its labels. The result is still `{ title: string }[]`.
  const { data: eq } = await supabase
    .from('posts')
    .select('title')
    .eq('status', 'published')
    .gt('views', 10)

  // A value of the wrong type is a compile error. `pnpm check` proves each rejection is real: if a line stopped
  // failing, its `@ts-expect-error` would fail the check.
  // @ts-expect-error 'announced' is not a post_status
  supabase.from('posts').select('title').eq('status', 'announced')
  // @ts-expect-error views is an integer, not a string
  supabase.from('posts').select('title').eq('views', 'many')

  // --- A filter on an embed --------------------------------------------------------------------------------------

  // HOVER `narrowedEmbed`. A filter on `comments.likes` narrows the comment rows inside each post: every post is
  // kept, only its `comments` array shrinks (`!inner` would drop the posts too).
  const { data: narrowedEmbed } = await supabase
    .from('posts')
    .select('title, comments(commenter, likes)')
    .gte('comments.likes', 2)

  // HOVER `filteredToOne`. Filtering on a column of a to-one embed that is joined with a LEFT join can leave `null`
  // there, so `author`, which is non-null in `embeds` (select.ts), becomes `{ name: string } | null` here.
  const { data: filteredToOne } = await supabase
    .from('posts')
    .select('title, author:authors!author_id(name)')
    .eq('author.name', 'Ada Lovelace')

  // HOVER `notNull`. `.not('editor', 'is', null)` keeps only the posts that have an editor, and the type follows:
  // `editor` is `{ name: string }` again.
  const { data: notNull } = await supabase
    .from('posts')
    .select('title, editor:authors!editor_id(name)')
    .not('editor', 'is', null)

  // --- referencedTable -------------------------------------------------------------------------------------------

  // HOVER `referenced`. `referencedTable` applies an order or a limit to the embedded rows (here: each post keeps
  // its most liked comment). The row type is the embed's, as above.
  const { data: referenced } = await supabase
    .from('posts')
    .select('title, comments(commenter, likes)')
    .order('likes', { referencedTable: 'comments', ascending: false })
    .limit(1, { referencedTable: 'comments' })

  return { eq, narrowedEmbed, filteredToOne, notNull, referenced }
}
