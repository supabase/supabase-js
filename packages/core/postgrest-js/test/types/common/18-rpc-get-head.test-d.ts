import { supabase } from '../client'
import type { Data, Equal, Expect } from '../helpers'
declare const str: string
declare const flag: boolean
declare const num: number
declare const obj: { x: number }
declare const objs: { x: number }[]
declare const strs: string[]
declare const nums: number[]
declare const anyJson: string | { x: number }
declare const maybeObj: { x: number } | undefined
declare const members: { v: 1 } | { v: { x: number } }

// The method is exactly what the options ask for: `get: true` GET, `head: true` HEAD, otherwise POST. Value types never
// change it. Under GET or HEAD the argument check rejects (TS2345 on args, the message names the key) what the types
// prove the runtime would refuse: a certainly-object value, an operator-looking string literal, a reserved key.

// ---- 1. the method follows the options
const g1 = supabase.rpc('probe', { v: 1 }, { get: true })
type _18a = Expect<Equal<Data<typeof g1>, 'get'>>
const g2 = supabase.rpc('probe', { v: 1 })
type _18b = Expect<Equal<Data<typeof g2>, 'post'>>
const g3 = supabase.rpc('probe', { v: 1 }, { get: false })
type _18c = Expect<Equal<Data<typeof g3>, 'post'>>
// a non-literal flag gives both branches
const g4 = supabase.rpc('probe', { v: 1 }, { get: flag })
type _18d = Expect<Equal<Data<typeof g4>, 'get' | 'post'>>
// `{ head: boolean }` gives HEAD | POST: the HEAD part has no body
const g5 = supabase.rpc('polymorphic_function_with_unnamed_jsonb', { '': 'x' }, { head: flag })
type _18e = Expect<Equal<Data<typeof g5>, 'post' | null>>
const g6 = supabase.rpc('polymorphic_function_with_unnamed_jsonb', { '': 'x' }, { head: true })
type _18f = Expect<Equal<Data<typeof g6>, null>>
// head wins over get
const g7 = supabase.rpc(
  'polymorphic_function_with_unnamed_jsonb',
  { '': 'x' },
  { head: true, get: true }
)
type _18g = Expect<Equal<Data<typeof g7>, null>>
// the matched calls' method is exact: probe has an (error) HEAD call, so a call that sends HEAD is rejected, and so is
// the HEAD branch of a non-literal flag
// @ts-expect-error PGRST202 Could not find the function public.probe(v) in the schema cache (HEAD)
supabase.rpc('probe', { v: 1 }, { head: true })
// @ts-expect-error PGRST202 Could not find the function public.probe(v) in the schema cache (HEAD)
supabase.rpc('probe', { v: 1 }, { head: flag })
// @ts-expect-error PGRST202 Could not find the function public.probe(v) in the schema cache (HEAD)
supabase.rpc('probe', { v: 1 }, { head: true, get: true })
// maybe-keys are checked on the value type without `undefined`: whenever one is sent, the runtime refuses
// @ts-expect-error GET and HEAD refuse an object value for 'v'
supabase.rpc('probe_opt', { a: 1, v: maybeObj }, { get: true })
declare const optObj: { a: number; v?: { x: number } }
// @ts-expect-error GET and HEAD refuse an object value for 'v'
supabase.rpc('probe_opt', optObj, { get: true })
// @ts-expect-error GET and HEAD refuse an object value for 'v'
supabase.rpc('probe_opt', optObj, { get: flag })
// ... under POST they are accepted: both key sets, two calls
const g8 = supabase.rpc('probe_opt', { a: 1, v: maybeObj })
type _18h = Expect<Equal<Data<typeof g8>, 'post-a' | 'post-av'>>
const g8b = supabase.rpc('probe_opt', optObj)
type _18h2 = Expect<Equal<Data<typeof g8b>, 'post-a' | 'post-av'>>
// a maybe-key that may be a non-object (or only undefined) is not refused
declare const maybeJson: { x: number } | string | undefined
const g8c = supabase.rpc('probe_opt', { a: 1, v: maybeJson }, { get: true })
type _18h3 = Expect<Equal<Data<typeof g8c>, 'get-a' | 'get-av'>>
// a maybe-key operator literal is refused too
declare const maybeOp: 'eq.1' | undefined
// @ts-expect-error GET and HEAD refuse a value read as a filter for 'v'
supabase.rpc('probe_opt', { a: 1, v: maybeOp }, { get: true })
// a sure object key under POST
const g9 = supabase.rpc('probe_opt', { a: 1, v: { x: 1 } })
type _18i = Expect<Equal<Data<typeof g9>, 'post-av'>>

