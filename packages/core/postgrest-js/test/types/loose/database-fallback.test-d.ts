import type { GenericDatabase, PostgrestClient } from '../../../src/index'
import { supabase } from '../client'
import type { Count, Data, Equal, Expect } from '../helpers'
declare const cols: string
declare const generic: PostgrestClient<GenericDatabase>

// A chain with no generated entry reads the client's Database types: the relation's columns keep their types, any
// other key (an alias, an embed) is `any`, and an rpc answers with the function's `Returns`.
type Note = { id: number; body: string | null; owner: string }
type Fallback<R> = R & { [k: string]: any }

// ---- relations
const n1 = supabase.from('notes').select('id, body, mine:owner, tags(id)')
type _n1 = Expect<Equal<Data<typeof n1>, Fallback<Note>[]>>
const n1r = n1.then((x) => (x.error ? undefined : x.data[0]))
type _n1id = Expect<Equal<NonNullable<Awaited<typeof n1r>>['id'], number>>
type _n1body = Expect<Equal<NonNullable<Awaited<typeof n1r>>['body'], string | null>>
type _n1alias = Expect<Equal<NonNullable<Awaited<typeof n1r>>['mine'], any>>
type _n1emb = Expect<Equal<NonNullable<Awaited<typeof n1r>>['tags'], any>>

// an unindexed select on a relation that has other planned selects
const n2 = supabase.from('users').select('username, catchphrase, age_range')
type _n2 = Expect<Equal<Data<typeof n2>[number]['username'], string>>
type _n2b = Expect<Equal<Data<typeof n2>[number]['nope'], any>>

// a dynamic select
const n3 = supabase.from('notes').select(cols)
type _n3 = Expect<Equal<Data<typeof n3>, Fallback<Note>[]>>

// a mutation's select
const n4 = supabase.from('notes').insert({ owner: 'x' }).select('id, body')
type _n4 = Expect<Equal<Data<typeof n4>, Fallback<Note>[]>>
const n5 = supabase.from('notes').update({ body: 'x' }).eq('id', 1).select(cols)
type _n5 = Expect<Equal<Data<typeof n5>, Fallback<Note>[]>>
const n6 = supabase.from('notes').upsert({ owner: 'x' }).select('id')
type _n6 = Expect<Equal<Data<typeof n6>, Fallback<Note>[]>>
const n7 = supabase.from('notes').delete().eq('id', 1).select('id')
type _n7 = Expect<Equal<Data<typeof n7>, Fallback<Note>[]>>

// the response modifiers compose as for a planned entry
const m1 = supabase.from('notes').select('id, body').single()
type _m1 = Expect<Equal<Data<typeof m1>, Fallback<Note>>>
const m2 = supabase.from('notes').select('id, body').maybeSingle()
type _m2 = Expect<Equal<Data<typeof m2>, Fallback<Note> | null>>
const m3 = supabase.from('notes').select('id, body', { count: 'exact' })
type _m3 = Expect<Equal<Count<typeof m3>, number>>
type _m3d = Expect<Equal<Data<typeof m3>, Fallback<Note>[]>>
const m4 = supabase.from('notes').select('id, body', { head: true })
type _m4 = Expect<Equal<Data<typeof m4>, null>>
const m5 = supabase.from('notes').select('id, body').throwOnError()
type _m5 = Expect<Equal<Data<typeof m5>, Fallback<Note>[]>>
const m6 = supabase.from('notes').select('id, body').cast<{ id: number }>()
type _m6 = Expect<Equal<Data<typeof m6>, { id: number }[]>>
const m7 = supabase.from('notes').select('id, body').eq('id', 1).order('id').limit(1).single()
type _m7 = Expect<Equal<Data<typeof m7>, Fallback<Note>>>
const m8 = supabase.from('notes').select(cols).cast<{ id: number }>().single()
type _m8 = Expect<Equal<Data<typeof m8>, { id: number }>>

