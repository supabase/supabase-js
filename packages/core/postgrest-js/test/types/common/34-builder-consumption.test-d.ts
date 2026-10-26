import { supabase } from '../client'
import type { PostgrestFilterBuilder } from '../../../src/index'
import type { BState, MState, RB, Reselect, WB } from '../../../src/types/planner/lookup'
import type { RpcB } from '../../../src/types/planner/rpc'
import type { Data, Equal, Expect, Status } from '../helpers'

type Plan = Record<string, unknown>
type StatusRows = { status: Status | null }[]
type Ranked = { username: string; msg_count: number }[]
type DB = SupabaseDatabase

// The builder state (`RB`, `WB`, `Reselect`, `RpcB`) is what a caller sees in a type annotation, a generic constraint
// or a declaration emit. These cases consume a builder the way application code does: pass it on, return it,
// await it, chain the terminal modifiers.

// ---- F1: a builder is the same type however its select was reached
const direct = supabase.from('users').select('status')
const reselected = supabase.from('users').select('*').select('status')
const written = supabase.from('users').insert({ username: 'x' }).select('status')
declare let directVar: typeof direct
declare let reselectedVar: typeof reselected
directVar = reselected
reselectedVar = direct
type _34a = Expect<Equal<Data<typeof direct>, StatusRows>>
type _34a2 = Expect<Equal<Data<typeof reselected>, StatusRows>>
type _34a3 = Expect<Equal<Data<typeof written>, StatusRows>>
// a write relation's builder is a builder of its own, whatever its data
// @ts-expect-error Type 'PostgrestFilterBuilder<Reselect<WB<
directVar = written
// two selects of one relation are two builders
const other = supabase.from('users').select('username, status')
// @ts-expect-error Type 'PostgrestFilterBuilder<RB<
directVar = other
// @ts-expect-error Type 'PostgrestFilterBuilder<RB<
const otherVar: typeof other = direct
// ... and a re-select to that select string is the same builder as the select
const reselectedOther = supabase.from('users').select('status').select('username, status')
declare let otherVar2: typeof other
declare let reselectedOtherVar: typeof reselectedOther
otherVar2 = reselectedOther
reselectedOtherVar = other
// @ts-expect-error Type 'PostgrestFilterBuilder<Reselect<
reselectedVar = reselectedOther
// an rpc is not a relation read
// @ts-expect-error Type 'PostgrestFilterBuilder<RpcB<
directVar = supabase.rpc('get_online_users')

// ---- F2: the type arguments are the state aliases
type Parts<P> =
  P extends PostgrestFilterBuilder<infer B, infer E, infer F, infer M> ? [B, E, F, M] : never
type _34b = Expect<Equal<Parts<typeof direct>[0], RB<DB, 'public', 'users', 'status'>>>
type _34c = Expect<Equal<Parts<typeof written>[0], Reselect<WB<DB, 'public', 'users'>, 'status'>>>
type _34d = Expect<
  Equal<Parts<typeof reselected>[0], Reselect<RB<DB, 'public', 'users', '*'>, 'status'>>
>
const ranked = supabase.rpc('rank_users', { n: 3 })
type _34e = Expect<
  Equal<Parts<typeof ranked>[0], RpcB<DB, 'public', 'rank_users', { readonly n: 3 }, {}>>
>

// ---- F3: a builder as a function parameter, by `typeof` and by an alias of a function's return type
const readQuery = () => supabase.from('users').select('status')
const writeQuery = () => supabase.from('users').insert({ username: 'x' }).select('status')
const rpcQuery = () => supabase.rpc('rank_users', { n: 3 })
type ReadQuery = ReturnType<typeof readQuery>
type WriteQuery = ReturnType<typeof writeQuery>
type RpcQuery = ReturnType<typeof rpcQuery>
// the alias is the builder, spelled with its type arguments
type _34f = Expect<Equal<ReadQuery, typeof direct>>
type _34g = Expect<
  Equal<
    ReadQuery,
    PostgrestFilterBuilder<
      Parts<ReadQuery>[0],
      Parts<ReadQuery>[1],
      Parts<ReadQuery>[2],
      Parts<ReadQuery>[3]
    >
  >
>

