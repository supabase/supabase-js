import { supabase } from '../client'
import type { Data, Equal, Expect, Status, Theme } from '../helpers'

type UserRow = {
  username: string
  status: Status | null
  age_range: string | null
  catchphrase: string | null
  data: Theme | null
}
const a = supabase.from('users').select('*')
type _3a = Expect<Equal<Data<typeof a>, UserRow[]>>
const b = supabase.from('users').select()
type _3b = Expect<Equal<Data<typeof b>, UserRow[]>>
const d = supabase.from('users').update({ status: 'OFFLINE' }).select()
type _3d = Expect<Equal<Data<typeof d>, UserRow[]>>
// '*' beside a literal in a union: each member looked up on its own
declare const full: boolean
const e = supabase.from('users').select(full ? '*' : 'username')
type _3e = Expect<Equal<Data<typeof e>, (UserRow | { username: string })[]>>
// facts work through '*' (identity sources)
const f = supabase.from('users').select().eq('status', 'ONLINE')
type _3f = Expect<
  Equal<
    Data<typeof f>,
    {
      username: string
      status: 'ONLINE'
      age_range: string | null
      catchphrase: string | null
      data: Theme | null
    }[]
  >
>

type Online = {
  username: string
  status: 'ONLINE'
  age_range: string | null
  catchphrase: string | null
  data: Theme | null
}
// 5. star provenance: `select()` / `select('*')` carry identity sources, so facts narrow in either order
const sa = supabase.from('users').select().eq('status', 'ONLINE')
type _3s1 = Expect<Equal<Data<typeof sa>, Online[]>>
const sb = supabase.from('users').select('*').eq('status', 'ONLINE')
type _3s2 = Expect<Equal<Data<typeof sb>, Online[]>>
const sc = supabase.from('users').select('username').eq('status', 'ONLINE').select('*')
type _3s3 = Expect<Equal<Data<typeof sc>, Online[]>>
const sd = supabase.from('users').select('username').eq('status', 'ONLINE').select()
type _3s4 = Expect<Equal<Data<typeof sd>, Online[]>>
const se = supabase.from('users').select().not('status', 'is', null)
declare const sev: Data<typeof se>[number]['status']
type _3s5 = Expect<Equal<typeof sev, Status>>
