import { supabase } from '../client'
import type { Data, Equal, Expect } from '../helpers'
declare const table: string
declare const maybeTable: 'channels' | 'other'
declare const opts: { referencedTable?: string }

type Plain = { id: number; channels: { id: number } }[]
type Wide = { id: number; channels: { id: number } | null }[]

// a non-literal referencedTable can name any embed: every left-joined to-one embed widens
const o = supabase
  .from('messages')
  .select('id, channels(id)')
  .or('id.eq.1', { referencedTable: table })
type _17a = Expect<Equal<Data<typeof o>, Wide>>
const f = supabase
  .from('messages')
  .select('id, channels(id)')
  .filter('id', 'eq', 1, { referencedTable: table })
type _17b = Expect<Equal<Data<typeof f>, Wide>>
const l = supabase.from('messages').select('id, channels(id)').limit(1, { referencedTable: table })
type _17c = Expect<Equal<Data<typeof l>, Wide>>
const r = supabase
  .from('messages')
  .select('id, channels(id)')
  .range(0, 1, { referencedTable: table })
type _17d = Expect<Equal<Data<typeof r>, Wide>>
// an option that may or may not be present (declared type): same
const lo = supabase.from('messages').select('id, channels(id)').limit(1, opts)
type _17e = Expect<Equal<Data<typeof lo>, Wide>>

// a literal widens that embed alone (for `.filter` and `.range` too)
const fl = supabase
  .from('messages')
  .select('id, channels(id)')
  .filter('id', 'eq', 1, { referencedTable: 'channels' })
type _17f = Expect<Equal<Data<typeof fl>, Wide>>
const rl = supabase
  .from('messages')
  .select('id, channels(id)')
  .range(0, 1, { referencedTable: 'channels' })
type _17g = Expect<Equal<Data<typeof rl>, Wide>>
// ... not another one
const rx = supabase
  .from('messages')
  .select('id, channels(id)')
  .range(0, 1, { referencedTable: 'other' })
type _17h = Expect<Equal<Data<typeof rx>, Plain>>
const lx = supabase
  .from('messages')
  .select('id, channels(id)')
  .limit(1, { referencedTable: 'other' })
type _17i = Expect<Equal<Data<typeof lx>, Plain>>
// a union of literals widens each member
const lu = supabase
  .from('messages')
  .select('id, channels(id)')
  .limit(1, { referencedTable: maybeTable })
type _17j = Expect<Equal<Data<typeof lu>, Wide>>
// nested embeds: the literal is the joined path
const ln = supabase
  .from('users')
  .select('username, messages(id, channels(id))')
  .limit(1, { referencedTable: 'messages.channels' })
type _17k = Expect<
  Equal<
    Data<typeof ln>,
    { username: string; messages: { id: number; channels: { id: number } | null }[] }[]
  >
>
const lm = supabase
  .from('users')
  .select('username, messages(id, channels(id))')
  .limit(1, { referencedTable: 'messages' })
type _17l = Expect<
  Equal<
    Data<typeof lm>,
    { username: string; messages: { id: number; channels: { id: number } }[] }[]
  >
>
// non-literal: the nested to-one widens too
const lt = supabase
  .from('users')
  .select('username, messages(id, channels(id))')
  .range(0, 1, { referencedTable: table })
type _17m = Expect<
  Equal<
    Data<typeof lt>,
    { username: string; messages: { id: number; channels: { id: number } | null }[] }[]
  >
>

// widen-all leaves to-many and inner embeds alone
const tm = supabase
  .from('channels')
  .select('id, messages(id)')
  .or('id.eq.1', { referencedTable: table })
type _17n = Expect<Equal<Data<typeof tm>, { id: number; messages: { id: number }[] }[]>>
const ti = supabase
  .from('messages')
  .select('id, channels!inner(id)')
  .limit(1, { referencedTable: table })
type _17o = Expect<Equal<Data<typeof ti>, Plain>>
// not-null on the embed wins over widen
const nn = supabase
  .from('messages')
  .select('id, channels(id)')
  .limit(1, { referencedTable: table })
  .not('channels', 'is', null)
type _17p = Expect<Equal<Data<typeof nn>, Plain>>

// order never widens, literal or not
const ord = supabase
  .from('messages')
  .select('id, channels(id)')
  .order('id', { referencedTable: table })
type _17q = Expect<Equal<Data<typeof ord>, Plain>>
const ord2 = supabase
  .from('messages')
  .select('id, channels(id)')
  .order('id', { referencedTable: 'channels' })
type _17r = Expect<Equal<Data<typeof ord2>, Plain>>
const ord3 = supabase.from('messages').select('id, channels(id)').order('id', { ascending: false })
type _17s = Expect<Equal<Data<typeof ord3>, Plain>>

// facts are not applied on mutations
const mut = supabase
  .from('messages')
  .update({ message: 'x' })
  .select('id, channels(id)')
  .limit(1, { referencedTable: table })
type _17t = Expect<Equal<Data<typeof mut>, Plain>>