async function statusesOf(b: typeof direct) {
  const { data } = await b
  return data
}
async function statusesOfAlias(b: ReadQuery) {
  const { data } = await b
  return data
}
async function writtenOf(b: WriteQuery) {
  const { data } = await b
  return data
}
async function rankedOf(b: RpcQuery) {
  const { data } = await b
  return data
}
// direct, re-selected and filtered builders of the same select are all accepted
statusesOf(supabase.from('users').select('status'))
statusesOf(supabase.from('users').select('*').select('status'))
statusesOf(readQuery())
statusesOfAlias(supabase.from('users').select('*').select('status'))
statusesOfAlias(supabase.from('users').select('status').eq('status', 'ONLINE'))
writtenOf(supabase.from('users').insert({ username: 'y' }).select('status'))
rankedOf(supabase.rpc('rank_users', { n: 3 }))
rankedOf(supabase.rpc('rank_users', { n: 3 }).select('*'))
rankedOf(supabase.rpc('rank_users', { n: 3 }).eq('username', 'x'))
// the arguments are not part of the state: the same function and the same key set
rankedOf(supabase.rpc('rank_users', { n: 4 }))
// another select, another kind of builder, another rpc call: not accepted
// @ts-expect-error Argument of type 'PostgrestFilterBuilder<RB<
statusesOf(supabase.from('users').select('username, status'))
// @ts-expect-error Argument of type 'PostgrestFilterBuilder<Reselect<WB<
statusesOf(supabase.from('users').insert({ username: 'y' }).select('status'))
// @ts-expect-error Argument of type 'PostgrestFilterBuilder<RB<
writtenOf(supabase.from('users').select('status'))
// @ts-expect-error Argument of type 'PostgrestFilterBuilder<RpcB<
rankedOf(supabase.rpc('get_online_users'))
type _34h = Expect<Equal<Awaited<ReturnType<typeof statusesOf>>, StatusRows | null>>
type _34h2 = Expect<Equal<Awaited<ReturnType<typeof statusesOfAlias>>, StatusRows | null>>
type _34h3 = Expect<Equal<Awaited<ReturnType<typeof writtenOf>>, StatusRows | null>>
type _34h4 = Expect<Equal<Awaited<ReturnType<typeof rankedOf>>, Ranked | null>>

// ---- F4: a function annotated to return a builder
function readBack(): ReadQuery {
  return supabase.from('users').select('status')
}
function readBackReselected(): ReadQuery {
  return supabase.from('users').select('*').select('status')
}
function writeBack(): WriteQuery {
  return supabase.from('users').insert({ username: 'x' }).select('status')
}
function rpcBack(): RpcQuery {
  return supabase.rpc('rank_users', { n: 3 })
}
type _34i = Expect<Equal<Data<ReturnType<typeof readBack>>, StatusRows>>
type _34i2 = Expect<Equal<Data<ReturnType<typeof readBackReselected>>, StatusRows>>
type _34i3 = Expect<Equal<Data<ReturnType<typeof writeBack>>, StatusRows>>
type _34i4 = Expect<Equal<Data<ReturnType<typeof rpcBack>>, Ranked>>
function wrongSelect(): ReadQuery {
  // @ts-expect-error Type 'PostgrestFilterBuilder<RB<
  return supabase.from('users').select('username')
}
function wrongKind(): ReadQuery {
  // @ts-expect-error Type 'PostgrestFilterBuilder<Reselect<WB<
  return supabase.from('users').insert({ username: 'x' }).select('status')
}

// ---- F5: a generic function over the builder's type arguments takes every kind of builder
declare function stateOf<B extends BState, E, F, M extends MState>(
  b: PostgrestFilterBuilder<B, E, F, M>
): [B['k'], B['r'], B['q']]
// (the builders are bound first: a `select` call that is itself the argument of a generic function is inferred
// against its constraint and reads its select string as `string`)
const g1 = stateOf(direct)
type _34j = Expect<Equal<typeof g1, ['r', 'users', 'status']>>
const g2 = stateOf(reselected)
type _34k = Expect<Equal<typeof g2, ['r', 'users', 'status']>>
const g3 = stateOf(written)
type _34l = Expect<Equal<typeof g3, ['w', 'users', 'status']>>
const g4 = stateOf(ranked)
type _34m = Expect<Equal<typeof g4, ['f', 'rank_users', '*']>>
// a re-select of an rpc is the rpc's state with the select string of the re-select
const messageIds = supabase.rpc('get_user_messages', { user_name: 'x' }).select('id')
const g5 = stateOf(messageIds)
type _34n = Expect<Equal<typeof g5, ['f', 'get_user_messages', 'id']>>
// a filter keeps the state
const filtered = supabase.from('users').select('status').eq('status', 'ONLINE')
const g6 = stateOf(filtered)
type _34o = Expect<Equal<typeof g6, ['r', 'users', 'status']>>

