import { supabase } from '../client'
import type { Count, Data, Equal, Expect, Status } from '../helpers'
declare const head: boolean
declare const maybeCount: 'exact' | undefined

type Row = { username: string }
// 2. ReadMethod<O>: `{ head: boolean }` may send either, so data is rows or null
const a = supabase.from('users').select('username', { head })
type _11a = Expect<Equal<Data<typeof a>, Row[] | null>>
const t = supabase.from('users').select('username', { head: true })
type _11b = Expect<Equal<Data<typeof t>, null>>
const f = supabase.from('users').select('username', { head: false })
type _11c = Expect<Equal<Data<typeof f>, Row[]>>
const e = supabase.from('users').select('username', {})
type _11d = Expect<Equal<Data<typeof e>, Row[]>>
const n = supabase.from('users').select('username')
type _11e = Expect<Equal<Data<typeof n>, Row[]>>
// an option bag with no `head` at all
const c = supabase.from('users').select('username', { count: 'exact' })
type _11f = Expect<Equal<Data<typeof c>, Row[]>>
// a variable typed as the full option type: either
declare const opts: { head?: boolean; count?: 'exact' }
const o = supabase.from('users').select('username', opts)
type _11g = Expect<Equal<Data<typeof o>, Row[] | null>>

// the rest of the chain follows: single / maybeSingle / stripNulls / facts
const as = supabase.from('users').select('username', { head }).single()
type _11h = Expect<Equal<Data<typeof as>, Row | null>>
const af = supabase.from('users').select('username, status', { head }).eq('status', 'ONLINE')
type _11i = Expect<Equal<Data<typeof af>, { username: string; status: 'ONLINE' }[] | null>>
// the count follows count, not head
const ac = supabase.from('users').select('username', { head, count: 'exact' })
type _11j = Expect<Equal<Count<typeof ac>, number>>
const nc = supabase
  .from('users')
  .select('username', { head, count: maybeCount ? 'exact' : 'planned' })
type _11k = Expect<Equal<Count<typeof nc>, number>>

// a re-select with its own options takes the new method
const rs = supabase.from('users').select('username').select('username', { head: true })
type _11l = Expect<Equal<Data<typeof rs>, null>>
// a mutation keeps return=minimal / representation, whatever the options say
const m = supabase.from('users').update({ status: 'OFFLINE' }).select('status', { head: true })
type _11m = Expect<Equal<Data<typeof m>, { status: Status | null }[]>>

// HEAD chains use `r` entries: planned embeds, operand entries and facts all work, rejections still apply
const h = supabase.from('messages').select('id, channels(id)', { head: true }).eq('channels.id', 1)
type _11n = Expect<Equal<Data<typeof h>, null>>
const hw = supabase.from('messages').select('id, channels(id)', { head }).eq('channels.id', 1)
type _11o = Expect<Equal<Data<typeof hw>, { id: number; channels: { id: number } | null }[] | null>>
// planner rejection applies to HEAD
// @ts-expect-error PGRST200 at `nope`: Could not find a relationship between 'users' and 'nope' in the schema cache. Hint: Perhaps you mean
supabase.from('users').select('username, nope(id)', { head: true })
