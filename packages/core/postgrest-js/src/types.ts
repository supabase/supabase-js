import PostgrestError from './PostgrestError'
import { SelectQueryError } from './select-query-parser/utils'

export type Fetch = typeof fetch

/**
 * Response format
 *
 * {@link https://github.com/supabase/supabase-js/issues/32}
 */
interface PostgrestResponseBase {
  status: number
  statusText: string
}
export interface PostgrestResponseSuccess<T> extends PostgrestResponseBase {
  error: null
  data: T
  count: number | null
}
export interface PostgrestResponseFailure extends PostgrestResponseBase {
  error: PostgrestError
  data: null
  count: null
}

// TODO: in v3:
// - remove PostgrestResponse and PostgrestMaybeSingleResponse
// - rename PostgrestSingleResponse to PostgrestResponse
export type PostgrestSingleResponse<T> = PostgrestResponseSuccess<T> | PostgrestResponseFailure
export type PostgrestMaybeSingleResponse<T> = PostgrestSingleResponse<T | null>
export type PostgrestResponse<T> = PostgrestSingleResponse<T[]>

export type GenericRelationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne?: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export type GenericTable = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
  Relationships: GenericRelationship[]
}

export type GenericUpdatableView = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
  Relationships: GenericRelationship[]
}

export type GenericNonUpdatableView = {
  Row: Record<string, unknown>
  Relationships: GenericRelationship[]
}

export type GenericView = GenericUpdatableView | GenericNonUpdatableView

export type GenericFunction = {
  Args: Record<string, unknown>
  Returns: unknown
}

export type GenericSchema = {
  Tables: Record<string, GenericTable>
  Views: Record<string, GenericView>
  Functions: Record<string, GenericFunction>
}

// https://twitter.com/mattpocockuk/status/1622730173446557697
export type Prettify<T> = { [K in keyof T]: T[K] } & {}
// https://github.com/sindresorhus/type-fest
export type SimplifyDeep<Type, ExcludeType = never> = ConditionalSimplifyDeep<
  Type,
  ExcludeType | NonRecursiveType | Set<unknown> | Map<unknown, unknown>,
  object
>
type ConditionalSimplifyDeep<
  Type,
  ExcludeType = never,
  IncludeType = unknown
> = Type extends ExcludeType
  ? Type
  : Type extends IncludeType
  ? { [TypeKey in keyof Type]: ConditionalSimplifyDeep<Type[TypeKey], ExcludeType, IncludeType> }
  : Type
type NonRecursiveType = BuiltIns | Function | (new (...arguments_: any[]) => unknown)
type BuiltIns = Primitive | void | Date | RegExp
type Primitive = null | undefined | string | number | boolean | symbol | bigint

/**
 * Utility type to check if array types match between Result and NewResult.
 * Returns either the valid NewResult type or an error message type.
 */
export type CheckMatchingArrayTypes<Result, NewResult> =
  // If the result is a QueryError we allow the user to override anyway
  Result extends SelectQueryError<string>
    ? NewResult
    : // Otherwise, we check basic type matching (array should be override by array, object by object)
    Result extends any[]
    ? NewResult extends any[]
      ? NewResult // Both are arrays - valid
      : {
          Error: 'Type mismatch: Cannot cast array result to a single object. Use .returns<Array<YourType>> for array results or .single() to convert the result to a single object'
        }
    : NewResult extends any[]
    ? {
        Error: 'Type mismatch: Cannot cast single object to array type. Remove Array wrapper from return type or make sure you are not using .single() up in the calling chain'
      }
    : NewResult // Neither are arrays - valid
