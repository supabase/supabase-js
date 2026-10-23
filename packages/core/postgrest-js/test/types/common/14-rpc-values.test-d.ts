import { supabase } from '../client'
import type { Data, Equal, Expect, Status, Theme } from '../helpers'
declare const text: string
declare const str: string
declare const num: number
declare const maybeNum: number | undefined
declare const obj: { x: number }
declare const objs: { x: number }[]
declare const strs: string[]
declare const nums: number[]
declare const anyJson: string | { x: number }
declare const flag: boolean
type UserRow = {
  username: string
  status: Status | null
  age_range: string | null
  catchphrase: string | null
  data: Theme | null
}

// ---- 1. NeverKeys: a key whose value type is exactly `undefined` is never sent
// `{ cid, search: undefined }` dispatches as `{ cid }` (not as the `cid | search` call, not as the maybe-set)
const n1 = supabase.rpc('find_messages', { cid: 1, search: undefined })
type _14a = Expect<Equal<Data<typeof n1>, { id: number }[]>>
// while a value that may be undefined is a maybe-key (two key sets)
const n2 = supabase.rpc('find_messages', { cid: 1, search: text as string | undefined })
type _14b = Expect<Equal<Data<typeof n2>, ({ id: number } | { id: number; rank: number })[]>>
// declared types: required-undefined and optional-undefined are never sent
declare const never1: { cid: number; search: undefined }
const n3 = supabase.rpc('find_messages', never1)
type _14c = Expect<Equal<Data<typeof n3>, { id: number }[]>>
declare const never2: { cid: number; search?: undefined }
const n4 = supabase.rpc('find_messages', never2)
type _14d = Expect<Equal<Data<typeof n4>, { id: number }[]>>
// a union of members: each one is classified on its own
declare const mixed: { cid: number; search: undefined } | { cid: number; search: string }
const n5 = supabase.rpc('find_messages', mixed)
type _14e = Expect<Equal<Data<typeof n5>, ({ id: number } | { id: number; rank: number })[]>>
// the values are checked after the never-keys are removed: `Record<string, never>` accepts an undefined-only key,
// and a key the routine doesn't know about is not sent either
const n6 = supabase.rpc('get_online_users', { x: undefined })
type _14f = Expect<Equal<Data<typeof n6>, UserRow[]>>
const n7 = supabase.rpc('get_status', { name_param: 'x', whatever: undefined })
type _14g = Expect<Equal<Data<typeof n7>, Status | null>>
// ... but the sent keys still are
// @ts-expect-error Argument of type '[{ name_param: number; whatever: undefined; }]' is not assignable to parameter of type
supabase.rpc('get_status', { name_param: 1, whatever: undefined })
// a required argument that is only undefined is not sent: no `{}` call for get_status (strict.ts rejects it)

// the method follows the options and the GET / HEAD refusals follow the values: see 18-rpc-get-head.ts
// unused values
;(void num, maybeNum, str, obj, objs, strs, nums, anyJson, flag)
