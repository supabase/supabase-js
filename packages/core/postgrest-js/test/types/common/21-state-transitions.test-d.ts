import { supabase } from '../client'
import type { ExplainOptions, SelectOptions } from '../../../src/index'
import type { Count, Data, Equal, Expect } from '../helpers'
declare const flag: boolean
declare const selOpts: SelectOptions
declare const explainOpts: ExplainOptions
declare const jsonOrText: 'json' | 'text'
declare const maybeFormat: 'json' | undefined

type Row = { username: string }
type Plan = Record<string, unknown>

// A builder state transition describes the request the runtime sends: modifiers that only add to the request (select's
// head and count, maybeSingle) accumulate, the ones that replace the Accept header replace the format.

// ---- F3: a re-select adds to the method and the count, it never takes them back
const r1 = supabase
  .from('users')
  .select('username', { head: true, count: 'exact' })
  .select('username')
type _21a = Expect<Equal<Data<typeof r1>, null>>
type _21a2 = Expect<Equal<Count<typeof r1>, number>>
// a mutation's count survives its select
const r2 = supabase.from('users').insert({ username: 'x' }, { count: 'exact' }).select('status')
type _21b = Expect<Equal<Count<typeof r2>, number>>
// a re-select turns a GET into a HEAD, and keeps the count of the first
const r3 = supabase
  .from('users')
  .select('username', { count: 'exact' })
  .select('username', { head: true })
type _21c = Expect<Equal<Data<typeof r3>, null>>
type _21c2 = Expect<Equal<Count<typeof r3>, number>>
// `{ head: boolean }` on the re-select: either
const r4 = supabase.from('users').select('username').select('username', { head: flag })
type _21d = Expect<Equal<Data<typeof r4>, Row[] | null>>
// an rpc that sends GET becomes a HEAD with a re-select that asks for it
const r5 = supabase.rpc('get_online_users', {}, { get: true }).select('*', { head: true })
type _21e = Expect<Equal<Data<typeof r5>, null>>
// ... a POST one stays a POST (the runtime only switches GET)
const r6 = supabase.rpc('get_online_users').select('*', { head: true })
declare const r6v: Data<typeof r6>[number]['username']
type _21f = Expect<Equal<typeof r6v, string>>
// ... a re-select without head keeps the rows
const r7 = supabase.rpc('get_online_users', {}, { get: true }).select('*')
declare const r7v: Data<typeof r7>[number]['username']
type _21g = Expect<Equal<typeof r7v, string>>

// ---- F4: single() replaces the Accept header; maybeSingle() leaves it alone
const f1 = supabase.from('users').select('username').csv().single()
type _21h = Expect<Equal<Data<typeof f1>, Row>>
const f2 = supabase.from('users').select('username').csv().maybeSingle()
type _21i = Expect<Equal<Data<typeof f2>, string>>
const f3 = supabase.from('users').select('username').single().csv()
type _21j = Expect<Equal<Data<typeof f3>, string>>
const f4 = supabase.from('users').select('username').csv().maybeSingle().single()
type _21k = Expect<Equal<Data<typeof f4>, Row>>
// explain() keeps the maybeSingle unwrapping of the one-element plan array
const f5 = supabase.from('users').select('username').maybeSingle().explain({ format: 'json' })
type _21l = Expect<Equal<Data<typeof f5>, Plan>>
const f6 = supabase.from('users').select('username').single().explain({ format: 'json' })
type _21m = Expect<Equal<Data<typeof f6>, Plan[]>>
const f7 = supabase.from('users').select('username').maybeSingle().explain()
type _21n = Expect<Equal<Data<typeof f7>, string>>
const f8 = supabase.from('users').select('username').csv().explain({ format: 'json' })
type _21o = Expect<Equal<Data<typeof f8>, Plan[]>>

