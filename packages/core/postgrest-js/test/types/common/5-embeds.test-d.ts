import { supabase } from '../client'
import type { Data, Equal, Expect } from '../helpers'
declare const col: string

const base = supabase.from('messages').select('id, channels(id)')
type _5a = Expect<Equal<Data<typeof base>, { id: number; channels: { id: number } }[]>>

// embedded filter -> channels may be null (LEFT JOIN LATERAL keeps the parent)
const w = supabase.from('messages').select('id, channels(id)').eq('channels.id', 1)
type _5b = Expect<Equal<Data<typeof w>, { id: number; channels: { id: number } | null }[]>>

// filter before the select, same result
const w2 = supabase.from('messages').select('id').select('id, channels(id)').eq('channels.id', 1)
type _5b2 = Expect<Equal<Data<typeof w2>, { id: number; channels: { id: number } | null }[]>>

// .not(embed, is, null) afterwards -> non-null again
const nn = supabase
  .from('messages')
  .select('id, channels(id)')
  .eq('channels.id', 1)
  .not('channels', 'is', null)
type _5c = Expect<Equal<Data<typeof nn>, { id: number; channels: { id: number } }[]>>

// order independent: not, then eq
const nn2 = supabase
  .from('messages')
  .select('id, channels(id)')
  .not('channels', 'is', null)
  .eq('channels.id', 1)
type _5d = Expect<Equal<Data<typeof nn2>, { id: number; channels: { id: number } }[]>>

// .not(embed, is, null) on its own
const nn3 = supabase.from('messages').select('id, channels(id)').not('channels', 'is', null)
type _5d2 = Expect<Equal<Data<typeof nn3>, { id: number; channels: { id: number } }[]>>

// not(embedded column, is, null) widens (it is an embedded filter), it is not the embed itself
const nn4 = supabase.from('messages').select('id, channels(id)').not('channels.id', 'is', null)
type _5d3 = Expect<Equal<Data<typeof nn4>, { id: number; channels: { id: number } | null }[]>>

// !inner: the parent row is dropped instead, nothing to widen
const inner = supabase.from('messages').select('id, channels!inner(id)').eq('channels.id', 1)
type _5e = Expect<Equal<Data<typeof inner>, { id: number; channels: { id: number } }[]>>

// order on the embed doesn't widen
const o = supabase
  .from('messages')
  .select('id, channels(id)')
  .order('id', { referencedTable: 'channels' })
type _5f = Expect<Equal<Data<typeof o>, { id: number; channels: { id: number } }[]>>

// limit on the embed widens
const l = supabase
  .from('messages')
  .select('id, channels(id)')
  .limit(1, { referencedTable: 'channels' })
type _5g = Expect<Equal<Data<typeof l>, { id: number; channels: { id: number } | null }[]>>

// root limit does not
const l2 = supabase.from('messages').select('id, channels(id)').limit(1)
type _5g2 = Expect<Equal<Data<typeof l2>, { id: number; channels: { id: number } }[]>>

// or with referencedTable widens
const or1 = supabase
  .from('messages')
  .select('id, channels(id)')
  .or('id.eq.1', { referencedTable: 'channels' })
type _5g3 = Expect<Equal<Data<typeof or1>, { id: number; channels: { id: number } | null }[]>>
// or without it does not
const or2 = supabase.from('messages').select('id, channels(id)').or('id.eq.1')
type _5g4 = Expect<Equal<Data<typeof or2>, { id: number; channels: { id: number } }[]>>

// a dynamic column widens every left-joined to-one embed
const dyn = supabase.from('messages').select('id, channels(id)').eq(col, 1)
type _5h = Expect<Equal<Data<typeof dyn>, { id: number; channels: { id: number } | null }[]>>
// ... but not a to-many embed or an inner one
const dyn2 = supabase.from('channels').select('id, messages(id)').eq(col, 1)
type _5i = Expect<Equal<Data<typeof dyn2>, { id: number; messages: { id: number }[] }[]>>
const dyn3 = supabase.from('messages').select('id, channels!inner(id)').eq(col, 1)
type _5j = Expect<Equal<Data<typeof dyn3>, { id: number; channels: { id: number } }[]>>

// facts are not applied on mutations
const mut = supabase
  .from('messages')
  .update({ message: 'x' })
  .select('id, channels(id)')
  .eq('channels.id', 1)
type _5k = Expect<Equal<Data<typeof mut>, { id: number; channels: { id: number } }[]>>

// alias on the embed: the fact is keyed by the result key
const al = supabase.from('messages').select('id, chan:channels(id)').eq('chan.id', 1)
type _5l = Expect<Equal<Data<typeof al>, { id: number; chan: { id: number } | null }[]>>
const al2 = supabase
  .from('messages')
  .select('id, chan:channels(id)')
  .eq('chan.id', 1)
  .not('chan', 'is', null)
type _5l2 = Expect<Equal<Data<typeof al2>, { id: number; chan: { id: number } }[]>>

// nested embeds: the to-one channel inside each to-many message widens
const ne = supabase
  .from('users')
  .select('username, messages(id, channels(id))')
  .eq('messages.channels.id', 1)
type _5m = Expect<
  Equal<
    Data<typeof ne>,
    { username: string; messages: { id: number; channels: { id: number } | null }[] }[]
  >
>
// a filter on the to-many parent leaves the nested one alone
const ne2 = supabase
  .from('users')
  .select('username, messages(id, channels(id))')
  .eq('messages.id', 1)
type _5n = Expect<
  Equal<
    Data<typeof ne2>,
    { username: string; messages: { id: number; channels: { id: number } }[] }[]
  >
>
// a dynamic column widens nested to-one embeds too
const ne3 = supabase.from('users').select('username, messages(id, channels(id))').eq(col, 1)
type _5o = Expect<
  Equal<
    Data<typeof ne3>,
    { username: string; messages: { id: number; channels: { id: number } | null }[] }[]
  >
>