// payloads are typed from Insert / Update, whether or not an entry exists
supabase.from('notes').insert({ owner: 'x', body: null })
supabase.from('notes').update({ body: 'x' })
supabase.from('notes').upsert([{ owner: 'x' }])
// @ts-expect-error Type 'number' is not assignable to type 'string'
supabase.from('notes').insert({ owner: 1 })
// @ts-expect-error Type 'number' is not assignable to type 'never'
supabase.from('notes').insert({ owner: 'x', nope: 1 })
// @ts-expect-error Type 'number' is not assignable to type 'string'
supabase.from('notes').update({ body: 1 })
// @ts-expect-error Type 'number' is not assignable to type 'string'
supabase.from('notes').upsert({ owner: 1 })

// a generated entry wins over the fallback
const e1 = supabase.from('users').select('username')
type _e1 = Expect<Equal<Data<typeof e1>, { username: string }[]>>
// ... and a bare `*` is the relation's row, as before
const e2 = supabase.from('notes').select()
type _e2 = Expect<Equal<Data<typeof e2>, Note[]>>
// a planned entry with an error is still rejected
// @ts-expect-error PGRST200
supabase.from('users').select('username, nope(id)')

// no Database (a client that knows no relation): rows stay Record<string, unknown>
const g1 = generic.from('anything').select('a, b(c)')
type _g1 = Expect<Equal<Data<typeof g1>, Record<string, unknown>[]>>
const g2 = generic.from('anything').select(cols).single()
type _g2 = Expect<Equal<Data<typeof g2>, unknown>>
const g3 = generic.rpc('anything')
type _g3 = Expect<Equal<Data<typeof g3>, unknown>>

// ---- rpc with no planned call
// a scalar
const r1 = supabase.rpc('db_only_count', { n: 1 })
type _r1 = Expect<Equal<Data<typeof r1>, number>>
// a setof / array return: rows, one row under single()
const r2 = supabase.rpc('db_only_rows', { owner: 'x' })
type _r2 = Expect<Equal<Data<typeof r2>, { id: number; title: string | null }[]>>
const r2s = supabase.rpc('db_only_rows', { owner: 'x' }).single()
type _r2s = Expect<Equal<Data<typeof r2s>, { id: number; title: string | null }>>
const r2m = supabase.rpc('db_only_rows', { owner: 'x' }).maybeSingle()
type _r2m = Expect<Equal<Data<typeof r2m>, { id: number; title: string | null } | null>>
const r2t = supabase.rpc('db_only_rows', { owner: 'x' }).throwOnError()
type _r2t = Expect<Equal<Data<typeof r2t>, { id: number; title: string | null }[]>>
const r2c = supabase.rpc('db_only_rows', { owner: 'x' }, { count: 'exact' })
type _r2c = Expect<Equal<Count<typeof r2c>, number>>
const r2h = supabase.rpc('db_only_rows', { owner: 'x' }, { head: true })
type _r2h = Expect<Equal<Data<typeof r2h>, null>>
const r2x = supabase.rpc('db_only_rows', { owner: 'x' }).cast<{ id: number }>()
type _r2x = Expect<Equal<Data<typeof r2x>, { id: number }[]>>
// no arguments, `undefined` returns
const r3 = supabase.rpc('db_only_nothing')
type _r3 = Expect<Equal<Data<typeof r3>, undefined>>
// overloads: the union of their returns
const r4 = supabase.rpc('db_only_poly', { a: 'x' })
type _r4 = Expect<Equal<Data<typeof r4>, { a_id: number }[] | string>>
// a call the planner has no entry for, on a function the Database has (`find_partial` is only planned without `search`)
const r5 = supabase.rpc('find_partial', { cid: 1, search: 'x' })
type _r5 = Expect<Equal<Data<typeof r5>[number]['channel_id'], number>>
// arguments are checked against Args
// @ts-expect-error Type 'string' is not assignable to type 'number'
supabase.rpc('db_only_count', { n: 'x' })
// @ts-expect-error Argument of type
supabase.rpc('db_only_rows', { nope: 'x' })
// a function the Database doesn't have is rejected, and its data stays unknown
// @ts-expect-error Argument of type
const r8 = supabase.rpc('no_such_function')
type _r8 = Expect<Equal<Data<typeof r8>, unknown>>
// a call with an entry is unchanged
const r6 = supabase.rpc('get_status', { name_param: 'x' })
type _r6 = Expect<Equal<Data<typeof r6>, 'ONLINE' | 'OFFLINE' | null>>
export {}
