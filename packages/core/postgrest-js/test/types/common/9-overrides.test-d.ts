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