// ---- 2. certainly-object values are refused under HEAD and GET, accepted under POST
// @ts-expect-error GET and HEAD refuse an object value for ''
supabase.rpc('polymorphic_function_with_unnamed_jsonb', { '': { test: 'value' } }, { head: true })
const o1 = supabase.rpc('polymorphic_function_with_unnamed_jsonb', { '': { test: 'value' } })
type _18j = Expect<Equal<Data<typeof o1>, 'post'>>
const o2 = supabase.rpc(
  'polymorphic_function_with_unnamed_jsonb',
  { '': { test: 'value' } },
  { get: false }
)
type _18k = Expect<Equal<Data<typeof o2>, 'post'>>
// @ts-expect-error GET and HEAD refuse an object value for 'v'
supabase.rpc('probe', { v: { x: 1 } }, { get: true })
// @ts-expect-error GET and HEAD refuse an object value for 'v'
supabase.rpc('probe', { v: obj }, { get: true })
// an array whose elements are certainly objects
// @ts-expect-error GET and HEAD refuse an object value for 'v'
supabase.rpc('probe', { v: objs }, { get: true })
// @ts-expect-error GET and HEAD refuse an object value for 'v'
supabase.rpc('probe', { v: [{ x: 1 }] }, { get: true })
// a branch of a non-literal flag that is refused rejects the call
// @ts-expect-error GET and HEAD refuse an object value for ''
supabase.rpc('polymorphic_function_with_unnamed_jsonb', { '': { test: 'value' } }, { head: flag })
// @ts-expect-error GET and HEAD refuse an object value for 'v'
supabase.rpc('probe', { v: { x: 1 } }, { get: flag })
// head wins over get: the refusal still applies
supabase.rpc(
  'polymorphic_function_with_unnamed_jsonb',
  // @ts-expect-error GET and HEAD refuse an object value for ''
  { '': { test: 'value' } },
  { head: true, get: true }
)
// each member of an argument union is checked on its own: any refused member rejects args under GET
// @ts-expect-error GET and HEAD refuse an object value for 'v'
supabase.rpc('probe', members, { get: true })
const o3 = supabase.rpc('probe', members)
type _18l = Expect<Equal<Data<typeof o3>, 'post'>>
// not certainly objects: numbers, booleans, null, arrays of those, strings, Json-like unions
const s1 = supabase.rpc('probe', { v: num }, { get: true })
type _18m = Expect<Equal<Data<typeof s1>, 'get'>>
const s2 = supabase.rpc('probe', { v: nums }, { get: true })
type _18n = Expect<Equal<Data<typeof s2>, 'get'>>
const s3 = supabase.rpc('probe', { v: strs }, { get: true })
type _18o = Expect<Equal<Data<typeof s3>, 'get'>>
const s4 = supabase.rpc('probe', { v: anyJson }, { get: true })
type _18p = Expect<Equal<Data<typeof s4>, 'get'>>
const s5 = supabase.rpc('probe', { v: null }, { get: true })
type _18q = Expect<Equal<Data<typeof s5>, 'get'>>
const s6 = supabase.rpc('probe', { v: true }, { get: true })
type _18r = Expect<Equal<Data<typeof s6>, 'get'>>
const s7 = supabase.rpc('probe', { v: [1, 2] }, { get: true })
type _18s = Expect<Equal<Data<typeof s7>, 'get'>>

