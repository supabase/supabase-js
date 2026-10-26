import { supabase } from '../client'
import type { Json } from '../fixture/db'
import type { Address } from '../fixture/db'
import type { Data, Equal, Expect, Status, Theme } from '../helpers'

// FactColumns: only columns whose returned value is the stored value (no jsonb, no composite, no representation)
// are narrowed. `data` is jsonb (`jsonb 'null'` passes `.not('data', 'is', null)` and comes back as null) and
// `channels.address` is a composite (all attributes NULL is `IS NULL`, yet it returns an object).

// ---- a bare `*`: identity sources only over FactColumns
const star = supabase.from('users').select('*').not('data', 'is', null)
declare const sd: Data<typeof star>[number]['data']
type _16a = Expect<Equal<typeof sd, Theme | null>>
// an ordinary column of the same select does narrow
const star2 = supabase.from('users').select('*').not('data', 'is', null).not('status', 'is', null)
declare const ss: Data<typeof star2>[number]['status']
type _16b = Expect<Equal<typeof ss, Status>>
declare const sd2: Data<typeof star2>[number]['data']
type _16c = Expect<Equal<typeof sd2, Theme | null>>
// `.is(col, null)` doesn't turn the column into `null` either
const star3 = supabase.from('users').select().is('data', null)
declare const sd3: Data<typeof star3>[number]['data']
type _16d = Expect<Equal<typeof sd3, Theme | null>>

// the composite column
const comp = supabase.from('channels').select('*').not('address', 'is', null)
declare const ca: Data<typeof comp>[number]['address']
type _16e = Expect<Equal<typeof ca, Address | null>>
const comp2 = supabase.from('channels').select().not('slug', 'is', null)
declare const cs: Data<typeof comp2>[number]['slug']
type _16f = Expect<Equal<typeof cs, string>>
// the same, re-selected
const comp3 = supabase.from('channels').select().not('address', 'is', null).select('*')
declare const ca3: Data<typeof comp3>[number]['address']
type _16g = Expect<Equal<typeof ca3, Address | null>>

// ---- a planned select: the entry's `sources` omit the non-faithful fields
const planned = supabase.from('users').select('username, data').not('data', 'is', null)
type _16h = Expect<Equal<Data<typeof planned>, { username: string; data: Theme | null }[]>>
const planned2 = supabase.from('users').select('username, status').not('status', 'is', null)
type _16i = Expect<Equal<Data<typeof planned2>, { username: string; status: Status }[]>>
// other columns of the select still narrow while `data` stays
const planned3 = supabase.from('messages').select('username, data').not('username', 'is', null)
type _16j = Expect<Equal<Data<typeof planned3>, { username: string; data: Json | null }[]>>

// ---- a union of relations: each member of the union has its own star provenance
declare const flag: boolean
const un = supabase
  .from(flag ? 'users' : 'channels')
  .select('*')
  .not('data', 'is', null)
declare const un1: Data<typeof un>[number]
type _16k = Expect<Equal<(typeof un1)['data'], Theme | Json | null>>
const un2 = supabase
  .from(flag ? 'messages' : 'channels')
  .select('*')
  .not('id', 'is', null)
declare const un3: Data<typeof un2>[number]
type _16l = Expect<Equal<(typeof un3)['id'], number>>

// ---- mutations don't apply facts, and `*` on a mutation is the full Row
const m = supabase.from('users').update({ username: 'x' }).select().not('status', 'is', null)
declare const mv: Data<typeof m>[number]['status']
type _16m = Expect<Equal<typeof mv, Status | null>>
