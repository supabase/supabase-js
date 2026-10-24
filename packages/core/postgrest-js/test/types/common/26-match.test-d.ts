import { supabase } from '../client'
import type { Data, Equal, Expect } from '../helpers'
declare const dynamicKey: string
declare const dynamicQuery: Record<string, number>
declare const maybeStatus: 'ONLINE' | undefined

// `.match` checks each key like `.eq(key, value)` does: an operand error is reported on the key
// @ts-expect-error PGRST108 at `channels`: 'channels' is not an embedded resource in this request. Hint: add channels(...) to the select.
supabase.from('messages').select('id').match({ 'channels.id': 1 })
// ... a value outside the enum is rejected
// @ts-expect-error Type '"AWAY"' is not assignable to type
supabase.from('users').select('status').match({ status: 'AWAY' })
// ... and so is a value of another type, whichever key is wrong
// @ts-expect-error Type 'string' is not assignable to type 'number'.
supabase.from('messages').select('id, channels(id)').match({ id: 1, 'channels.id': 'x' })

// valid keys and values pass; `undefined` is dropped by the runtime, so it is accepted
supabase.from('users').select('status').match({ status: 'ONLINE' })
supabase.from('users').select('status').match({ status: undefined })
supabase.from('users').select('status').match({ status: maybeStatus })
supabase.from('messages').select('id, channels(id)').match({ id: 1, 'channels.id': 1 })
// a dynamic key takes any value
supabase
  .from('messages')
  .select('id')
  .match({ [dynamicKey]: 'x' })
supabase.from('messages').select('id').match(dynamicQuery)

// a known key still carries its embed facts: the filtered embed turns null
const m = supabase.from('messages').select('id, channels(id)').match({ 'channels.id': -1 })
type _26a = Expect<Equal<Data<typeof m>, { id: number; channels: { id: number } | null }[]>>
// a plain column adds none
const p = supabase.from('messages').select('id, channels(id)').match({ id: 1 })
type _26b = Expect<Equal<Data<typeof p>, { id: number; channels: { id: number } }[]>>
