import { supabase } from '../client'
import type { Json } from '../fixture/db'
import type { Data, Equal, Expect, Theme } from '../helpers'
declare const flag: boolean

// 1. a union of relations: every (relation, select) pair is looked up; one rejection rejects the argument
// users has no channels: the `users` entry is { error }
// @ts-expect-error PGRST200 at `channels`: Could not find a relationship between 'users' and 'channels' in the schema cache.
supabase.from(flag ? 'messages' : 'users').select('id, channels(id)')
// order of the union doesn't matter
// @ts-expect-error PGRST200 at `channels`: Could not find a relationship between 'users' and 'channels' in the schema cache.
supabase.from(flag ? 'users' : 'messages').select('id, channels(id)')
// the same on a re-select
supabase
  .from(flag ? 'messages' : 'users')
  .select('username')
  // @ts-expect-error PGRST200 at `channels`: Could not find a relationship between 'users' and 'channels' in the schema cache.
  .select('id, channels(id)')
// and through a literal union of selects
declare const full: boolean
// @ts-expect-error PGRST200 at `channels`: Could not find a relationship between 'users' and 'channels' in the schema cache.
supabase.from(flag ? 'messages' : 'users').select(full ? 'username, data' : 'id, channels(id)')

// both entries are { row }: the rows are the union (each relation's own entry)
const both = supabase.from(flag ? 'messages' : 'users').select('username, data')
type _10a = Expect<
  Equal<
    Data<typeof both>,
    ({ username: string; data: Json | null } | { username: string; data: Theme | null })[]
  >
>
// a union of relations with a union of selects: the cross product
const cross = supabase
  .from(flag ? 'messages' : 'users')
  .select(full ? 'username, data' : 'username')
type _10b = Expect<
  Equal<
    Data<typeof cross>,
    (
      | { username: string; data: Json | null }
      | { username: string; data: Theme | null }
      | { username: string }
    )[]
  >
>
