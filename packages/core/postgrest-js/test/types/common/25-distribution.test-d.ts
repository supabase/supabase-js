import { supabase } from '../client'
import type { Count, Data, Equal, Expect, Status, Theme } from '../helpers'

// Everything a call can receive is read per possible value: a union of option bags, an absent bag, an argument that
// may be `undefined` are each a possible request, and the response is the union of what each one sends.

type UserRow = {
  username: string
  status: Status | null
  age_range: string | null
  catchphrase: string | null
  data: Theme | null
}
type MessageRow = Data<ReturnType<typeof starMessages>>[number]
function starMessages() {
  return supabase.from('messages').select()
}
type Plain = { id: number; channels: { id: number } }[]
type Wide = { id: number; channels: { id: number } | null }[]

// ---- F1: a select string that may be undefined sends `select=*`
declare const maybeColumns: 's:status' | undefined
const a1 = supabase.from('users').select(maybeColumns).throwOnError()
type _25a = Expect<Equal<Data<typeof a1>, ({ s: Status | null } | UserRow)[]>>
// with an option bag
const a2 = supabase.from('users').select(maybeColumns, { count: 'exact' }).throwOnError()
type _25b = Expect<Equal<Data<typeof a2>, ({ s: Status | null } | UserRow)[]>>
type _25b2 = Expect<Equal<Count<typeof a2>, number>>
// after a mutation
declare const maybeEmbed: 'id, channels(id)' | undefined
const a3 = supabase.from('messages').update({ id: 1 }).select(maybeEmbed).throwOnError()
type _25c = Expect<Equal<Data<typeof a3>, (Plain[number] | MessageRow)[]>>
// a literal, an explicit undefined and a missing argument keep their exact reading
const a4 = supabase.from('users').select('s:status')
type _25d = Expect<Equal<Data<typeof a4>, { s: Status | null }[]>>
const a5 = supabase.from('users').select(undefined)
type _25e = Expect<Equal<Data<typeof a5>, UserRow[]>>
const a6 = supabase.from('users').select()
type _25f = Expect<Equal<Data<typeof a6>, UserRow[]>>
// a possibly undefined string that is a union of literals
declare const maybeEither: 's:status' | 'username' | undefined
const a7 = supabase.from('users').select(maybeEither)
type _25g = Expect<
  Equal<Data<typeof a7>, ({ s: Status | null } | { username: string } | UserRow)[]>
>

// ---- F2: a referencedTable that one member of a bag names widens that embed
declare const maybeRef: { referencedTable: 'channels' } | {}
const b1 = supabase.from('messages').select('id, channels(id)').or('id.eq.-1', maybeRef)
type _25h = Expect<Equal<Data<typeof b1>, Wide>>
const b2 = supabase.from('messages').select('id, channels(id)').limit(1, maybeRef)
type _25i = Expect<Equal<Data<typeof b2>, Wide>>
const b3 = supabase.from('messages').select('id, channels(id)').range(0, 1, maybeRef)
type _25j = Expect<Equal<Data<typeof b3>, Wide>>
const b4 = supabase.from('messages').select('id, channels(id)').filter('id', 'eq', 1, maybeRef)
type _25k = Expect<Equal<Data<typeof b4>, Wide>>
// the embed's own columns are not root columns when the option may name it
supabase.from('messages').select('id, channels(id)').order('slug', maybeRef)
supabase.from('messages').select('id, channels(id)').filter('slug', 'eq', 'x', maybeRef)
// a union of two embeds' names widens both; a union of absent members widens none
declare const refOrUndefined: { referencedTable: 'channels' } | { referencedTable: undefined }
const b5 = supabase.from('messages').select('id, channels(id)').or('id.eq.-1', refOrUndefined)
type _25l = Expect<Equal<Data<typeof b5>, Wide>>
declare const noRef: { referencedTable: undefined } | {}
const b6 = supabase.from('messages').select('id, channels(id)').limit(1, noRef)
type _25m = Expect<Equal<Data<typeof b6>, Plain>>

// ---- F5: the request method is worked out per bag member
declare const headGetOrCount: { head: true; get: true } | { count: 'exact' }
const c1 = supabase.rpc('ping', { n: 1 }, headGetOrCount)
type _25n = Expect<Equal<Data<typeof c1>, null>>
// a bag of GET and POST members unions both planned calls
declare const getOrNot: { get: true } | { count: 'exact' }
const c2 = supabase.rpc('get_status', { name_param: 'x' }, getOrNot)
type _25o = Expect<Equal<Data<typeof c2>, Status | null>>
