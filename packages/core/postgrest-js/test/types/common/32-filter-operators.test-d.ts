import { supabase } from '../client'
import type { Data, Equal, Expect, Status } from '../helpers'

// not() and filter() suggest the PostgREST operators but, as in v2, take any operator string (`fts(english)`)
const o1 = supabase.from('users').select('username, status').not('status', 'is', null)
type _32a = Expect<Equal<Data<typeof o1>, { username: string; status: Status }[]>>
const o2 = supabase.from('users').select('status').not('status', 'in', '(ONLINE)')
type _32b = Expect<Equal<Data<typeof o2>, { status: Status | null }[]>>
const o3 = supabase.from('users').select('username, status').filter('status', 'eq', 'ONLINE')
type _32c = Expect<Equal<Data<typeof o3>, { username: string; status: Status | null }[]>>
const o4 = supabase.from('users').select('status').filter('status', 'not.eq', 'ONLINE')
type _32d = Expect<Equal<Data<typeof o4>, { status: Status | null }[]>>
const o5 = supabase.from('users').select('status').filter('username', 'fts(english)', 'a')
type _32e = Expect<Equal<Data<typeof o5>, { status: Status | null }[]>>
const o6 = supabase.from('users').select('status').not('username', 'like(any)', '{a*}')
type _32f = Expect<Equal<Data<typeof o6>, { status: Status | null }[]>>
