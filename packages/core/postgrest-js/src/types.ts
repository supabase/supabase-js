import PostgrestError from './PostgrestError'

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

export type GenericTable = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
}

export type GenericUpdatableView = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
}

export type GenericNonUpdatableView = {
  Row: Record<string, unknown>
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