// ---- F5: explain() and geojson() keep a HEAD
const h1 = supabase.from('users').select('username', { head: true }).explain()
type _21p = Expect<Equal<Data<typeof h1>, null>>
const h2 = supabase.from('users').select('username', { head: true }).explain({ format: 'json' })
type _21q = Expect<Equal<Data<typeof h2>, null>>
const h3 = supabase.from('users').select('username', { head: true }).geojson()
type _21r = Expect<Equal<Data<typeof h3>, null>>
const h4 = supabase.from('users').select('username', { head: flag }).explain()
type _21s = Expect<Equal<Data<typeof h4>, string | null>>
const h5 = supabase.from('users').select('username', { head: flag }).geojson()
type _21t = Expect<Equal<Data<typeof h5>, Record<string, unknown> | null>>
// a GET keeps its body
const h6 = supabase.from('users').select('username').explain()
type _21u = Expect<Equal<Data<typeof h6>, string>>
const h7 = supabase.from('users').select('username').geojson()
type _21v = Expect<Equal<Data<typeof h7>, Record<string, unknown>>>
// a mutation's plan is a body
const h8 = supabase.from('users').insert({ username: 'x' }).select('status').explain()
type _21w = Expect<Equal<Data<typeof h8>, string>>

// ---- F6: explain() infers the format from what the options can hold
const x1 = supabase.from('users').select('username').explain(explainOpts)
type _21x = Expect<Equal<Data<typeof x1>, string | Plan[]>>
const x2 = supabase.from('users').select('username').explain({ format: jsonOrText })
type _21y = Expect<Equal<Data<typeof x2>, string | Plan[]>>
const x3 = supabase.from('users').select('username').explain({ format: maybeFormat })
type _21z = Expect<Equal<Data<typeof x3>, string | Plan[]>>
const x4 = supabase.from('users').select('username').explain({ format: 'text' })
type _21aa = Expect<Equal<Data<typeof x4>, string>>
const x5 = supabase.from('users').select('username').explain({ analyze: true })
type _21ab = Expect<Equal<Data<typeof x5>, string>>
const x6 = supabase.from('users').select('username').explain({ format: 'json' })
type _21ac = Expect<Equal<Data<typeof x6>, Plan[]>>
const x7 = supabase.from('users').select('username').maybeSingle().explain(explainOpts)
type _21ad = Expect<Equal<Data<typeof x7>, string | Plan>>

// ---- F7: an rpc's count option reaches the response
const c1 = supabase.rpc('get_online_users', {}, { count: 'exact' }).throwOnError()
type _21ae = Expect<Equal<Count<typeof c1>, number>>
const c2 = supabase.rpc('get_online_users').throwOnError()
type _21af = Expect<Equal<Count<typeof c2>, null>>
const c3 = supabase.rpc('get_online_users', {}, { count: 'exact', get: true })
type _21ag = Expect<Equal<Count<typeof c3>, number>>

// ---- F8: a count that may be absent is `number | null`
const u1 = supabase.from('users').select('username', selOpts)
type _21ah = Expect<Equal<Count<typeof u1>, number | null>>
const u2 = supabase.from('users').select('username', { count: flag ? 'exact' : undefined })
type _21ai = Expect<Equal<Count<typeof u2>, number | null>>
const u3 = supabase.from('users').select('username', { count: undefined })
type _21aj = Expect<Equal<Count<typeof u3>, null>>
const u4 = supabase.from('users').insert({ username: 'x' }, { count: flag ? 'exact' : undefined })
type _21ak = Expect<Equal<Count<typeof u4>, number | null>>
const u5 = supabase.from('users').update({ username: 'x' }, { count: flag ? 'exact' : undefined })
type _21al = Expect<Equal<Count<typeof u5>, number | null>>
const u6 = supabase.from('users').delete({ count: flag ? 'exact' : undefined })
type _21am = Expect<Equal<Count<typeof u6>, number | null>>
const u7 = supabase.from('users').upsert({ username: 'x' }, { count: flag ? 'exact' : undefined })
type _21an = Expect<Equal<Count<typeof u7>, number | null>>
const u8 = supabase.rpc('get_online_users', {}, { count: flag ? 'exact' : undefined })
type _21ao = Expect<Equal<Count<typeof u8>, number | null>>
// a definite count is not weakened by a later uncertain one
const u9 = supabase.from('users').select('username', { count: 'exact' }).select('username', selOpts)
type _21ap = Expect<Equal<Count<typeof u9>, number>>
// an uncertain count becomes certain with a later definite one
const u10 = supabase
  .from('users')
  .select('username', selOpts)
  .select('username', { count: 'exact' })
type _21aq = Expect<Equal<Count<typeof u10>, number>>
// uncertain stays uncertain with a later absent one
const u11 = supabase.from('users').select('username', selOpts).select('username')
type _21ar = Expect<Equal<Count<typeof u11>, number | null>>
