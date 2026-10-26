import { supabase } from '../client'
import type { Data, Equal, Expect } from '../helpers'

// 6. spread outputs: the embed's nullability lands on the flattened fields named by `outputs`
const s0 = supabase.from('messages').select('id, ...channels(channel_key:id)')
type _13a = Expect<Equal<Data<typeof s0>, { id: number; channel_key: number }[]>>
// a filter on the embed's column widens the output field
const s1 = supabase.from('messages').select('id, ...channels(channel_key:id)').eq('channels.id', 1)
type _13b = Expect<Equal<Data<typeof s1>, { id: number; channel_key: number | null }[]>>
// `.not(embed, 'is', null)` cancels the widening: the field is NOT NonNullable of a nullable
const s2 = supabase
  .from('messages')
  .select('id, ...channels(channel_key:id)')
  .eq('channels.id', 1)
  .not('channels', 'is', null)
type _13c = Expect<Equal<Data<typeof s2>, { id: number; channel_key: number }[]>>
// ... in either order
const s3 = supabase
  .from('messages')
  .select('id, ...channels(channel_key:id)')
  .not('channels', 'is', null)
  .eq('channels.id', 1)
type _13d = Expect<Equal<Data<typeof s3>, { id: number; channel_key: number }[]>>
// ... and alone it changes nothing
const s4 = supabase
  .from('messages')
  .select('id, ...channels(channel_key:id)')
  .not('channels', 'is', null)
type _13e = Expect<Equal<Data<typeof s4>, { id: number; channel_key: number }[]>>
// a spread field that is nullable on its own stays nullable: `.not` cancels widening, it never narrows
const n0 = supabase.from('messages').select('id, ...channels(slug)').not('channels', 'is', null)
type _13f = Expect<Equal<Data<typeof n0>, { id: number; slug: string | null }[]>>
const n1 = supabase.from('messages').select('id, ...channels(slug)').eq('channels.id', 1)
type _13g = Expect<Equal<Data<typeof n1>, { id: number; slug: string | null }[]>>
const n2 = supabase
  .from('messages')
  .select('id, ...channels(slug)')
  .eq('channels.id', 1)
  .not('channels', 'is', null)
type _13h = Expect<Equal<Data<typeof n2>, { id: number; slug: string | null }[]>>
// the operand entry's embed path is the embed identity path, not the flattened field
// a plain column of the parent is unaffected
const p = supabase.from('messages').select('id, ...channels(channel_key:id)').eq('id', 1)
type _13i = Expect<Equal<Data<typeof p>, { id: number; channel_key: number }[]>>

// ordinary embeds: `.not(embed, 'is', null)` still removes the null; `outputs` drives both
const e0 = supabase.from('messages').select('id, channels(id)').eq('channels.id', 1)
type _13j = Expect<Equal<Data<typeof e0>, { id: number; channels: { id: number } | null }[]>>
const e1 = supabase
  .from('messages')
  .select('id, channels(id)')
  .eq('channels.id', 1)
  .not('channels', 'is', null)
type _13k = Expect<Equal<Data<typeof e1>, { id: number; channels: { id: number } }[]>>
// an aliased embed's output is its alias
const e2 = supabase.from('messages').select('id, chan:channels(id)').eq('chan.id', 1)
type _13l = Expect<Equal<Data<typeof e2>, { id: number; chan: { id: number } | null }[]>>
