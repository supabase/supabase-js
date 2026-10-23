import { supabase } from '../client'
import type { Count, Data, Equal, Expect, Status } from '../helpers'
declare const pick: { a: string } | { b: number }
declare const pickAll: { a: string } | { b: number } | {}
declare const flag: boolean
declare const text: string | undefined

// 3. A distributes: each member of an argument union is dispatched on its own, data is the union
const u = supabase.rpc('poly', pick)
type _12a = Expect<Equal<Data<typeof u>, ({ a_id: number } | { b_name: string })[]>>
// ... and the rows of one member keep their own form
const um = supabase.rpc('poly_mixed', pick)
type _12b = Expect<Equal<Data<typeof um>, { a_id: number }[] | string>>
// a member that is a plain object literal still works on its own
const ua = supabase.rpc('poly', { a: 'x' })
type _12c = Expect<Equal<Data<typeof ua>, { a_id: number }[]>>
// zero-arg: the `never` key set
const uz = supabase.rpc('poly')
type _12d = Expect<Equal<Data<typeof uz>, number>>
// a union with the empty object dispatches the `never` call too
const ue = supabase.rpc('poly', pickAll)
type _12e = Expect<Equal<Data<typeof ue>, ({ a_id: number } | { b_name: string })[] | number>>
// one member's call is { error }: TS2345 on args, however the others do
// @ts-expect-error PGRST202 Could not find the function public.poly_err(b) in the schema cache
supabase.rpc('poly_err', pick)
// @ts-expect-error PGRST202 Could not find the function public.poly_err(b) in the schema cache
supabase.rpc('poly_err', { b: 1 })
supabase.rpc('poly_err', { a: 'x' })
// value types come from the routines (the union of every overload's Args)
// @ts-expect-error Argument of type '[{ a: number; }]' is not assignable to parameter of type
supabase.rpc('poly', { a: 1 })

// SureKeys / MaybeKeys: `{ cid: number; search?: string }` has two possible key sets
declare const optional: { cid: number; search?: string }
const o = supabase.rpc('find_messages', optional)
type _12f = Expect<Equal<Data<typeof o>, ({ id: number } | { id: number; rank: number })[]>>
// a literal without the optional key has exactly one
const o1 = supabase.rpc('find_messages', { cid: 1 })
type _12g = Expect<Equal<Data<typeof o1>, { id: number }[]>>
const o2 = supabase.rpc('find_messages', { cid: 1, search: 'x' })
type _12h = Expect<Equal<Data<typeof o2>, { id: number; rank: number }[]>>
// a required key whose value may be undefined is a maybe-key too
declare const undef: { cid: number; search: string | undefined }
const o3 = supabase.rpc('find_messages', undef)
type _12i = Expect<Equal<Data<typeof o3>, ({ id: number } | { id: number; rank: number })[]>>
// ... while a literal value that can't be undefined is sure
const o4 = supabase.rpc('find_messages', { cid: 1, search: text ?? 'x' })
type _12j = Expect<Equal<Data<typeof o4>, { id: number; rank: number }[]>>
const o5 = supabase.rpc('find_messages', { cid: 1, search: text })
type _12k = Expect<Equal<Data<typeof o5>, ({ id: number } | { id: number; rank: number })[]>>
// a key set with no planned call follows the policy (loose.ts: rows Record<string, unknown>, strict.ts: TS2345)

// more than 6 maybe-keys: dynamic, data unknown, args accepted
declare const many: {
  a?: number
  b?: number
  c?: number
  d?: number
  e?: number
  f?: number
  g?: number
}
const dyn = supabase.rpc('many_optional', many)
type _12l = Expect<Equal<Data<typeof dyn>, unknown>>

// methods: `{ head: true }` sends HEAD, data null
const hp = supabase.rpc('ping', { n: 1 }, { head: true })
type _12m = Expect<Equal<Data<typeof hp>, null>>
// `{ head: boolean }` -> HEAD | POST: both are planned for ping, data null
const hb = supabase.rpc('ping', { n: 1 }, { head: flag })
type _12n = Expect<Equal<Data<typeof hb>, null>>
// `{ get: boolean }` -> GET | POST, both planned for get_status: the union
const gb = supabase.rpc('get_status', { name_param: 'x' }, { get: flag })
type _12o = Expect<Equal<Data<typeof gb>, Status | null>>
const gt = supabase.rpc('get_status', { name_param: 'x' }, { get: true })
type _12p = Expect<Equal<Data<typeof gt>, Status>>
const gf = supabase.rpc('get_status', { name_param: 'x' }, { get: false })
type _12q = Expect<Equal<Data<typeof gf>, Status | null>>
// head wins over get
const hg = supabase.rpc('ping', { n: 1 }, { head: true, get: true })
type _12r = Expect<Equal<Data<typeof hg>, null>>

