import { supabase } from '../client'
import type { Data, Equal, Expect } from '../helpers'
declare const full: boolean
declare const cols: string

// 1. planned | unplanned rejected in strict mode
// @ts-expect-error not indexed by @supabase/postgrest-mapper: the scanner couldn't connect this select to a relation in the same file. Call
supabase.from('users').select(full ? 'username' : 'username, nope2')
// an unindexed literal on its own
// @ts-expect-error not indexed by @supabase/postgrest-mapper: the scanner couldn't connect this select to a relation in the same file
supabase.from('users').select('username, catchphrase, age_range')
// ... on a mutation
// @ts-expect-error not indexed by @supabase/postgrest-mapper: the scanner couldn't connect this select to a relation in the same file. Call
supabase.from('users').update({ username: 'x' }).select('catchphrase')

// planned, '*' and dynamic still fine
supabase.from('users').select('username')
supabase.from('users').select('*')
supabase.from('users').select()
supabase.from('users').select(cols)

// 6. missing operand entry rejected
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no operand entry for this column in this select. Check the scanner resolved t
supabase.from('messages').select('id, channels(id)').eq('channels.slug', 'x')
// plain columns, dynamic columns and indexed operands are fine
supabase.from('messages').select('id, channels(id)').eq('channel_id', 1).eq('channels.id', 1)
supabase.from('messages').select('id, channels(id)').eq('channels.id', 1).eq(cols, 1)

// 8. wrong key set rejected on args
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no planned call matches this rpc name, argument key set and method
supabase.rpc('get_status', { nam: 'x' })
// no args at all: the rejection lands on the function name
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no planned call matches this rpc name, argument key set and method
supabase.rpc('get_status')

// 10. a rejected literal can't be rescued by cast; widening the argument can
// @ts-expect-error not indexed by @supabase/postgrest-mapper: the scanner couldn't connect this select to a relation in the same file. Call
supabase.from('users').select('id, nope').cast<{ id: number }>()
const esc = supabase
  .from('users')
  .select(cols as string)
  .cast<{ id: number }>()
type _10s = Expect<Equal<Data<typeof esc>, { id: number }[]>>
const esc1 = supabase
  .from('users')
  .select(cols as string)
  .cast<{ id: number }>()
  .single()
type _10s2 = Expect<Equal<Data<typeof esc1>, { id: number }>>

// an rpc re-select with no f|...|<q> entry is unplanned too
// @ts-expect-error not indexed by @supabase/postgrest-mapper: the scanner couldn't connect this select to a relation in the same file. Call
supabase.rpc('get_status', { name_param: 'x' }).select('id')

// 3. rpc: a key set or method with no planned call is TS2345 on args (or on the name with none)
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no planned call matches this rpc name, argument key set and method
supabase.rpc('find_partial', { cid: 1, search: 'x' })
declare const optionalSearch: { cid: number; search?: string }
// one possible key set of the union is unplanned
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no planned call matches this rpc name, argument key set and method
supabase.rpc('find_partial', optionalSearch)
supabase.rpc('find_partial', { cid: 1 })
// cid is required
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no planned call matches this rpc name, argument key set and method
supabase.rpc('find_messages', { search: 'x' })
// no HEAD / GET call planned
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no planned call matches this rpc name, argument key set and method
supabase.rpc('get_user_messages', { user_name: 'x' }, { head: true })
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no planned call matches this rpc name, argument key set and method
supabase.rpc('get_user_messages', { user_name: 'x' }, { get: true })
// a call planned only for POST is unplanned under GET: the method is exact
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no planned call matches this rpc name, argument key set and method
supabase.rpc('post_only', { n: 1 }, { get: true })
// head: boolean may send POST or HEAD: both must be planned
declare const maybeHead: boolean
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no planned call matches this rpc name, argument key set and method
supabase.rpc('get_user_messages', { user_name: 'x' }, { head: maybeHead })
supabase.rpc('ping', { n: 1 }, { head: maybeHead })
// planned methods are fine
supabase.rpc('ping', { n: 1 }, { head: true })
supabase.rpc('get_status', { name_param: 'x' }, { get: true })
supabase.rpc('get_online_users', {}, { get: true })
// a call that is an { error } rejects, whichever other members of the union are fine
// @ts-expect-error PGRST202 Could not find the function public.poly_err(b) in the schema cache
supabase.rpc('poly_err', { b: 1 })
// more than 6 maybe-keys is dynamic: nothing to reject
declare const many: {
  a?: number
  b?: number
  c?: number
  d?: number
  e?: number
  f?: number
  g?: number
}
supabase.rpc('many_optional', many)

// 4. rpc operand with no call entry for the possible key set
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no operand entry for this column in this select. Check the scanner resolved t
supabase.rpc('find_partial', { cid: 1 }).eq('channels.slug', 'x')
supabase.rpc('find_partial', { cid: 1 }).eq('channels.id', 1)

// 7. a non-plain filter column with no operand entry is rejected (rpc: no entry at all)
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no operand entry for this column in this select. Check the scanner resolved t
supabase.from('messages').select('id, channels(id)').eq('channels.nope', 1)
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no operand entry for this column in this select. Check the scanner resolved t
supabase.from('messages').select('id, ...channels(channel_key:id)').eq('channel_key', 1)
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no operand entry for this column in this select. Check the scanner resolved t
supabase.rpc('find_messages', { cid: 1 }).eq('channels.nope', 1)

// 2. head does not rescue an unplanned select
// @ts-expect-error not indexed by @supabase/postgrest-mapper: the scanner couldn't connect this select to a relation in the same file
supabase.from('users').select('username, catchphrase, age_range', { head: true })
supabase.from('users').select('username', { head: true })

// NeverKeys: `{ name_param: undefined }` sends nothing, and the empty key set has no planned call
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no planned call matches this rpc name, argument key set and method
supabase.rpc('get_status', { name_param: undefined })
// a scalar rpc has `source: never`: no column a plain filter could name
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no operand entry for this column in this select. Check the scanner resolved t
supabase.rpc('get_status', { name_param: 'x' }).eq('username', 'x')
