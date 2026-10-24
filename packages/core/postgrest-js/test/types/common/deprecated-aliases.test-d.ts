import { supabase } from '../client'
import type { Data, Equal, Expect, Status } from '../helpers'

// ---- returns replaces the whole data, as in v2: an array for rows, one object after .single()
const ret = supabase.from('users').select('username, status').returns<{ id: number }[]>()
type _da1 = Expect<Equal<Data<typeof ret>, { id: number }[]>>
const retThenSingle = supabase
  .from('users')
  .select('username, status')
  .returns<{ id: number }[]>()
  .single()
type _da2 = Expect<Equal<Data<typeof retThenSingle>, { id: number }>>
const singleThenRet = supabase
  .from('users')
  .select('username, status')
  .single()
  .returns<{ id: number }>()
type _da2b = Expect<Equal<Data<typeof singleThenRet>, { id: number }>>
// a single object over rows is the v2 mismatch error
const retMismatch = supabase.from('users').select('username, status').returns<{ id: number }>()
type _da2c = Expect<Equal<typeof retMismatch, typeof arrayToObject>>

// ---- overrideTypes merges by default: the override's keys replace, the others stay
const base = supabase.from('users').select('username, status')
const merged = base.overrideTypes<{ status: 'ONLINE' }[]>()
type _da3 = Expect<Equal<Data<typeof merged>, { username: string; status: 'ONLINE' }[]>>
const added = base.overrideTypes<{ extra: number }[]>()
type _da4 = Expect<
  Equal<Data<typeof added>, { username: string; status: Status | null; extra: number }[]>
>
const mergedOne = base.single().overrideTypes<{ status: 'ONLINE' }>()
type _da5 = Expect<Equal<Data<typeof mergedOne>, { username: string; status: 'ONLINE' }>>
// the optionality of the result is kept
const mergedMaybe = base.maybeSingle().overrideTypes<{ status: 'ONLINE' }>()
type _da6 = Expect<Equal<Data<typeof mergedMaybe>, { username: string; status: 'ONLINE' } | null>>
// an explicit `merge: true` is the default
const explicit = base.overrideTypes<{ status: 'ONLINE' }[], { merge: true }>()
type _da7 = Expect<Equal<Data<typeof explicit>, Data<typeof merged>>>

// ---- merge: false replaces the result
const replaced = base.overrideTypes<{ id: number }[], { merge: false }>()
type _da8 = Expect<Equal<Data<typeof replaced>, { id: number }[]>>
const replacedOne = base.single().overrideTypes<{ id: number }, { merge: false }>()
type _da9 = Expect<Equal<Data<typeof replacedOne>, { id: number }>>
const replacedMaybe = base.maybeSingle().overrideTypes<{ id: number }, { merge: false }>()
type _da10 = Expect<Equal<Data<typeof replacedMaybe>, { id: number } | null>>

// ---- an array result needs an array override, a single row an object
const arrayToObject = base.overrideTypes<{ id: number }>()
type _da11 = Expect<
  Equal<
    typeof arrayToObject,
    {
      Error: 'Type mismatch: Cannot cast array result to a single object. Use .overrideTypes<Array<YourType>> for array results or .single() to convert the result to a single object'
    }
  >
>
const objectToArray = base.single().overrideTypes<{ id: number }[]>()
type _da12 = Expect<
  Equal<
    typeof objectToArray,
    {
      Error: 'Type mismatch: Cannot cast single object to array type. Remove Array wrapper from return type or make sure you are not using .single() up in the calling chain'
    }
  >
>

// ---- the result is still a builder: it chains
const chained = base.overrideTypes<{ status: 'ONLINE' }[]>().eq('username', 'a').limit(1)
type _da13 = Expect<Equal<Data<typeof chained>, Data<typeof merged>>>

// ---- foreignTable: the deprecated alias of referencedTable on order, or, limit, range and filter
const embed = () => supabase.from('messages').select('id, channels(id)')
type Plain = { id: number; channels: { id: number } }[]
type Wide = { id: number; channels: { id: number } | null }[]

// a column of the referenced table is not checked against the root
embed().order('slug', { foreignTable: 'channels' })
embed().order('slug', { foreignTable: 'channels', ascending: false, nullsFirst: true })
embed().filter('slug', 'eq', 'x', { foreignTable: 'channels' })
embed().or('slug.eq.x', { foreignTable: 'channels' })

// it widens the embed it names, like referencedTable
const fo = embed().order('id', { foreignTable: 'channels' })
type _da15 = Expect<Equal<Data<typeof fo>, Plain>>
const fl = embed().limit(1, { foreignTable: 'channels' })
type _da16 = Expect<Equal<Data<typeof fl>, Wide>>
const fr = embed().range(0, 1, { foreignTable: 'channels' })
type _da17 = Expect<Equal<Data<typeof fr>, Wide>>
const ff = embed().filter('id', 'eq', 1, { foreignTable: 'channels' })
type _da18 = Expect<Equal<Data<typeof ff>, Wide>>
const fc = embed().or('id.eq.1', { foreignTable: 'channels' })
type _da19 = Expect<Equal<Data<typeof fc>, Wide>>
// ... and not another one
const fx = embed().limit(1, { foreignTable: 'other' })
type _da20 = Expect<Equal<Data<typeof fx>, Plain>>

// referencedTable wins when both are given
const both = embed().limit(1, { referencedTable: 'channels', foreignTable: 'other' })
type _da21 = Expect<Equal<Data<typeof both>, Wide>>
const bothOther = embed().limit(1, { referencedTable: 'other', foreignTable: 'channels' })
type _da22 = Expect<Equal<Data<typeof bothOther>, Plain>>
// foreignTable fills in when referencedTable is undefined
const undef = embed().limit(1, { referencedTable: undefined, foreignTable: 'channels' })
type _da23 = Expect<Equal<Data<typeof undef>, Wide>>
