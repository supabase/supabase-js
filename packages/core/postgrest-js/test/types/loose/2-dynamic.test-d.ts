import { supabase } from '../client'
import type { Data, Equal, Expect } from '../helpers'
declare const cols: string
declare const part: string
declare const full: boolean

// a dynamic select has no entry to look up: the rows are the relation's Row from the Database, with any other key `any`
// (the strict policy keeps `unknown`, see strict/2-dynamic)

const s = supabase.from('users').select(cols)
type _2a = Expect<Equal<Data<typeof s>[number]['username'], string>>
type _2a2 = Expect<Equal<Data<typeof s>[number]['whatever'], any>>

const p = supabase.from('users').select(`id,${part}`)
type _2b = Expect<Equal<Data<typeof p>[number]['username'], string>>

// pattern whose prefix would otherwise be a planned key: still dynamic
const p2 = supabase.from('users').select(`username, ${part}`)
type _2c = Expect<Equal<Data<typeof p2>[number]['catchphrase'], string | null>>

// union of a finite literal and a pattern -> dynamic
const u = supabase.from('users').select(full ? 'username' : `status,${part}`)
type _2d = Expect<Equal<Data<typeof u>[number]['username'], string>>

// a literal -> lookup
const l = supabase.from('users').select('username')
type _2e = Expect<Equal<Data<typeof l>, { username: string }[]>>

// dynamic selects are also accepted on mutations and keep a mutation's null/array shape
const m = supabase.from('users').update({ username: 'x' }).select(cols)
type _2f = Expect<Equal<Data<typeof m>[number]['username'], string>>