// ---- 3. operator-looking string literals
// @ts-expect-error GET and HEAD refuse a value read as a filter for 'v'
supabase.rpc('probe', { v: 'eq.1' }, { get: true })
// @ts-expect-error GET and HEAD refuse a value read as a filter for 'v'
supabase.rpc('probe', { v: 'not.x' }, { get: true })
// @ts-expect-error GET and HEAD refuse a value read as a filter for 'v'
supabase.rpc('probe', { v: 'eq(any).x' }, { get: true })
// @ts-expect-error GET and HEAD refuse a value read as a filter for 'v'
supabase.rpc('probe', { v: 'fts(english).x' }, { get: true })
// @ts-expect-error GET and HEAD refuse a value read as a filter for 'v'
supabase.rpc('probe', { v: 'in.(1,2)' }, { get: true })
// @ts-expect-error GET and HEAD refuse a value read as a filter for 'v'
supabase.rpc('probe', { v: 'is.null' }, { get: true })
// @ts-expect-error GET and HEAD refuse a value read as a filter for ''
supabase.rpc('polymorphic_function_with_unnamed_jsonb', { '': 'cs.{1}' }, { get: true })
// a union of literals that all match is proven; a mix is not
// @ts-expect-error GET and HEAD refuse a value read as a filter for 'v'
supabase.rpc('probe', { v: 'eq.1' as 'eq.1' | 'neq.2' }, { get: true })
const t1 = supabase.rpc('probe', { v: 'eq.1' as 'eq.1' | 'x' }, { get: true })
type _18t = Expect<Equal<Data<typeof t1>, 'get'>>
// a template literal that always starts with an operator is a literal too
// @ts-expect-error GET and HEAD refuse a value read as a filter for 'v'
supabase.rpc('probe', { v: `eq.${str}` }, { get: true })
// @ts-expect-error GET and HEAD refuse a value read as a filter for 'v'
supabase.rpc('probe', { v: 'eq.1' }, { head: flag })
// under POST nothing is refused
const t2 = supabase.rpc('probe', { v: 'eq.1' })
type _18u = Expect<Equal<Data<typeof t2>, 'post'>>
// not an operator: plain strings, and a name that only starts like one
const t3 = supabase.rpc('probe', { v: 'hello' }, { get: true })
type _18v = Expect<Equal<Data<typeof t3>, 'get'>>
const t4 = supabase.rpc('probe', { v: str }, { get: true })
type _18w = Expect<Equal<Data<typeof t4>, 'get'>>
const t5 = supabase.rpc('probe', { v: 'equal.x' }, { get: true })
type _18x = Expect<Equal<Data<typeof t5>, 'get'>>
const t6 = supabase.rpc('probe', { v: 'eq' }, { get: true })
type _18y = Expect<Equal<Data<typeof t6>, 'get'>>
const t7 = supabase.rpc('probe', { v: 'x.eq.1' }, { get: true })
type _18z = Expect<Equal<Data<typeof t7>, 'get'>>

// ---- 4. reserved keys
// @ts-expect-error GET and HEAD refuse the reserved key 'limit'
supabase.rpc('paged', { limit: 1 }, { get: true })
// @ts-expect-error GET and HEAD refuse the reserved key 'limit'
supabase.rpc('paged', { limit: 1 }, { head: true })
// @ts-expect-error GET and HEAD refuse the reserved key 'x.order'
supabase.rpc('dotted', { 'x.order': 1 }, { get: true })
// @ts-expect-error GET and HEAD refuse the reserved key 'select'
supabase.rpc('selector', { select: 1 }, { get: true })
// @ts-expect-error GET and HEAD refuse the reserved key 'limit'
supabase.rpc('paged', { limit: 1 }, { get: flag })
// a reserved key is refused whether it is sure or maybe
declare const maybeNum: number | undefined
// @ts-expect-error GET and HEAD refuse the reserved key 'limit'
supabase.rpc('paged', { limit: maybeNum }, { get: true })
// POST sends them in the body
const k1 = supabase.rpc('paged', { limit: 1 })
type _18aa = Expect<Equal<Data<typeof k1>, 'post'>>
const k2 = supabase.rpc('dotted', { 'x.order': 1 })
type _18ab = Expect<Equal<Data<typeof k2>, 'post'>>
const k3 = supabase.rpc('selector', { select: 1 })
type _18ac = Expect<Equal<Data<typeof k3>, 'post'>>
// not reserved: `color` and `ordered` aren't `or` / `order`, `sort_order` has no `.`-separated last segment
const k4 = supabase.rpc('colors', { color: 1, ordered: 2 }, { get: true })
type _18ad = Expect<Equal<Data<typeof k4>, 'get'>>
const k5 = supabase.rpc('sorted', { sort_order: 1 }, { get: true })
type _18ae = Expect<Equal<Data<typeof k5>, 'get'>>

// unused values
;(void num, maybeNum, obj, objs, strs, nums, anyJson, maybeObj, members, str)
