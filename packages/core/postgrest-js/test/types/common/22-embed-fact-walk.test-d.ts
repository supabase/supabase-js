import { supabase } from '../client'
import type { Data, Equal, Expect } from '../helpers'

// the filter inside the nested embed removes its row from the lateral join: the enclosing embed
// is the one that turns null, and the tested embed is non-null in what is left
const nn = supabase
  .from('messages')
  .select('id, channels(id, channel_details(id))')
  .not('channels.channel_details', 'is', null)
type _22a = Expect<
  Equal<
    Data<typeof nn>,
    { id: number; channels: { id: number; channel_details: { id: number } } | null }[]
  >
>

// a column of the nested embed widens the nested embed (nearest left-joined to-one)
const col = supabase
  .from('messages')
  .select('id, channels(id, channel_details(id))')
  .eq('channels.channel_details.id', 1)
type _22b = Expect<
  Equal<
    Data<typeof col>,
    {
      id: number
      channels: { id: number; channel_details: { id: number } | null }
    }[]
  >
>

// the walk goes up through an `!inner` join: removing the inner row removes its parent
const inner = supabase
  .from('messages')
  .select('id, channels(id, channel_details!inner(id))')
  .eq('channels.channel_details.id', 1)
type _22c = Expect<
  Equal<
    Data<typeof inner>,
    { id: number; channels: { id: number; channel_details: { id: number } } | null }[]
  >
>

// ... and stops at a to-many: the message loses elements, not its parent, and the root has nothing to widen
const many = supabase
  .from('users')
  .select('username, messages(id, channels!inner(id))')
  .eq('messages.channels.id', 1)
type _22d = Expect<
  Equal<
    Data<typeof many>,
    { username: string; messages: { id: number; channels: { id: number } }[] }[]
  >
>

// a spread to-many lifts its children into arrays: the filtered to-one beneath it is null inside the array, not the array
const spreadMany = supabase
  .from('users')
  .select('username, ...messages(channels(id))')
  .eq('messages.channels.id', -1)
type _22e = Expect<
  Equal<Data<typeof spreadMany>, { username: string; channels: ({ id: number } | null)[] }[]>
>
// nothing filtered: the array holds the plain value
const spreadManyPlain = supabase.from('users').select('username, ...messages(channels(id))')
type _22f = Expect<
  Equal<Data<typeof spreadManyPlain>, { username: string; channels: { id: number }[] }[]>
>
// ... and `.not(embed, 'is', null)` on the embed beneath removes the null from the elements
const spreadManyNn = supabase
  .from('users')
  .select('username, ...messages(channels(id))')
  .eq('messages.channels.id', -1)
  .not('messages.channels', 'is', null)
type _22g = Expect<
  Equal<Data<typeof spreadManyNn>, { username: string; channels: { id: number }[] }[]>
>

// an ordinary embed below an embed in a to-many spread: the spread's array is already entered by the time the walk
// reaches it, so the filtered to-one at the bottom is null inside its parent, not wrapped in a second array
const spreadManyNested = supabase
  .from('users')
  .select('username, ...messages(channels(channel_details(channels(id))))')
  .eq('messages.channels.channel_details.channels.id', -1)
type _22h = Expect<
  Equal<
    Data<typeof spreadManyNested>,
    {
      username: string
      channels: { channel_details: { channels: { id: number } | null } | null }[]
    }[]
  >
>

// one relationship as an ordinary and as a spread occurrence: the ordinary elements and the spread elements each
// turn null at their own depth
const spreadManyMixed = supabase
  .from('users')
  .select('username, messages(channels(id)), ...messages(channels(id))')
  .eq('messages.channels.id', -1)
type _22i = Expect<
  Equal<
    Data<typeof spreadManyMixed>,
    {
      username: string
      messages: { channels: { id: number } | null }[]
      channels: ({ id: number } | null)[]
    }[]
  >
>
