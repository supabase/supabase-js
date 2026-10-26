import { supabase } from '../client'
import type { Json } from '../fixture/db'
import type { Data, Equal, Expect, Status } from '../helpers'

type MessageRow = {
  id: number
  message: string | null
  username: string
  channel_id: number
  data: Json | null
}
// exact key union match: scalar enum | null
const a = supabase.rpc('get_status', { name_param: 'x' })
type _8a = Expect<Equal<Data<typeof a>, Status | null>>
// the value types come from the matched routine
// name_param is a string
// @ts-expect-error Argument of type '[{ name_param: number; }]' is not assignable to parameter of type
supabase.rpc('get_status', { name_param: 1 })

// { get: true } selects the GET call
const g = supabase.rpc('get_status', { name_param: 'x' }, { get: true })
type _8b = Expect<Equal<Data<typeof g>, Status>>

// ambiguous: PGRST203 carried on args
// @ts-expect-error Argument of type '[{ a: string; }]' is not assignable to parameter of type
supabase.rpc('postgrest_unresolvable_function', { a: 'x' })
// @ts-expect-error Argument of type '[{ a: number; }]' is not assignable to parameter of type
supabase.rpc('postgrest_unresolvable_function', { a: 1 })

// unknown function name
// @ts-expect-error Argument of type '"nope"' is not assignable to parameter of type
supabase.rpc('nope', {})

// setof: rows
const s = supabase.rpc('get_user_messages', { user_name: 'x' })
type _8c = Expect<Equal<Data<typeof s>[number]['id'], number>>
type _8c2 = Expect<Equal<Data<typeof s>, MessageRow[]>>
// re-select re-keys f|...|id with the same key set
const r = supabase.rpc('get_user_messages', { user_name: 'x' }).select('id')
type _8d = Expect<Equal<Data<typeof r>, { id: number }[]>>
// returns keeps the Row for plain-column operands
supabase.rpc('get_user_messages', { user_name: 'x' }).eq('username', 'x')
// @ts-expect-error Argument of type 'number' is not assignable to parameter of type
supabase.rpc('get_user_messages', { user_name: 'x' }).eq('username', 1)
supabase.rpc('get_user_messages', { user_name: 'x' }).select('id').eq('channel_id', 1)
// single on a setof call
const rs = supabase.rpc('get_user_messages', { user_name: 'x' }).select('id').single()
type _8e = Expect<Equal<Data<typeof rs>, { id: number }>>
// a scalar rpc is not an array
const sc = supabase.rpc('get_status', { name_param: 'x' }).maybeSingle()
type _8f = Expect<Equal<Data<typeof sc>, Status | null>>

// select() with no argument after rpc re-keys f|...|* (the call's own row)
const rd = supabase.rpc('get_user_messages', { user_name: 'x' }).select()
type _8g = Expect<Equal<Data<typeof rd>, MessageRow[]>>
// a dynamic select after a setof rpc keeps the array shape: see loose/2-dynamic and strict/2-dynamic for its rows
