import { supabase } from '../client'
import type { Data, Equal, Expect, Status } from '../helpers'
declare const full: boolean

// 1. planned | planned -> union of rows
const pp = supabase.from('users').select(full ? 'username, status' : 'username')
type _1a = Expect<
  Equal<Data<typeof pp>, ({ username: string; status: Status | null } | { username: string })[]>
>

// 1. planned | rejected -> error at the argument
// @ts-expect-error PGRST200 at `nope`: Could not find a relationship between 'users' and 'nope' in the schema cache. Hint: Perhaps you mean
supabase.from('users').select(full ? 'username' : 'username, nope(id)')

// 1. a rejected literal on its own
// @ts-expect-error PGRST200 at `nope`: Could not find a relationship between 'users' and 'nope' in the schema cache. Hint: Perhaps you mean
supabase.from('users').select('username, nope(id)')

// mutation representation rejected too
// @ts-expect-error PGRST200 at `nope`: Could not find a relationship between 'users' and 'nope' in the schema cache.
supabase.from('users').update({ status: 'OFFLINE' }).select('username, nope(id)')

// split chain: select on a builder kept in a const
const base = supabase.from('users')
const sp = base.select('username')
type _1s = Expect<Equal<Data<typeof sp>, { username: string }[]>>
// @ts-expect-error PGRST200 at `nope`: Could not find a relationship between 'users' and 'nope' in the schema cache. Hint: Perhaps you mean
base.select('username, nope(id)')
const sch = supabase.schema('public').from('users').select('username, status')
type _1s2 = Expect<Equal<Data<typeof sch>, { username: string; status: Status | null }[]>>