// 4. rpc operand entries: the value type is the union over the possible calls
supabase.rpc('find_messages', { cid: 1 }).eq('channels.id', 1)
// only `cid` is possible: its call says number
// @ts-expect-error Argument of type 'string' is not assignable to parameter of type
supabase.rpc('find_messages', { cid: 1 }).eq('channels.id', 'x')
// `cid` or `cid | search`: number | string
supabase.rpc('find_messages', optional).eq('channels.id', 1)
supabase.rpc('find_messages', optional).eq('channels.id', 'x')
// neither call says boolean
// @ts-expect-error Argument of type 'boolean' is not assignable to parameter of type
supabase.rpc('find_messages', optional).eq('channels.id', true)
// the exact `cid | search` call alone says string
supabase.rpc('find_messages', { cid: 1, search: 'x' }).eq('channels.id', 'x')
// @ts-expect-error Argument of type 'number' is not assignable to parameter of type
supabase.rpc('find_messages', { cid: 1, search: 'x' }).eq('channels.id', 1)
// an { error } call rejects the column: only when its key set is possible
supabase.rpc('find_messages', { cid: 1 }).eq('channels.slug', 'x')
// @ts-expect-error PGRST108 at `channels`: 'channels' is not an embedded resource in this request.
supabase.rpc('find_messages', optional).eq('channels.slug', 'x')
// @ts-expect-error PGRST108 at `channels`: 'channels' is not an embedded resource in this request.
supabase.rpc('find_messages', { cid: 1, search: 'x' }).eq('channels.slug', 'x')
// ... for every operator that names it
// @ts-expect-error PGRST108 at `channels`: 'channels' is not an embedded resource in this request.
supabase.rpc('find_messages', optional).not('channels.slug', 'is', null)
// the operand's embed path widens, but `*` has no embed to widen: rows unchanged
const ow = supabase.rpc('find_messages', { cid: 1 }).eq('channels.id', 1)
type _12s = Expect<Equal<Data<typeof ow>, { id: number }[]>>

// 8. facts on rpc: filters narrow the returned rows (identity sources over the returned relation for `*`)
const on = supabase.rpc('get_online_users').eq('status', 'ONLINE')
declare const onv: Data<typeof on>[number]['status']
type _12t = Expect<Equal<typeof onv, 'ONLINE'>>
const nn = supabase.rpc('get_online_users').not('status', 'is', null)
declare const nnv: Data<typeof nn>[number]['status']
type _12u = Expect<Equal<typeof nnv, Status>>
const isn = supabase.rpc('get_online_users').is('status', null)
declare const isv: Data<typeof isn>[number]['status']
type _12v = Expect<Equal<typeof isv, null>>
// through a single / maybeSingle
const sg = supabase.rpc('get_online_users').eq('status', 'OFFLINE').limit(1).single()
declare const sgv: Data<typeof sg>['status']
type _12w = Expect<Equal<typeof sgv, 'OFFLINE'>>
// an rpc re-select with `*` re-keys f|...|* and keeps the facts
const rs = supabase.rpc('get_online_users').eq('status', 'ONLINE').select()
declare const rsv: Data<typeof rs>[number]['status']
type _12x = Expect<Equal<typeof rsv, 'ONLINE'>>
// facts accumulate across both orders
const rs2 = supabase.rpc('get_online_users').select('*').eq('status', 'ONLINE')
declare const rsv2: Data<typeof rs2>[number]['status']
type _12y = Expect<Equal<typeof rsv2, 'ONLINE'>>
// the value is still checked against the returned relation
// @ts-expect-error Argument of type '"AWAY"' is not assignable to parameter of type
supabase.rpc('get_online_users').eq('status', 'AWAY')
// every method gets facts: GET and HEAD-or-POST too (HEAD data is null)
declare const hq: Data<ReturnType<typeof headRpc>>
function headRpc() {
  return supabase.rpc('get_online_users', {}, { get: true }).eq('status', 'ONLINE')
}
type _12z = Expect<Equal<NonNullable<typeof hq>[number]['status'], 'ONLINE'>>
// a scalar rpc has no row to narrow, and the filter doesn't break it
const sc = supabase.rpc('get_status', { name_param: 'x' }).maybeSingle()
type _12aa = Expect<Equal<Data<typeof sc>, Status | null>>

// facts still don't apply on mutations
const m = supabase.from('users').update({ status: 'OFFLINE' }).eq('status', 'ONLINE').select()
declare const mv: Data<typeof m>[number]['status']
type _12ab = Expect<Equal<typeof mv, Status | null>>
type _count = Count<typeof m>
