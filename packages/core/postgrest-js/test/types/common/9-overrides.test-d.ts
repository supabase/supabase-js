import { supabase } from '../client'
import type { Json } from '../fixture/db'
import type { Data, Equal, Expect, Theme } from '../helpers'

// the override replaces the column's value type; the column's own null stays outside
const a = supabase.from('users').select('username, data')
type _9a = Expect<Equal<Data<typeof a>, { username: string; data: Theme | null }[]>>

// a ::text cast replaces the wrapper
const b = supabase.from('users').select('username, data::text')
type _9b = Expect<Equal<Data<typeof b>, { username: string; data: string | null }[]>>

// the override reaches *, Insert / Update and filter values
const c = supabase.from('users').select('*').single()
type _9c = Expect<Equal<NonNullable<Data<typeof c>>['data'], Theme | null>>
supabase.from('users').insert({ username: 'x', data: { theme: 'light' } })
// @ts-expect-error Type '"blue"' is not assignable to type '"light" | "dark"'.
supabase.from('users').insert({ username: 'x', data: { theme: 'blue' } })
// @ts-expect-error Type '"blue"' is not assignable to type '"light" | "dark"'.
supabase.from('users').update({ data: { theme: 'blue' } })
supabase.from('users').select('username').eq('data', { theme: 'dark' })
// @ts-expect-error Type '"blue"' is not assignable to type '"light" | "dark"'.
supabase.from('users').select('username').eq('data', { theme: 'blue' })

// an outer-join | null survives the override
const d = supabase.from('messages').select('id, ...users(data)')
type _9d = Expect<Equal<Data<typeof d>, { id: number; data: Theme | null }[]>>

// a column with no override keeps the derived type
const e = supabase.from('channels').select('*').single()
type _9e = Expect<Equal<NonNullable<Data<typeof e>>['data'], Json | null>>

// a whole-result override keeps the nullability of a nullable scalar result
const f1 = supabase.rpc('get_status', { name_param: 'x' }).returns<string | null>().throwOnError()
type _9f1 = Expect<Equal<Data<typeof f1>, string | null>>
const f2 = supabase
  .rpc('get_status', { name_param: 'x' })
  .overrideTypes<string | null, { merge: false }>()
  .throwOnError()
type _9f2 = Expect<Equal<Data<typeof f2>, string | null>>

// the shapes the response state supplies are unchanged: the array, the single object, the maybeSingle `| null`
const g1 = supabase.from('users').select('*').returns<{ id: number }[]>().throwOnError()
type _9g1 = Expect<Equal<Data<typeof g1>, { id: number }[]>>
const g2 = supabase.from('users').select('*').single().returns<{ id: number }>()
type _9g2 = Expect<Equal<Data<typeof g2>, { id: number }>>
const g3 = supabase.from('users').select('*').maybeSingle().returns<{ id: number }>()
type _9g3 = Expect<Equal<Data<typeof g3>, { id: number } | null>>
const g4 = supabase.rpc('get_status', { name_param: 'x' }).returns<string>().throwOnError()
type _9g4 = Expect<Equal<Data<typeof g4>, string>>

// a whole-result override on a nullable scalar array replaces the data and keeps its null
const h1 = supabase.rpc('int_array_upto', { n: 2 }).returns<number[] | null>().throwOnError()
type _9h1 = Expect<Equal<Data<typeof h1>, number[] | null>>
const h2 = supabase
  .rpc('int_array_upto', { n: 2 })
  .overrideTypes<number[] | null, { merge: false }>()
  .throwOnError()
type _9h2 = Expect<Equal<Data<typeof h2>, number[] | null>>
const h3 = supabase.rpc('int_array_upto', { n: 2 }).returns<number[]>().throwOnError()
type _9h3 = Expect<Equal<Data<typeof h3>, number[]>>

// the array / object mismatch still errors when the override admits a null
const h4 = supabase.rpc('int_array_upto', { n: 2 }).returns<{ id: number } | null>()
type _9h4 = Expect<
  Equal<
    typeof h4,
    {
      Error: 'Type mismatch: Cannot cast array result to a single object. Use .overrideTypes<Array<YourType>> for array results or .single() to convert the result to a single object'
    }
  >
>
const h5 = supabase.rpc('get_status', { name_param: 'x' }).returns<string[] | null>()
type _9h5 = Expect<
  Equal<
    typeof h5,
    {
      Error: 'Type mismatch: Cannot cast single object to array type. Remove Array wrapper from return type or make sure you are not using .single() up in the calling chain'
    }
  >
>
