import { supabase } from '../client'
import type { Data, Equal, Expect, Status } from '../helpers'
declare const optionalPoly: { a: string } | { b: number }

// `source` is the unprojected row of a structured return: table / view row, standalone composite, RETURNS TABLE.
// It types `*` provenance and plain-column filter operands. A scalar has `source: never`.

// ---- RETURNS TABLE (setof)
const rt = supabase.rpc('rank_users', { n: 3 })
type _15a = Expect<Equal<Data<typeof rt>, { username: string; msg_count: number }[]>>
supabase.rpc('rank_users', { n: 3 }).eq('username', 'x').neq('msg_count', 1)
// username is a string
// @ts-expect-error Argument of type 'number' is not assignable to parameter of type
supabase.rpc('rank_users', { n: 3 }).eq('username', 1)
// @ts-expect-error Argument of type 'string' is not assignable to parameter of type
supabase.rpc('rank_users', { n: 3 }).eq('msg_count', 'x')
// the type of the source's column; a column the source doesn't have is not a plain column
// (loose: unknown operand; strict.ts rejects it)
const rtn = supabase.rpc('rank_users', { n: 3 }).not('username', 'is', null)
type _15b = Expect<Equal<Data<typeof rtn>, { username: string; msg_count: number }[]>>

// ---- composite (single row)
const cp = supabase.rpc('get_address', { id: 1 })
type _15c = Expect<Equal<Data<typeof cp>, { street: string | null; city: string | null }>>
// the composite's attributes are fact columns: `*` narrows them
const cpn = supabase.rpc('get_address', { id: 1 }).not('street', 'is', null)
type _15d = Expect<Equal<Data<typeof cpn>, { street: string; city: string | null }>>
const cpi = supabase.rpc('get_address', { id: 1 }).is('city', null)
type _15e = Expect<Equal<Data<typeof cpi>, { street: string | null; city: null }>>
// street is a string
// @ts-expect-error Argument of type 'number' is not assignable to parameter of type
supabase.rpc('get_address', { id: 1 }).eq('street', 1)
// through a re-select with `*`
const cps = supabase.rpc('get_address', { id: 1 }).not('street', 'is', null).select('*')
type _15f = Expect<Equal<Data<typeof cps>, { street: string; city: string | null }>>

// ---- table / view row: `*` carries the fact columns of the source, plain filters are typed from its row
const tb = supabase.rpc('get_user_messages', { user_name: 'x' }).not('message', 'is', null)
declare const tbv: Data<typeof tb>[number]['message']
type _15g = Expect<Equal<typeof tbv, string>>
// `data` is a jsonb column: outside the source's fact columns, so it stays nullable
const tbd = supabase.rpc('get_user_messages', { user_name: 'x' }).not('data', 'is', null)
declare const tbdv: Data<typeof tbd>[number]['data']
type _15h = Expect<Equal<typeof tbdv extends null ? true : false, false>>
type _15h2 = Expect<Equal<null extends typeof tbdv ? true : false, true>>

// ---- a union of calls: the union of the matched calls' sources
const ps = supabase.rpc('poly_src', optionalPoly)
type _15i = Expect<
  Equal<Data<typeof ps>, ({ shared: number; only_a: string } | { shared: string })[]>
>
// `shared` is in both sources: the operand is the union of its types
supabase.rpc('poly_src', optionalPoly).eq('shared', 1)
supabase.rpc('poly_src', optionalPoly).eq('shared', 'x')
// neither source says boolean
// @ts-expect-error Argument of type 'boolean' is not assignable to parameter of type
supabase.rpc('poly_src', optionalPoly).eq('shared', true)
// a single call has its own source
supabase.rpc('poly_src', { a: 'x' }).eq('only_a', 'x')
// only the `a` source has only_a, and it is a string
// @ts-expect-error Argument of type 'number' is not assignable to parameter of type
supabase.rpc('poly_src', { a: 'x' }).eq('only_a', 1)
// the `b` call's shared is a string
// @ts-expect-error Argument of type 'number' is not assignable to parameter of type
supabase.rpc('poly_src', { b: 1 }).eq('shared', 1)
supabase.rpc('poly_src', { b: 1 }).eq('shared', 'x')

// ---- scalar: `source: never`, nothing to type a plain column with (loose.ts accepts the column, strict.ts rejects it)
const sc = supabase.rpc('get_status', { name_param: 'x' }).maybeSingle()
type _15j = Expect<Equal<Data<typeof sc>, Status | null>>
