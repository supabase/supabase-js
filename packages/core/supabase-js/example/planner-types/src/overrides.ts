import { supabase } from './client'

// The planner derives types from the database. Three ways to say more, or to cope with what it cannot know.

// --- 1. SupabaseColumnTypes: state the type of a column the database does not describe ------------------------------
// `authors.socials` is a plain jsonb column (no JSON Schema CHECK), so it is `Json | null`. Declaring its shape here
// replaces the type in every select, filter and write payload that reaches the column. Its nullability stays derived:
// the column is nullable, so the result is `Socials | null`.
export interface Socials {
  github?: string
  mastodon?: string
}

declare global {
  interface SupabaseColumnTypes {
    'public.authors.socials': Socials
  }
}

export async function overrides() {
  // HOVER `socials`. `socials` is `Socials | null` instead of `Json | null`.
  const { data: socials } = await supabase.from('authors').select('name, socials')

  // An insert payload checks the override too.
  // @ts-expect-error 'twitter' is not a key of Socials
  supabase.from('authors').insert({ name: 'x', email: 'x@example.com', socials: { twitter: 'x' } })

  // --- 2. .cast<T>(): replace the result type of one call -------------------------------------------------------
  // HOVER `cast`. The planner types each row as `{ id: number; title: string }`. `.cast<Row>()` replaces the row
  // type with one you state, for the cases where you know better than the database. It keeps the shape of the
  // response (an array here, one row after `.single()`), and replaces `.returns<T>()` and `.overrideTypes<T>()`.
  const { data: cast } = await supabase
    .from('posts')
    .select('id, title')
    .cast<{ id: number; title: string; note?: string }>()

  // --- 3. A select the mapper cannot see: the loose fallback ---------------------------------------------------
  // HOVER `dynamic`. The select string is not a literal, so no tool can know it before the program runs: the rows
  // are `unknown` (or loose, depending on `unplanned` in tsconfig.json). The same happens for a literal the
  // generated file does not have yet: the committed src/supabase.types.d.ts is generated from the chains in
  // src/, so a chain you add is loose until `pnpm types` (or `pnpm types:watch`) plans it, then it is precise.
  const columns = ['id', 'title'].join(',')
  const { data: dynamic } = await supabase.from('posts').select(columns)

  return { socials, cast, dynamic }
}
