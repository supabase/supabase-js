import { supabase } from '../client'
import type { Data, Equal, Expect } from '../helpers'
declare const maybeRef: { referencedTable?: string }
declare const maybeLiteral: { referencedTable?: 'channels' }
declare const absent: { referencedTable: undefined }
declare const orderOpts: { ascending?: boolean; referencedTable?: string }

// a possibly-present referencedTable may name an embed, like at runtime: the column belongs to it, so it needs
// no root operand entry (`slug` is a column of `channels`, not of `messages`)
supabase.from('messages').select('id, channels(id)').order('slug', maybeRef)
supabase.from('messages').select('id, channels(id)').order('slug', orderOpts)
supabase.from('messages').select('id, channels(id)').order('slug', maybeLiteral)
supabase.from('messages').select('id, channels(id)').filter('slug', 'eq', 'x', maybeRef)
supabase.from('messages').select('id, channels(id)').filter('slug', 'eq', 'x', maybeLiteral)

// but an option that is never present, or always undefined, still checks the root
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no operand entry for this column in this select
supabase.from('messages').select('id, channels(id)').order('slug', absent)
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no operand entry for this column in this select
supabase.from('messages').select('id, channels(id)').order('slug', { ascending: false })

// a possibly-present filter still widens the embeds it can name
const f = supabase.from('messages').select('id, channels(id)').filter('slug', 'eq', 'x', maybeRef)
type _a = Expect<Equal<Data<typeof f>, { id: number; channels: { id: number } | null }[]>>
