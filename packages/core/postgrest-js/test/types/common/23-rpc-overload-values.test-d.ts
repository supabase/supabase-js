import { supabase } from '../client'
import type { Data, Equal, Expect } from '../helpers'
declare const maybeD: number | undefined

// the values are checked against the overloads whose parameter names fit the key set, as PostgREST picks one:
// required <= keys <= all parameters
const ok1 = supabase.rpc('by_names', { a: 'x' })
type _23a = Expect<Equal<Data<typeof ok1>, 'one'>>
const ok2 = supabase.rpc('by_names', { a: 1, b: 2 })
type _23b = Expect<Equal<Data<typeof ok2>, 'two'>>
// `a` as a string with `b` is structurally a `{ a: string }`, but that overload takes no `b`
// @ts-expect-error Argument of type '[{ a: string; b: number; }]' is not assignable to parameter of type
supabase.rpc('by_names', { a: 'x', b: 1 })
// the one-argument overload takes a string
// @ts-expect-error Argument of type '[{ a: number; }]' is not assignable to parameter of type
supabase.rpc('by_names', { a: 1 })

// optional parameters: `d` may be left out
const ok3 = supabase.rpc('by_optional', { c: 1 })
type _23c = Expect<Equal<Data<typeof ok3>, 'c'>>
const ok4 = supabase.rpc('by_optional', { c: 1, d: 2 })
type _23d = Expect<Equal<Data<typeof ok4>, 'cd'>>
const ok5 = supabase.rpc('by_optional', { e: 'x' })
type _23e = Expect<Equal<Data<typeof ok5>, 'e'>>
// @ts-expect-error Argument of type '[{ c: number; d: string; }]' is not assignable to parameter of type
supabase.rpc('by_optional', { c: 1, d: 'x' })
// a maybe-sent key can still be sent: its value is checked
// @ts-expect-error Argument of type '[{ c: number; d: string | undefined; }]' is not assignable to parameter of type
supabase.rpc('by_optional', { c: 1, d: 'x' as string | undefined })
supabase.rpc('by_optional', { c: 1, d: maybeD })

// a maybe-sent key branches the key set: the values are checked per possible serialized key set, since with `b` present
// PostgREST picks the two-argument overload and `a` must be a number
declare const maybeB: number | undefined
// @ts-expect-error Argument of type '[{ a: string; b: number | undefined; }]' is not assignable to parameter of type
supabase.rpc('by_names', { a: 'invalid integer', b: maybeB })
// without `b` the one-argument overload is picked and `a` must be a string: this set fails the other way
// @ts-expect-error Argument of type '[{ a: number; b: number | undefined; }]' is not assignable to parameter of type
supabase.rpc('by_names', { a: 1, b: maybeB })
// every possible key set fits an overload: `{ c }` and `{ c, d }`
const ok6 = supabase.rpc('by_optional', { c: 1, d: maybeD })
type _23f = Expect<Equal<Data<typeof ok6>, 'c' | 'cd'>>
// a key that is exactly undefined is never sent: only `{ a }` is checked
const ok7 = supabase.rpc('by_names', { a: 'x', b: undefined })
type _23g = Expect<Equal<Data<typeof ok7>, 'one'>>
// GET goes through the same key sets: its arguments become query parameters
declare const maybeV: number | undefined
const ok8 = supabase.rpc('probe_opt', { a: 1, v: maybeV }, { get: true })
type _23h = Expect<Equal<Data<typeof ok8>, 'get-a' | 'get-av'>>
// @ts-expect-error Argument of type '[{ a: string; v: number | undefined; }, { get: true; }]' is not assignable to parameter of type
supabase.rpc('probe_opt', { a: 'x', v: maybeV }, { get: true })
