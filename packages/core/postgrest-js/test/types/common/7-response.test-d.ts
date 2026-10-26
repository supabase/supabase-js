import { supabase } from '../client'
import type { Count, Data, Equal, Expect, Status } from '../helpers'

// HEAD
const h = supabase.from('users').select('username', { head: true })
type _7a = Expect<Equal<Data<typeof h>, null>>
type _7a2 = Expect<Equal<Count<typeof h>, null>>
const hc = supabase.from('users').select('username', { head: true, count: 'exact' })
type _7b = Expect<Equal<Data<typeof hc>, null>>
type _7b2 = Expect<Equal<Count<typeof hc>, number>>
const c = supabase.from('users').select('username', { count: 'exact' })
type _7c = Expect<Equal<Data<typeof c>, { username: string }[]>>
type _7c2 = Expect<Equal<Count<typeof c>, number>>

// the failure arm is kept
const failing = supabase.from('users').select('username')
type _7d = Expect<
  Equal<Awaited<typeof failing>['error'], import('../../../src/index').PostgrestError | null>
>

// mutation without select: return=minimal -> data null
const i = supabase.from('users').insert({ username: 'x' })
type _7e = Expect<Equal<Data<typeof i>, null>>
const u = supabase.from('users').update({ status: 'ONLINE' }).eq('username', 'x')
type _7f = Expect<Equal<Data<typeof u>, null>>
const d = supabase.from('users').delete().eq('username', 'x')
type _7f2 = Expect<Equal<Data<typeof d>, null>>
// with select: representation rows
const is = supabase.from('users').insert({ username: 'x' }).select('status')
type _7g = Expect<Equal<Data<typeof is>, { status: Status | null }[]>>
const is1 = supabase.from('users').insert({ username: 'x' }).select('status').single()
type _7g2 = Expect<Equal<Data<typeof is1>, { status: Status | null }>>
// insert values are checked
// @ts-expect-error Argument of type '{ status: "ONLINE"; }' is not assignable to parameter of type
supabase.from('users').insert({ status: 'ONLINE' })

// single / maybeSingle
const s = supabase.from('users').select('username').single()
type _7h = Expect<Equal<Data<typeof s>, { username: string }>>
const ms = supabase.from('users').select('username').maybeSingle()
type _7i = Expect<Equal<Data<typeof ms>, { username: string } | null>>

// csv
const csv = supabase.from('users').select('username').csv()
type _7j = Expect<Equal<Data<typeof csv>, string>>

// stripNulls
const sn = supabase.from('users').select('username, status').stripNulls()
type _7k = Expect<Equal<Data<typeof sn>, { username: string; status?: Status }[]>>
const sn2 = supabase.from('users').select('username, status').stripNulls().single()
type _7l = Expect<Equal<Data<typeof sn2>, { username: string; status?: Status }>>
// after facts: widened embed becomes optional
const sn3 = supabase.from('messages').select('id, channels(id)').eq('channels.id', 1).stripNulls()
type _7m = Expect<Equal<Data<typeof sn3>, { id: number; channels?: { id: number } }[]>>
// stripNulls before the filter: same
const sn4 = supabase.from('users').select('username, status').stripNulls().eq('status', 'ONLINE')
type _7n = Expect<Equal<Data<typeof sn4>, { username: string; status: 'ONLINE' }[]>>
// cast then single
declare const cols: string
const cs = supabase.from('users').select(cols).cast<{ id: number }>().single()
type _7o = Expect<Equal<Data<typeof cs>, { id: number }>>
const cm = supabase.from('users').select(cols).cast<{ id: number }>()
type _7p = Expect<Equal<Data<typeof cm>, { id: number }[]>>
