import { supabase } from '../client'
import type { Data, Equal, Expect, Status } from '../helpers'
declare const either: 'ONLINE' | 'OFFLINE'
declare const text: string

// 4. eq on an enum column narrows
const f1 = supabase.from('users').select('username, status').eq('status', 'ONLINE')
type _4a = Expect<Equal<Data<typeof f1>, { username: string; status: 'ONLINE' }[]>>

// filter before re-select keeps the fact (read)
const f2 = supabase.from('users').select('username').eq('status', 'ONLINE').select('status')
type _4b = Expect<Equal<Data<typeof f2>, { status: 'ONLINE' }[]>>

// the filter may follow the select too, and the second select re-applies the facts
const f2b = supabase.from('users').select('username').select('status').eq('status', 'ONLINE')
type _4b2 = Expect<Equal<Data<typeof f2b>, { status: 'ONLINE' }[]>>

// alias goes through sources
const f3 = supabase.from('users').select('s:status').eq('status', 'ONLINE')
type _4c = Expect<Equal<Data<typeof f3>, { s: 'ONLINE' }[]>>

// aggregate field has no source: not narrowed
const f4 = supabase.from('users').select('username, status.max()').eq('status', 'ONLINE')
type _4d = Expect<Equal<Data<typeof f4>, { username: string; max: Status | null }[]>>

// union-valued eq
const f5 = supabase.from('users').select('username, status').eq('status', either)
type _4e = Expect<Equal<Data<typeof f5>, { username: string; status: Status }[]>>

// not(col, is, null)
const f6 = supabase.from('users').select('username, status').not('status', 'is', null)
type _4f = Expect<Equal<Data<typeof f6>, { username: string; status: Status }[]>>

// is(col, null)
const f6b = supabase.from('users').select('username, status').is('status', null)
type _4f2 = Expect<Equal<Data<typeof f6b>, { username: string; status: null }[]>>

// in on an enum column
const f6c = supabase.from('users').select('status').in('status', ['ONLINE'])
type _4f3 = Expect<Equal<Data<typeof f6c>, { status: 'ONLINE' }[]>>

// not(col, other op) and neq don't narrow
const f6d = supabase.from('users').select('status').neq('status', 'ONLINE').not('status', 'eq', 'x')
type _4f4 = Expect<Equal<Data<typeof f6d>, { status: Status | null }[]>>

// eq on a text column does not narrow
const f7 = supabase.from('users').select('username, age_range').eq('age_range', 'young')
type _4g = Expect<Equal<Data<typeof f7>, { username: string; age_range: string | null }[]>>
const f7b = supabase.from('users').select('username, age_range').eq('age_range', text)
type _4g2 = Expect<Equal<Data<typeof f7b>, { username: string; age_range: string | null }[]>>
// nor on a number column
const f7c = supabase.from('messages').select('id').eq('id', 1)
type _4g3 = Expect<Equal<Data<typeof f7c>, { id: number }[]>>

// the fact reaches only matching fields; a column not in the select is simply unused
const f8 = supabase.from('users').select('username').eq('status', 'ONLINE')
type _4h = Expect<Equal<Data<typeof f8>, { username: string }[]>>

// facts accumulate: eq then not-null, and not-null then eq
const f9 = supabase.from('users').select('status').eq('status', either).not('status', 'is', null)
type _4i = Expect<Equal<Data<typeof f9>, { status: Status }[]>>
const f9b = supabase
  .from('users')
  .select('status')
  .not('status', 'is', null)
  .eq('status', 'OFFLINE')
type _4i2 = Expect<Equal<Data<typeof f9b>, { status: 'OFFLINE' }[]>>

// or / match style filters don't narrow
const f10 = supabase.from('users').select('status').or('status.eq.ONLINE')
type _4j = Expect<Equal<Data<typeof f10>, { status: Status | null }[]>>

// facts NOT applied on mutations: update(...).eq(...).select(...)
const m1 = supabase
  .from('users')
  .update({ status: 'OFFLINE' })
  .eq('status', 'ONLINE')
  .select('status')
type _4k = Expect<Equal<Data<typeof m1>, { status: Status | null }[]>>
const m2 = supabase
  .from('users')
  .update({ status: 'OFFLINE' })
  .select('status')
  .not('status', 'is', null)
type _4k2 = Expect<Equal<Data<typeof m2>, { status: Status | null }[]>>
const m3 = supabase.from('users').delete().eq('status', 'ONLINE').select('status')
type _4k3 = Expect<Equal<Data<typeof m3>, { status: Status | null }[]>>

// eq value is still checked against the column type
// @ts-expect-error Argument of type '"AWAY"' is not assignable to parameter of type
supabase.from('users').select('status').eq('status', 'AWAY')
// @ts-expect-error Argument of type 'string' is not assignable to parameter of type
supabase.from('users').select('status').eq('status', text)
