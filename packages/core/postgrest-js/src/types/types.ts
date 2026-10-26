import PostgrestError from '../PostgrestError'

/**
 * Response format
 *
 * {@link https://github.com/supabase/supabase-js/issues/32}
 */
interface PostgrestResponseBase {
  /** HTTP status code of the response. */
  status: number
  /**
   * HTTP reason phrase of the response, e.g. `"OK"`.
   *
   * May be an empty string: HTTP/2 and HTTP/3 don't carry reason phrases, so
   * responses over those protocols (e.g. browser requests to Supabase) have no
   * `statusText`. Rely on `status` instead of this value.
   */
  statusText: string
}
export interface PostgrestResponseSuccess<
  T,
  C extends number | null = number | null,
> extends PostgrestResponseBase {
  success: true
  error: null
  data: T
  /** The Content-Range count: a `number` when the request asked for a `count`, `null` otherwise. */
  count: C
}
export interface PostgrestResponseFailure extends PostgrestResponseBase {
  success: false
  error: PostgrestError
  data: null
  count: null
}

export type PostgrestSingleResponse<T> = PostgrestResponseSuccess<T> | PostgrestResponseFailure
export type PostgrestMaybeSingleResponse<T> = PostgrestSingleResponse<T | null>
export type PostgrestResponse<T> = PostgrestSingleResponse<T[]>

/**
 * OpenAPI description served by PostgREST at the REST root (`GET /`).
 *
 * PostgREST emits OpenAPI 2.0 (Swagger), so the version lives in `swagger`.
 * OpenAPI 2.0 requires only `swagger`, `info` and `paths`; a PostgREST
 * `db-root-spec` override may leave out any other field. Only the top level
 * is typed here; the contents of `paths`, `definitions` and `parameters`
 * follow the OpenAPI 2.0 specification and vary with the PostgREST version.
 *
 * {@link https://docs.postgrest.org/en/stable/references/api/openapi.html}
 */
export interface PostgrestOpenApiSpec {
  swagger: string
  info: Record<string, unknown>
  host?: string
  basePath?: string
  paths: Record<string, Record<string, unknown>>
  definitions?: Record<string, Record<string, unknown>>
  parameters?: Record<string, Record<string, unknown>>
  [key: string]: unknown
}

// Rejects excess properties that aren't in Base.
// Works around TypeScript not checking excess properties on generic parameters.
export type RejectExcessProperties<Base, Row> = Row & {
  [K in Exclude<keyof Row, keyof Base>]: never
}
