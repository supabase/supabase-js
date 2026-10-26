import { supabase } from '../client'
import type { ExplainOptions, MutOptions, RpcOptions, SelectOptions } from '../../../src/index'
import type { Count, Data, Equal, Expect } from '../helpers'

type Row = { username: string }
type Plan = Record<string, unknown>

// An option bag is read per possible value: a union of bags, and an absent bag, are each a possible request.

// ---- F1: a union of option bags is read member by member
declare const headOrCount: { head: true } | { count: 'exact' }
const a1 = supabase.from('users').select('username', headOrCount).throwOnError()
type _24a = Expect<Equal<Data<typeof a1>, Row[] | null>>
type _24a2 = Expect<Equal<Count<typeof a1>, number | null>>
declare const jsonOrAnalyze: { format: 'json' } | { analyze: true }
const a2 = supabase.from('users').select('username').explain(jsonOrAnalyze).throwOnError()
type _24b = Expect<Equal<Data<typeof a2>, string | Plan[]>>
const a3 = supabase
  .rpc('polymorphic_function_with_unnamed_jsonb', { '': 'x' }, headOrCount)
  .throwOnError()
type _24c = Expect<Equal<Data<typeof a3>, 'post' | null>>
type _24c2 = Expect<Equal<Count<typeof a3>, number | null>>
// a mutation's count
declare const countOrNot: { count: 'exact' } | {}
const a4 = supabase.from('users').insert({ username: 'x' }, countOrNot).throwOnError()
type _24d = Expect<Equal<Count<typeof a4>, number | null>>

// ---- F2: an option bag that may be absent is one more possible request
declare const maybeJson: { format: 'json' } | undefined
const b1 = supabase.from('users').select('username').explain(maybeJson).throwOnError()
type _24e = Expect<Equal<Data<typeof b1>, string | Plan[]>>
declare const maybeHeadCount: { head: true; count: 'exact' } | undefined
const b2 = supabase.from('users').select('username', maybeHeadCount).throwOnError()
type _24f = Expect<Equal<Data<typeof b2>, Row[] | null>>
type _24f2 = Expect<Equal<Count<typeof b2>, number | null>>
// the same through a re-select
const b3 = supabase.from('users').select('username').select('username', maybeHeadCount)
type _24g = Expect<Equal<Data<typeof b3>, Row[] | null>>
type _24g2 = Expect<Equal<Count<typeof b3>, number | null>>
declare const maybeCount: { count: 'exact' } | undefined
const b4 = supabase.from('users').insert({ username: 'x' }, maybeCount).throwOnError()
type _24h = Expect<Equal<Count<typeof b4>, number | null>>
const b5 = supabase.from('users').upsert({ username: 'x' }, maybeCount).throwOnError()
type _24i = Expect<Equal<Count<typeof b5>, number | null>>
const b6 = supabase.from('users').update({ username: 'x' }, maybeCount).throwOnError()
type _24j = Expect<Equal<Count<typeof b6>, number | null>>
const b7 = supabase.from('users').delete(maybeCount).throwOnError()
type _24k = Expect<Equal<Count<typeof b7>, number | null>>
declare const maybeRpcHead: { head: true; count: 'exact' } | undefined
const b8 = supabase
  .rpc('polymorphic_function_with_unnamed_jsonb', { '': 'x' }, maybeRpcHead)
  .throwOnError()
type _24l = Expect<Equal<Data<typeof b8>, 'post' | null>>
type _24l2 = Expect<Equal<Count<typeof b8>, number | null>>
const b9 = supabase.rpc('get_online_users', undefined, maybeCount).throwOnError()
type _24m = Expect<Equal<Count<typeof b9>, number | null>>
// optional typed bags
declare const optSelect: SelectOptions | undefined
const b10 = supabase.from('users').select('username', optSelect).throwOnError()
type _24n = Expect<Equal<Data<typeof b10>, Row[] | null>>
declare const optExplain: ExplainOptions | undefined
const b11 = supabase.from('users').select('username').explain(optExplain)
type _24o = Expect<Equal<Data<typeof b11>, string | Plan[]>>
declare const optMut: MutOptions | undefined
const b12 = supabase.from('users').delete(optMut)
type _24p = Expect<Equal<Count<typeof b12>, number | null>>
// (a bag that may ask for HEAD would be refused by a strict index, which plans no such call)
declare const optRpc: Pick<RpcOptions, 'count'> | undefined
const b13 = supabase.rpc('get_online_users', {}, optRpc)
type _24q = Expect<Equal<Count<typeof b13>, number | null>>
// a literal or an absent bag keeps its exact reading
const b14 = supabase.from('users').select('username', { head: true, count: 'exact' })
type _24r = Expect<Equal<Data<typeof b14>, null>>
type _24r2 = Expect<Equal<Count<typeof b14>, number>>
const b15 = supabase.from('users').select('username').explain({ format: 'json' })
type _24s = Expect<Equal<Data<typeof b15>, Plan[]>>
const b16 = supabase.from('users').select('username').explain()
type _24t = Expect<Equal<Data<typeof b16>, string>>
const b17 = supabase.from('users').select('username')
type _24u = Expect<Equal<Count<typeof b17>, null>>

// ---- F4: the last of single() and maybeSingle() wins
const c1 = supabase
  .from('users')
  .select('username')
  .maybeSingle()
  .single()
  .explain({ format: 'json' })
type _24v = Expect<Equal<Data<typeof c1>, Plan[]>>
const c2 = supabase
  .from('users')
  .select('username')
  .single()
  .maybeSingle()
  .explain({ format: 'json' })
type _24w = Expect<Equal<Data<typeof c2>, Plan>>
const c3 = supabase.from('users').select('username').single().maybeSingle()
type _24x = Expect<Equal<Data<typeof c3>, Row | null>>
const c4 = supabase.from('users').select('username').maybeSingle().single()
type _24y = Expect<Equal<Data<typeof c4>, Row>>
