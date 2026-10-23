import type { MState } from './lookup'
import type { ApplyFacts } from './facts'
import type { PostgrestResponseFailure, PostgrestResponseSuccess } from '../types'

// ---------------------------------------------------------------- §4.3 response state
export type Strip<R> = R extends readonly unknown[]
  ? { [I in keyof R]: Strip<R[I]> }
  : R extends object
    ? Flat<
        { [K in keyof R as null extends R[K] ? never : K]: StripV<R[K]> } & {
          [K in keyof R as null extends R[K] ? K : never]?: StripV<NonNullable<R[K]>>
        }
      >
    : R
export type StripV<V> = V extends readonly (infer U)[]
  ? Strip<U>[]
  : V extends object
    ? Strip<V>
    : V
export type Flat<T> = { [K in keyof T]: T[K] }

export type Rows<E, F, M extends MState> = M['strip'] extends true
  ? Strip<ApplyFacts<E, F>>
  : ApplyFacts<E, F>
// the value a scalar call answers with is the wire value: `maybeSingle()` fetches a list and takes the one element of
// an array, whatever the array holds (rows are objects, never unwrapped further)
export type Unwrap<R> = R extends readonly (infer U)[] ? U : R
export type Card<M extends MState, R, Bs> = M['card'] extends 'maybe'
  ? ([Bs] extends ['one'] ? Unwrap<R> : R) | null
  : M['card'] extends 'one'
    ? R
    : Bs extends 'many'
      ? R[]
      : R
// rows of a literal union share one array; an rpc's calls can differ in form, so descriptors that carry their own
// cardinality are grouped by it
export type OutGroup<E, F, M extends MState, Bs> = [E] extends [never]
  ? never
  : M['fmt'] extends 'csv'
    ? string
    : Card<M, Rows<E, F, M>, Bs>
export type Out<E, F, M extends MState> =
  | OutGroup<Extract<E, { base: 'many' }>, F, M, 'many'>
  | OutGroup<Extract<E, { base: 'one' }>, F, M, 'one'>
  | OutGroup<Extract<E, { base: 'inherit' }>, F, M, M['base']>
// distributes over the possible methods: `{ head: boolean }` gives rows or null
export type DataOf<E, F, M extends MState> = M['op'] extends infer Op
  ? Op extends 'HEAD'
    ? null
    : Op extends 'MUT'
      ? M['ret'] extends true
        ? Out<E, F, M>
        : null
      : Out<E, F, M>
  : never
export type CountOf<M extends MState> = [M['count']] extends [false]
  ? null
  : [M['count']] extends [true]
    ? number
    : number | null

export type Res<E, F, M extends MState> = M['thr'] extends true
  ? PostgrestResponseSuccess<DataOf<E, F, M>, CountOf<M>>
  : PostgrestResponseSuccess<DataOf<E, F, M>, CountOf<M>> | PostgrestResponseFailure
