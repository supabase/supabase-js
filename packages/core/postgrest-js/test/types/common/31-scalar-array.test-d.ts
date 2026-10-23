import { supabase } from '../client'
import type { Data, Equal, Expect } from '../helpers'

// A scalar function whose type is an array answers with that array whatever the Accept header: single() keeps it.
// maybeSingle() fetches a list and unwraps it client-side: [] is null, [x] is x, more than one element is an error
// (no data). test/scalar-array-rpc.test.ts pins each against the stack.

// ---- F4: the scalar array
const a1 = supabase.rpc('int_array_upto', { n: 1 })
type _31a = Expect<Equal<Data<typeof a1>, number[] | null>>
const a2 = supabase.rpc('int_array_upto', { n: 1 }).single()
type _31b = Expect<Equal<Data<typeof a2>, number[] | null>>
const a3 = supabase.rpc('int_array_upto', { n: 1 }).maybeSingle()
type _31c = Expect<Equal<Data<typeof a3>, number | null>>
const a4 = supabase.rpc('int_array_upto', { n: 1 }).maybeSingle().throwOnError()
type _31d = Expect<Equal<Data<typeof a4>, number | null>>
// the last of single() and maybeSingle() wins
const a5 = supabase.rpc('int_array_upto', { n: 1 }).single().maybeSingle()
type _31e = Expect<Equal<Data<typeof a5>, number | null>>
const a6 = supabase.rpc('int_array_upto', { n: 1 }).maybeSingle().single()
type _31f = Expect<Equal<Data<typeof a6>, number[] | null>>

// a scalar that is not an array, and a composite, are left alone
const b1 = supabase.rpc('get_status', { name_param: 'x' }).maybeSingle()
type _31g = Expect<Equal<Data<typeof b1>, 'ONLINE' | 'OFFLINE' | null>>
