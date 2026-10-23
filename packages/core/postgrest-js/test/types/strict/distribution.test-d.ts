import { supabase } from '../client'

// a select string that may be undefined is still checked member by member
declare const maybeNope: 'nope' | undefined
// @ts-expect-error not indexed by @supabase/postgrest-mapper: the scanner couldn't connect this select to a relation in the same file
supabase.from('users').select(maybeNope)
declare const maybeOk: 's:status' | 'nope' | undefined
// @ts-expect-error not indexed by @supabase/postgrest-mapper: the scanner couldn't connect this select to a relation in the same file
supabase.from('users').select(maybeOk)
supabase.from('users').select('s:status' as 's:status' | undefined)

// a bag whose members send HEAD or POST asks only for planned calls (`ping` plans both, not GET)
declare const headGetOrCount: { head: true; get: true } | { count: 'exact' }
supabase.rpc('ping', { n: 1 }, headGetOrCount)
// a member that sends GET is refused: `ping` plans no GET call
declare const getOrCount: { get: true } | { count: 'exact' }
// @ts-expect-error not indexed by @supabase/postgrest-mapper: no planned call matches this rpc name, argument key set and method
supabase.rpc('ping', { n: 1 }, getOrCount)
