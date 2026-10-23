import type { Dynamic, Entry, BS, BState, CallBase, IsAny, Q0, Unplanned, Untyped } from './lookup'
import type { Strict, UnplannedRpcMessage } from './globals'
import type { RequestedOf } from './options'

// ---------------------------------------------------------------- rpc key sets
// The runtime drops undefined from both the query string and the JSON body, so a key is
// - never sent (NeverKeys): its value type is exactly undefined;
// - maybe sent (MaybeKeys): optional, or its value type includes undefined without being only undefined;
// - always sent (SureKeys): the rest.
export type NeverKeys<A> = {
  [K in keyof A & string]-?: [A[K]] extends [undefined]
    ? [undefined] extends [A[K]]
      ? K
      : never
    : never
}[keyof A & string]
export type MaybeKeys<A> = {
  [K in keyof A & string]-?: K extends NeverKeys<A>
    ? never
    : {} extends Pick<A, K>
      ? K
      : undefined extends A[K]
        ? K
        : never
}[keyof A & string]
export type SureKeys<A> = Exclude<keyof A & string, MaybeKeys<A> | NeverKeys<A>>
// the argument object as sent: the never-keys are gone
export type Sent<A> = A extends unknown
  ? { [K in keyof A as K extends NeverKeys<A> ? never : K]: A[K] }
  : never

// GET and HEAD carry the arguments in the query string, where upstream reads some keys and values as something else.
// The runtime refuses such a request client-side, so the argument check rejects what the types prove it would refuse:
// - a value that is certainly an object (a non-null object, or an array whose elements are certainly objects);
// - a string literal that starts with an operator expression (upstream's grammar as a finite template-literal union,
//   not a parser; a plain `string` is accepted and checked at run time). `OpName` mirrors `RPC_READ_OPERATOR_PATTERN`
//   in `src/rpcReadRefusal.ts`, which is the runtime's source of truth with the reserved keys; keep them in sync;
// - a reserved key: `select`, `columns`, `on_conflict`, or one whose last `.`-separated segment is `order`, `limit`,
//   `offset`, `and` or `or` (`x.limit` is, `color` isn't). Only literal keys.
// Maybe-keys are checked too, on the value type without `undefined`: whenever one is sent the runtime refuses.
export type All<T> = [T] extends [never] ? false : false extends T ? false : true
export type IsObj<V> = V extends readonly (infer U)[]
  ? All<IsObj<U>>
  : V extends object
    ? true
    : false
export type OpName =
  | 'not'
  | 'in'
  | 'is'
  | 'isdistinct'
  | `${'fts' | 'plfts' | 'phfts' | 'wfts'}${'' | `(${string})`}`
  | 'neq'
  | 'cs'
  | 'cd'
  | 'ov'
  | 'sl'
  | 'sr'
  | 'nxr'
  | 'nxl'
  | 'adj'
  | `${'eq' | 'gte' | 'gt' | 'lte' | 'lt' | 'like' | 'ilike' | 'match' | 'imatch'}${'' | '(any)' | '(all)'}`
export type IsOp<V> = V extends string ? (V extends `${OpName}.${string}` ? true : false) : false
export type LastSegment<K extends string> = K extends `${string}.${infer R}` ? LastSegment<R> : K
export type IsReserved<K extends string> = string extends K
  ? false
  : K extends 'select' | 'columns' | 'on_conflict'
    ? true
    : LastSegment<K> extends 'order' | 'limit' | 'offset' | 'and' | 'or'
      ? true
      : false
// one message per offending key, so the rejection names it
export type KeyRefusal<A, K> = K extends keyof A & string
  ? string extends K
    ? never
    :
        | (IsReserved<K> extends true ? `GET and HEAD refuse the reserved key '${K}'` : never)
        | (All<IsObj<Exclude<A[K], undefined>>> extends true
            ? `GET and HEAD refuse an object value for '${K}'`
            : never)
        | (All<IsOp<Exclude<A[K], undefined>>> extends true
            ? `GET and HEAD refuse a value read as a filter for '${K}'`
            : never)
  : never
// per member of the argument union, when the call can send GET or HEAD
export type ReadRefusal<A, O> = [Extract<RequestedOf<O>, 'GET' | 'HEAD'>] extends [never]
  ? never
  : A extends unknown
    ? KeyRefusal<A, SureKeys<A> | MaybeKeys<A>>
    : never