// the response the generic function awaits is the builder's own
declare function dataOf<B extends BState, E, F, M extends MState>(
  b: PostgrestFilterBuilder<B, E, F, M>
): Promise<Data<PostgrestFilterBuilder<B, E, F, M>>>
const d1 = dataOf(direct)
type _34p = Expect<Equal<Awaited<typeof d1>, StatusRows>>
const d2 = dataOf(written)
type _34q = Expect<Equal<Awaited<typeof d2>, StatusRows>>
const d3 = dataOf(ranked)
type _34r = Expect<Equal<Awaited<typeof d3>, Ranked>>

// ---- F6: awaiting a builder, or chaining `then`, gives the builder's data
async function consume() {
  const r1 = await direct
  type _34s = Expect<Equal<NonNullable<typeof r1.data>, StatusRows>>
  const r2 = await reselected
  type _34t = Expect<Equal<NonNullable<typeof r2.data>, StatusRows>>
  const r3 = await written
  type _34u = Expect<Equal<NonNullable<typeof r3.data>, StatusRows>>
  const r4 = await ranked
  type _34v = Expect<Equal<NonNullable<typeof r4.data>, Ranked>>
  // the failure branch carries no data
  if (r1.error) {
    type _34w = Expect<Equal<typeof r1.data, null>>
  } else {
    type _34w2 = Expect<Equal<typeof r1.data, StatusRows>>
  }
}
const t1 = direct.then((r) => r.data)
type _34x = Expect<Equal<Awaited<typeof t1>, StatusRows | null>>
const t2 = reselected.then((r) => r.data)
type _34y = Expect<Equal<Awaited<typeof t2>, StatusRows | null>>
const t3 = written.then((r) => r.data)
type _34z = Expect<Equal<Awaited<typeof t3>, StatusRows | null>>
const t4 = ranked.then((r) => r.data)
type _34aa = Expect<Equal<Awaited<typeof t4>, Ranked | null>>

// ---- F7: terminal modifiers and overrides on a re-selected write builder
const w1 = written.throwOnError()
type _34ab = Expect<Equal<Data<typeof w1>, StatusRows>>
type _34ab2 = Expect<Equal<Awaited<typeof w1>['data'], StatusRows>>
const w2 = written.overrideTypes<{ status: 'ONLINE' }[]>()
type _34ac = Expect<Equal<Data<typeof w2>, { status: 'ONLINE' }[]>>
const w3 = written.overrideTypes<{ id: number }[], { merge: false }>().throwOnError()
type _34ad = Expect<Equal<Data<typeof w3>, { id: number }[]>>
const w4 = written.returns<{ id: number }[]>()
type _34ae = Expect<Equal<Data<typeof w4>, { id: number }[]>>
const w5 = written.cast<{ id: number }>()
type _34af = Expect<Equal<Data<typeof w5>, { id: number }[]>>
const w6 = written.single().overrideTypes<{ status: 'ONLINE' }>()
type _34ag = Expect<Equal<Data<typeof w6>, { status: 'ONLINE' }>>
// a single object over rows is the mismatch, as on a read builder
const w7 = written.overrideTypes<{ id: number }>()
type _34ah = Expect<
  Equal<
    typeof w7,
    {
      Error: 'Type mismatch: Cannot cast array result to a single object. Use .overrideTypes<Array<YourType>> for array results or .single() to convert the result to a single object'
    }
  >
>
// the same on a re-selected read builder and an rpc
const w8 = reselected.throwOnError().overrideTypes<{ status: 'ONLINE' }[]>()
type _34ai = Expect<Equal<Data<typeof w8>, { status: 'ONLINE' }[]>>
const w9 = ranked.throwOnError().overrideTypes<{ msg_count: 1 }[]>()
type _34aj = Expect<Equal<Data<typeof w9>, { username: string; msg_count: 1 }[]>>

