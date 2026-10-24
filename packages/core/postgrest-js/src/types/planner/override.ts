import type { InvalidMethodError } from '../../PostgrestFilterBuilder'
import type { IsAny } from './lookup'

// ---------------------------------------------------------------- overrideTypes
// `overrideTypes` works on the result as the caller sees it: an array for rows, one object after `.single()`, and
// `| null` after `.maybeSingle()`. An array result takes an array override and a single row an object.
export type OverrideValid<Result, New> = Result extends any[]
  ? New extends any[]
    ? true
    : false
  : New extends any[]
    ? false
    : true

export type OverrideMismatch<Result> = [Result] extends [any[]]
  ? InvalidMethodError<'Type mismatch: Cannot cast array result to a single object. Use .overrideTypes<Array<YourType>> for array results or .single() to convert the result to a single object'>
  : InvalidMethodError<'Type mismatch: Cannot cast single object to array type. Remove Array wrapper from return type or make sure you are not using .single() up in the calling chain'>

type Simplify<T> = T extends object ? { [K in keyof T]: T[K] } : T
type IsPlainObject<T> = T extends any[] ? false : T extends object ? true : false
// only the named keys: an index signature is not one
type ExplicitKeys<T> = { [K in keyof T]: string extends K ? never : K }[keyof T]

// merge all the explicit keys, which allows merging `{ [key: string]: unknown }` with `{ someSpecificKey: boolean }`
type MergeExplicit<New, Row> = {
  [K in ExplicitKeys<New> | ExplicitKeys<Row>]: K extends keyof New
    ? K extends keyof Row
      ? // an embedded relation (array)
        New[K] extends any[]
        ? Row[K] extends any[]
          ? Array<Simplify<MergeDeep<NonNullable<New[K][number]>, NonNullable<Row[K][number]>>>>
          : New[K]
        : // both objects, a possible null aside: the override decides the nullability
          IsPlainObject<NonNullable<New[K]>> extends true
          ? IsPlainObject<NonNullable<Row[K]>> extends true
            ? null extends New[K]
              ? Simplify<MergeDeep<NonNullable<New[K]>, NonNullable<Row[K]>>> | null
              : Simplify<MergeDeep<New[K], NonNullable<Row[K]>>>
            : New[K]
          : New[K]
      : New[K]
    : K extends keyof Row
      ? Row[K]
      : never
}
type MergeDeep<New, Row> = Simplify<
  MergeExplicit<New, Row> & (string extends keyof Row ? { [K: string]: Row[string] } : {})
>

// `merge: false` replaces the result, anything else merges: an array override merges element by element
type MergePartial<New, Result, Options> = Options extends { merge: false }
  ? New
  : Result extends any[]
    ? New extends any[]
      ? Array<Simplify<MergeDeep<New[number], Result[number]>>>
      : never
    : Simplify<MergeDeep<New, Result>>

// the new result: the override over a result that may be `null`, which stays
export type OverrideData<Result, New, Options> =
  IsAny<Result> extends true
    ? New
    : null extends Result
      ? MergePartial<New, NonNullable<Result>, Options> | null
      : MergePartial<New, Result, Options>

// the row the new descriptor carries: the data without its `null` and its array
export type OverrideRow<Data> =
  NonNullable<Data> extends infer D ? (D extends (infer U)[] ? U : D) : never