export type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (
  x: infer I
) => void
  ? I
  : never
export type LastOf<U> =
  UnionToIntersection<U extends unknown ? () => U : never> extends () => infer L ? L : never
export type ToTuple<U, L = LastOf<U>> = [U] extends [never] ? [] : [...ToTuple<Exclude<U, L>>, L]
// every subset of the members, each wrapped in a tuple so a union stays a union of sets
export type PowerSet<T extends readonly string[]> = T extends readonly [
  infer H extends string,
  ...infer R extends string[],
]
  ? PowerSet<R> extends infer P
    ? P | (P extends [infer X extends string] ? [X | H] : never)
    : never
  : [never]
export type TooMany = [unknown, unknown, unknown, unknown, unknown, unknown, unknown, ...unknown[]]
// the possible serialized key sets of one argument object; more than 6 maybe-keys (or an index signature) is dynamic
export type KeySetsOf<A> = string extends keyof A
  ? [string]
  : ToTuple<MaybeKeys<A>> extends infer T extends string[]
    ? T extends TooMany
      ? [string]
      : PowerSet<T> extends infer P
        ? P extends [infer X extends string]
          ? [SureKeys<A> | X]
          : never
        : never
    : never
// A distributes: each member of an argument union is dispatched on its own, with the methods the options ask for
export type KeyMethods<A, O> = A extends unknown
  ? KeySetsOf<A> extends infer KS
    ? KS extends [string]
      ? RequestedOf<O> extends infer M extends string
        ? M extends unknown
          ? [KS, M]
          : never
        : never
      : never
    : never
  : never
export type AllKeys<A> = A extends unknown ? keyof A & string : never
export type BaseOfCalls<Calls> = Calls extends Dynamic ? 'one' : CallBase<Calls>

// ---------------------------------------------------------------- rpc (§4.3 RPC)
// `any` as the Database is an untyped client: every relation and function name is accepted, rows and results are `any`
type AnyRelation = { Row: any; Insert: any; Update: any; Relationships: any }
type AnyFunction = { Args: any; Returns: any }
export type FnDefs<DB, S extends string> =
  IsAny<DB> extends true
    ? { [F: string]: AnyFunction }
    : S extends keyof DB
      ? DB[S] extends { Functions: infer Fs }
        ? Fs
        : {}
      : {}
export type RelDefs<DB, S extends string> =
  IsAny<DB> extends true
    ? { [R: string]: AnyRelation }
    : S extends keyof DB
      ? DB[S] extends { Tables: infer T; Views: infer V }
        ? T & V
        : {}
      : {}
// the schema a chain is keyed by: `any` for an untyped client, which marks the chain as untyped (`Untyped`)
export type SchemaOf<DB, S extends string> = IsAny<DB> extends true ? any : S
export type FnArgs<DB, S extends string, F extends string> = F extends keyof FnDefs<DB, S>
  ? FnDefs<DB, S>[F] extends { Args: infer X }
    ? X
    : {}
  : {}
export type RpcB<S extends string, F extends string, A, O, Row = {}> = BS<
  'f',
  S,
  F,
  Row,
  never,
  Q0,
  KeyMethods<A, O>
>
// every call the runtime could dispatch to: one per possible (key set, method) of each member of A
export type CallsOf<S extends string, F extends string, A, O> = Entry<RpcB<S, F, A, O>, Q0>
// with `{ head: boolean }` the HEAD calls give no rows: their branch of the data is null, the rows are the other calls'
export type RowCalls<Calls, O> =
  'HEAD' extends RequestedOf<O>
    ? [Exclude<RequestedOf<O>, 'HEAD'>] extends [never]
      ? Calls
      : Calls extends { method: 'HEAD' }
        ? never
        : Calls
    : Calls
export type CallReject<Call> = Call extends { error: infer E extends string }
  ? E
  : Call extends Unplanned
    ? Strict extends true
      ? UnplannedRpcMessage
      : never
    : never
// no routine information to check the argument values against
export type Unchecked<Calls> = Untyped extends Calls
  ? true
  : Unplanned extends Calls
    ? true
    : Dynamic extends Calls
      ? true
      : false
// the unprojected row of the matched calls' `source`: the columns a plain-column filter can name
export type CallRow<Call> = Call extends { source: infer Src }
  ? [Src] extends [never]
    ? {}
    : Src extends { row: infer R }
      ? R
      : {}
  : {}
