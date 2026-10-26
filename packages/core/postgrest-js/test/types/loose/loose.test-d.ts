import { supabase } from '../client'
import type { Data, Equal, Expect, Status } from '../helpers'
declare const full: boolean
declare const cols: string

// 1. planned | unplanned accepted in loose mode
const pu = supabase.from('users').select(full ? 'username' : 'username, nope2')
type _1l = Expect<Equal<Data<typeof pu>[number]['username'], string>>

// an unindexed literal: the Database row, any other key `any` (see database-fallback)
const un = supabase.from('users').select('username, catchphrase, age_range')
type _1l2 = Expect<Equal<Data<typeof un>[number]['catchphrase'], string | null>>
const r: unknown = un.then((x) => (x.error ? undefined : x.data[0]?.whatever))

// 6. missing operand entry: value unknown (anything goes)
supabase.from('messages').select('id, channels(id)').eq('channels.slug', 'x')
supabase.from('messages').select('id, channels(id)').eq('channels.slug', 5)
// `.match` takes the same unindexed operand, any value
supabase.from('messages').select('id, channels(id)').match({ 'channels.slug': 5 })
// ... and a filter the planner can't place widens every left-joined to-one embed (7)
const mo = supabase.from('messages').select('id, channels(id)').eq('channels.slug', 'x')
type _6l = Expect<Equal<Data<typeof mo>, { id: number; channels: { id: number } | null }[]>>

// 8. wrong key set: the arguments are checked against the Database's Args, so it is rejected
// @ts-expect-error Argument of type
supabase.rpc('get_status', { nam: 'x' })
// 10. escape hatch also fine
const esc = supabase.from('users').select(cols).cast<{ id: number }>()
type _10l = Expect<Equal<Data<typeof esc>, { id: number }[]>>
// a mutation select that isn't indexed
const mu = supabase.from('users').update({ username: 'x' }).select('catchphrase')
type _1l3 = Expect<Equal<Data<typeof mu>[number]['catchphrase'], string | null>>

// 3. an rpc key set / method with no planned call: accepted, data is the Database's `Returns`
const lp = supabase.rpc('find_partial', { cid: 1, search: 'x' })
type _3l1 = Expect<Equal<Data<typeof lp>[number]['channel_id'], number>>
// a union of key sets where one is planned: the planned rows or the Database's
declare const optionalSearch: { cid: number; search?: string }
const lq = supabase.rpc('find_partial', optionalSearch)
type _3l2 = Expect<Equal<Data<typeof lq>[number]['id'], number>>
// a re-select on an unplanned call reads the Database's `Returns` rows like a relation's: known keys keep their types
const lr = supabase.rpc('find_partial', { cid: 1, search: 'x' }).select('id')
type _3l4 = Expect<Equal<Data<typeof lr>[number]['channel_id'], number>>
type _3l4b = Expect<Equal<Data<typeof lr>[number]['nope'], any>>
// a method with no planned call
// the matched call's method is exact: a call planned only for POST is unplanned under `{ get: true }`
const lg = supabase.rpc('post_only', { n: 1 }, { get: true })
type _3l5 = Expect<Equal<Data<typeof lg>, string>>
const lh = supabase.rpc('get_user_messages', { user_name: 'x' }, { head: true })
type _3l3 = Expect<Equal<Data<typeof lh>, null>>
supabase.rpc('get_user_messages', { user_name: 'x' }, { get: true })
// no cid at all: not in the Database's Args
// @ts-expect-error Argument of type
supabase.rpc('find_messages', { search: 'x' })

// 7. a non-plain column with no operand entry: value unknown, every left-joined to-one embed widens
const lc = supabase.rpc('find_partial', { cid: 1 }).eq('channels.id', 1)
const lo = supabase.from('messages').select('id, channels(id)').eq('channels.nope', { any: 1 })
type _7l = Expect<Equal<Data<typeof lo>, { id: number; channels: { id: number } | null }[]>>
// the operand of an rpc with no entry for the matching call
supabase.rpc('find_messages', { cid: 1 }).eq('channels.nope', 1)

// a scalar rpc has `source: never`: no plain column to type, the operand is unknown and the data is untouched
const scl = supabase.rpc('get_status', { name_param: 'x' }).eq('username', 1)
type _15l = Expect<Equal<Data<typeof scl>, Status | null>>
