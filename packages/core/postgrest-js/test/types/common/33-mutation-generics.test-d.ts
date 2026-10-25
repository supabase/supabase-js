import { supabase } from '../client'
import type { PostgrestClient } from '../../../src/index'
import type { Count, Data, Equal, Expect } from '../helpers'

type Users = SupabaseDatabase['public']['Tables']['users']

// v2's explicit row generic on insert, upsert and update still compiles, and still rejects excess properties
supabase.from('users').insert<Users['Insert']>({ username: 'x' })
supabase.from('users').insert<Users['Insert']>([{ username: 'x' }, { username: 'y' }])
supabase.from('users').upsert<Users['Insert']>({ username: 'x' }, { onConflict: 'username' })
supabase.from('users').update<Users['Update']>({ username: 'x' }).eq('username', 'y')
// @ts-expect-error Object literal may only specify known properties
supabase.from('users').insert<Users['Insert']>({ username: 'x', nope: 1 })
// @ts-expect-error Object literal may only specify known properties
supabase.from('users').upsert<Users['Insert']>({ username: 'x', nope: 1 })
// @ts-expect-error Object literal may only specify known properties
supabase.from('users').update<Users['Update']>({ username: 'x', nope: 1 })

// inferred calls keep reading the option bag
const i1 = supabase.from('users').insert({ username: 'x' }, { count: 'exact' }).throwOnError()
type _33a = Expect<Equal<Count<typeof i1>, number>>
type _33b = Expect<Equal<Data<typeof i1>, null>>
const i2 = supabase.from('users').upsert({ username: 'x' }, { count: 'exact' }).throwOnError()
type _33c = Expect<Equal<Count<typeof i2>, number>>
const i3 = supabase
  .from('users')
  .update({ username: 'x' }, { count: 'exact' })
  .eq('username', 'y')
  .throwOnError()
type _33d = Expect<Equal<Count<typeof i3>, number>>

// an untyped client's rpc result takes the `.returns` override after `.single()`
declare const untyped: PostgrestClient<any>
const r1 = untyped.rpc('no_such_function').single().returns<number[]>().throwOnError()
type _33e = Expect<Equal<Data<typeof r1>, number[]>>
