import { supabase } from '../client'
import type { Data, Equal, Expect } from '../helpers'
declare const col: string

// plain root column, typed from Row, even though the select doesn't return it
const a = supabase.from('messages').select('id').eq('message', 'hi')
type _6a = Expect<Equal<Data<typeof a>, { id: number }[]>>
// message is string | null, not a number
// @ts-expect-error Argument of type 'number' is not assignable to parameter of type
supabase.from('messages').select('id').eq('message', 5)
// nothing indexed needed for plain columns on any select, even the default `*`
supabase.from('messages').select().eq('channel_id', 1)

// embedded column from SupabaseOperands: type from the entry
supabase.from('messages').select('id, channels(id)').eq('channels.id', 1)
// channels.id is a number
// @ts-expect-error Argument of type 'string' is not assignable to parameter of type
supabase.from('messages').select('id, channels(id)').eq('channels.id', 'x')

// { error } operand: rejected on the column
// @ts-expect-error PGRST108 at `channels`: 'channels' is not an embedded resource in this request. Hint: add channels(...) to the select.
supabase.from('messages').select('id').eq('channels.id', 1)
// the same entry rejects every operator and modifier that names it
// @ts-expect-error PGRST108 at `channels`: 'channels' is not an embedded resource in this request. Hint: add channels(...) to the select.
supabase.from('messages').select('id').neq('channels.id', 1)
// @ts-expect-error PGRST108 at `channels`: 'channels' is not an embedded resource in this request. Hint: add channels(...) to the select.
supabase.from('messages').select('id').not('channels.id', 'is', null)

// JSON path operand
supabase.from('users').select('username, data').eq('data->theme', 'dark')
// @ts-expect-error Argument of type 'number' is not assignable to parameter of type
supabase.from('users').select('username, data').eq('data->theme', 3)

// dynamic column: value unknown
supabase.from('messages').select('id').eq(col, 'anything')
supabase.from('messages').select('id').eq(col, 1)
// dynamic select: operands are not checked against a select we can't see
declare const cols: string
supabase.from('messages').select(cols).eq('channels.id', 'x')

// order: plain root column checked, referencedTable column not
supabase.from('messages').select('id').order('id')
supabase.from('messages').select('id, channels(id)').order('id', { referencedTable: 'channels' })
// @ts-expect-error PGRST108 at `channels`: 'channels' is not an embedded resource in this request. Hint: add channels(...) to the select.
supabase.from('messages').select('id').order('channels.id')