// ---- F8: explain() and geojson() answer with one plan or one collection, not one per row
// an update, a delete and an upsert that ask for a representation
const e1 = supabase.from('users').update({ status: 'ONLINE' }).eq('username', 'x').select('status')
const e1p = e1.explain()
type _34ak = Expect<Equal<Data<typeof e1p>, string>>
const e1j = e1.explain({ format: 'json' })
type _34al = Expect<Equal<Data<typeof e1j>, Plan[]>>
const e1g = e1.geojson()
type _34am = Expect<Equal<Data<typeof e1g>, Plan>>
const e2 = supabase.from('users').delete().eq('username', 'x').select('status')
const e2j = e2.explain({ format: 'json' })
type _34an = Expect<Equal<Data<typeof e2j>, Plan[]>>
const e2g = e2.geojson()
type _34ao = Expect<Equal<Data<typeof e2g>, Plan>>
const e3 = supabase.from('users').upsert({ username: 'x' }).select('status')
const e3j = e3.explain({ format: 'json' })
type _34ap = Expect<Equal<Data<typeof e3j>, Plan[]>>
// an insert
const e4j = written.explain({ format: 'json' })
type _34aq = Expect<Equal<Data<typeof e4j>, Plan[]>>
const e4g = written.geojson()
type _34ar = Expect<Equal<Data<typeof e4g>, Plan>>
// an insert and an update that do not ask for a representation
const e5 = supabase.from('users').insert({ username: 'x' }).explain({ format: 'json' })
type _34as = Expect<Equal<Data<typeof e5>, Plan[]>>
const e6 = supabase.from('users').update({ status: 'ONLINE' }).eq('username', 'x').explain()
type _34at = Expect<Equal<Data<typeof e6>, string>>
// an rpc, whatever it returns
const e7 = ranked.explain()
type _34au = Expect<Equal<Data<typeof e7>, string>>
const e7j = ranked.explain({ format: 'json' })
type _34av = Expect<Equal<Data<typeof e7j>, Plan[]>>
const e7g = ranked.geojson()
type _34aw = Expect<Equal<Data<typeof e7g>, Plan>>
const e8 = supabase.rpc('get_status', { name_param: 'x' }).explain({ format: 'json' })
type _34ax = Expect<Equal<Data<typeof e8>, Plan[]>>
const e9 = supabase
  .rpc('get_user_messages', { user_name: 'x' })
  .select('id')
  .explain({ format: 'json' })
type _34ay = Expect<Equal<Data<typeof e9>, Plan[]>>
// a relation read with an embed, a filter and a re-select
const e10 = supabase
  .from('users')
  .select('username, messages(id, channels(id))')
  .eq('username', 'x')
const e10j = e10.explain({ format: 'json' })
type _34az = Expect<Equal<Data<typeof e10j>, Plan[]>>
const e10g = e10.geojson()
type _34ba = Expect<Equal<Data<typeof e10g>, Plan>>
const e11j = reselected.explain({ format: 'json' })
type _34bb = Expect<Equal<Data<typeof e11j>, Plan[]>>
// maybeSingle() unwraps the plan array, single() keeps it
const e12 = written.maybeSingle().explain({ format: 'json' })
type _34bc = Expect<Equal<Data<typeof e12>, Plan>>
const e13 = ranked.single().explain({ format: 'json' })
type _34bd = Expect<Equal<Data<typeof e13>, Plan[]>>
// `head` only switches a GET: a write builder's select keeps its body, and so does its plan
const e14 = supabase.from('users').insert({ username: 'x' }).select('status', { head: true })
const e14p = e14.explain()
type _34be = Expect<Equal<Data<typeof e14p>, string>>
// explain() and geojson() builders are terminal on every kind of builder
// @ts-expect-error Property 'eq' does not exist on type
e7j.eq('username', 'x')
// @ts-expect-error Property 'single' does not exist on type
e1j.single()

// ---- F9: a re-select whose select string may be undefined is `select=*` for that member, on a write and an rpc builder
declare const maybeStatus: 'status' | undefined
declare const maybeId: 'id' | undefined
const star1 = supabase.from('users').insert({ username: 'x' }).select('*')
const m1 = supabase.from('users').insert({ username: 'x' }).select(maybeStatus)
type _34bf = Expect<Equal<Data<typeof m1>, (StatusRows[number] | Data<typeof star1>[number])[]>>
const star2 = supabase.rpc('get_user_messages', { user_name: 'x' }).select('*')
const m2 = supabase.rpc('get_user_messages', { user_name: 'x' }).select(maybeId)
type _34bg = Expect<Equal<Data<typeof m2>, ({ id: number } | Data<typeof star2>[number])[]>>
