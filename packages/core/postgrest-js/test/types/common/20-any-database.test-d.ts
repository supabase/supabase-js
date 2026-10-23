import type { PostgrestClient } from '../../../src/index'
import type { Data, Equal, Expect } from '../helpers'

// `any` as the Database is an untyped client: any name, any argument, any column, results `any`, never an
// "unplanned" rejection (this file runs under both the loose and the strict policy)
declare const untyped: PostgrestClient<any>
declare const untypedSchema: PostgrestClient<any, 'other'>

// relation names that no schema has, selects the planner never saw
const s1 = untyped.from('no_such_table').select('a, b(c, d)')
type _20a = Expect<Equal<Data<typeof s1>, any[]>>
const s2 = untyped.from('no_such_table').select()
type _20b = Expect<Equal<Data<typeof s2>, any[]>>
// a relation the planned database does have is not looked up either
const s3 = untyped.from('users').select('username')
type _20c = Expect<Equal<Data<typeof s3>, any[]>>
declare const cols: string
const s4 = untyped.from('no_such_table').select(cols)
type _20d = Expect<Equal<Data<typeof s4>, any[]>>
const s5 = untyped.from('no_such_table').select('a').single()
type _20e = Expect<Equal<Data<typeof s5>, any>>

// filters and modifiers on any column, with any value
untyped
  .from('no_such_table')
  .select('a')
  .eq('nope', 1)
  .neq('x', 'y')
  .in('z', [1, 'a'])
  .order('q')
  .limit(1)
untyped.from('no_such_table').select('a, b(c)').eq('b.c', { any: 1 }).not('b', 'is', null)
untyped.from('no_such_table').select().match({ a: 1, b: 'x' }).or('a.eq.1,b.is.null')

// mutations
const m1 = untyped.from('no_such_table').insert({ a: 1 }).select('a')
type _20f = Expect<Equal<Data<typeof m1>, any[]>>
untyped.from('no_such_table').update({ a: 1, b: 'x' }).eq('id', 1)
untyped.from('no_such_table').upsert([{ a: 1 }, { b: 2 }])
untyped.from('no_such_table').delete().eq('id', 1)

// rpc: any function, any arguments, any methods
const r1 = untyped.rpc('no_such_function', { a: 1, b: 'x' })
type _20g = Expect<Equal<Data<typeof r1>, any>>
const r2 = untyped.rpc('no_such_function')
type _20h = Expect<Equal<Data<typeof r2>, any>>
const r3 = untyped.rpc('no_such_function', { a: 1 }, { get: true })
type _20i = Expect<Equal<Data<typeof r3>, any>>
const r4 = untyped.rpc('get_status', { name_param: 1 }, { count: 'exact' })
type _20j = Expect<Equal<Data<typeof r4>, any>>
untyped.rpc('no_such_function', { a: 1 }, { head: true })
untyped.rpc('no_such_function').select('a, b(c)').eq('a', 1).order('b')
const r5 = untyped.rpc('no_such_function').eq('whatever', 'x').select('a')
type _20k = Expect<Equal<Data<typeof r5>, any>>

// another schema: any name too, and an explicit schema name changes nothing
const o1 = untyped.schema('whatever').from('no_such_table').select('a')
type _20l = Expect<Equal<Data<typeof o1>, any[]>>
const o2 = untyped.schema('whatever').rpc('no_such_function', { a: 1 })
type _20m = Expect<Equal<Data<typeof o2>, any>>
const o3 = untypedSchema.from('no_such_table').select('a')
type _20n = Expect<Equal<Data<typeof o3>, any[]>>
const o4 = untypedSchema.rpc('no_such_function', { a: 1 })
type _20o = Expect<Equal<Data<typeof o4>, any>>
