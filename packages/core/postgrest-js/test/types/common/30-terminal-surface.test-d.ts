import { supabase } from '../client'
import type { Data, Equal, Expect } from '../helpers'

type Plan = Record<string, unknown>

// A modifier that changes nothing but the error type hands back the builder it was called on: a terminal builder
// (explain, geojson) stays terminal, so single() / maybeSingle() / filters are not offered on a response whose
// representation they would replace.

// ---- F3: throwOnError() and stripNulls() keep the terminal surface
const t1 = supabase.from('users').select('username').explain({ format: 'json' }).throwOnError()
type _30a = Expect<Equal<Data<typeof t1>, Plan[]>>
// @ts-expect-error Property 'single' does not exist on type
t1.single()
// @ts-expect-error Property 'maybeSingle' does not exist on type
t1.maybeSingle()
// @ts-expect-error Property 'eq' does not exist on type
t1.eq('username', 'x')

const t2 = supabase.from('users').select('username').explain().stripNulls()
// @ts-expect-error Property 'single' does not exist on type
t2.single()

const t3 = supabase.from('users').select('username').geojson().throwOnError()
type _30b = Expect<Equal<Data<typeof t3>, Plan>>
// @ts-expect-error Property 'single' does not exist on type
t3.single()
// @ts-expect-error Property 'order' does not exist on type
t3.order('username')

// the terminal modifiers chain among themselves
const t4 = supabase.from('users').select('username').explain({ format: 'json' }).throwOnError()
const t5 = t4.stripNulls().throwOnError()
// @ts-expect-error Property 'single' does not exist on type
t5.single()
const t5b = t4.throwOnError()
type _30c = Expect<Equal<Data<typeof t5b>, Plan[]>>

// a filter builder keeps its whole surface
const t6 = supabase.from('users').select('username').throwOnError().eq('username', 'x').single()
type _30d = Expect<Equal<Data<typeof t6>, { username: string }>>
const t7 = supabase.from('users').select('username').stripNulls().order('username').maybeSingle()
type _30e = Expect<Equal<Data<typeof t7>, { username: string } | null>>
