import type {
  PostgrestSingleResponse,
  PostgrestResponseSuccess,
  CheckMatchingArrayTypes,
  MergePartialResult,
  IsValidResultOverride,
} from './types/types'
import {
  ClientServerOptions,
  Fetch,
  DEFAULT_MAX_RETRIES,
  getRetryDelay,
  RETRYABLE_STATUS_CODES,
  RETRYABLE_METHODS,
} from './types/common/common'
import PostgrestError from './PostgrestError'
import { ContainsNull } from './select-query-parser/types'

/**
 * Sleep for a given number of milliseconds.
 * If an AbortSignal is provided, the sleep resolves early when the signal is aborted.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const id = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(id)
      resolve()
    }
    signal?.addEventListener('abort', onAbort)
  })
}

/**
 * Check if a request should be retried based on method and status code.
 */
function shouldRetry(
  method: string,
  status: number,
  attemptCount: number,
  retryEnabled: boolean
): boolean {
  // Don't retry if retries are disabled or we've exhausted attempts
  if (!retryEnabled || attemptCount >= DEFAULT_MAX_RETRIES) {
    return false
  }

  // Only retry idempotent methods (GET, HEAD, OPTIONS)
  if (!RETRYABLE_METHODS.includes(method as (typeof RETRYABLE_METHODS)[number])) {
    return false
  }

  // Only retry on specific status codes (520 - Cloudflare errors)
  if (!RETRYABLE_STATUS_CODES.includes(status as (typeof RETRYABLE_STATUS_CODES)[number])) {
    return false
  }

  return true
}

export default abstract class PostgrestBuilder<
  ClientOptions extends ClientServerOptions,
  Result,
  ThrowOnError extends boolean = false,
> implements
    PromiseLike<
      ThrowOnError extends true ? PostgrestResponseSuccess<Result> : PostgrestSingleResponse<Result>
    >
{
  protected method: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'DELETE'
  protected url: URL
  protected headers: Headers
  protected schema?: string
  protected body?: unknown
  protected shouldThrowOnError = false
  protected signal?: AbortSignal
  protected fetch: Fetch
  protected isMaybeSingle: boolean
  protected shouldStripNulls: boolean
  protected urlLengthLimit: number

  // Retry configuration - enabled by default
  protected retryEnabled: boolean = true

  /**
   * Creates a builder configured for a specific PostgREST request.
   *
   * @example Using supabase-js (recommended)
   * ```ts
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
   * const { data, error } = await supabase.from('users').select('*')
   * ```
   *
   * @category Database
   *
   * @example Standalone import for bundle-sensitive environments
   * ```ts
   * import { PostgrestQueryBuilder } from '@supabase/postgrest-js'
   *
   * const builder = new PostgrestQueryBuilder(
   *   new URL('https://xyzcompany.supabase.co/rest/v1/users'),
   *   { headers: new Headers({ apikey: 'your-publishable-key' }) }
   * )
   * ```
   */
  constructor(builder: {
    method: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'DELETE'
    url: URL
    headers: HeadersInit
    schema?: string
    body?: unknown
    shouldThrowOnError?: boolean
    signal?: AbortSignal
    fetch?: Fetch
    isMaybeSingle?: boolean
    shouldStripNulls?: boolean
    urlLengthLimit?: number
    // Retry option
    retry?: boolean
  }) {
    this.method = builder.method
    this.url = builder.url
    this.headers = new Headers(builder.headers)
    this.schema = builder.schema
    this.body = builder.body
    this.shouldThrowOnError = builder.shouldThrowOnError ?? false
    this.signal = builder.signal
    this.isMaybeSingle = builder.isMaybeSingle ?? false
    this.shouldStripNulls = builder.shouldStripNulls ?? false
    this.urlLengthLimit = builder.urlLengthLimit ?? 8000
    this.retryEnabled = builder.retry ?? true

    if (builder.fetch) {
      this.fetch = builder.fetch
    } else {
      this.fetch = fetch
    }
  }

  /**
   * If there's an error with the query, throwOnError will reject the promise by
   * throwing the error instead of returning it as part of a successful response.
   *
   * {@link https://github.com/supabase/supabase-js/issues/92}
   *
   * @category Database
   */
  throwOnError(): this & PostgrestBuilder<ClientOptions, Result, true> {
    this.shouldThrowOnError = true
    return this as this & PostgrestBuilder<ClientOptions, Result, true>
  }

  /**
   * Strip null values from the response data. Properties with `null` values
   * will be omitted from the returned JSON objects.
   *
   * Requires PostgREST 11.2.0+.
   *
   * {@link https://docs.postgrest.org/en/stable/references/api/resource_representation.html#stripped-nulls}
   *
   * @category Database
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select()
   *   .stripNulls()
   * ```
   *
   * @exampleSql With `select()`
   * ```sql
   * create table
   *   characters (id int8 primary key, name text, bio text);
   *
   * insert into
   *   characters (id, name, bio)
   * values
   *   (1, 'Luke', null),
   *   (2, 'Leia', 'Princess of Alderaan');
   * ```
   *
   * @exampleResponse With `select()`
   * ```json
   * {
   *   "data": [
   *     {
   *       "id": 1,
   *       "name": "Luke"
   *     },
   *     {
   *       "id": 2,
   *       "name": "Leia",
   *       "bio": "Princess of Alderaan"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  stripNulls(): this {
    if (this.headers.get('Accept') === 'text/csv') {
      throw new Error('stripNulls() cannot be used with csv()')
    }
    this.shouldStripNulls = true
    return this
  }

  /**
   * Set an HTTP header for the request.
   *
   * @category Database
   */
  setHeader(name: string, value: string): this {
    this.headers = new Headers(this.headers)
    this.headers.set(name, value)
    return this
  }

  /**
   * @category Database
   *
   * Configure retry behavior for this request.
   *
   * By default, retries are enabled for idempotent requests (GET, HEAD, OPTIONS)
   * that fail with network errors or specific HTTP status codes (503, 520).
   * Retries use exponential backoff (1s, 2s, 4s) with a maximum of 3 attempts.
   *
   * @param enabled - Whether to enable retries for this request
   *
   * @example
   * ```ts
   * // Disable retries for a specific query
   * const { data, error } = await supabase
   *   .from('users')
   *   .select()
   *   .retry(false)
   * ```
   */
  retry(enabled: boolean): this {
    this.retryEnabled = enabled
    return this
  }

  then<
    TResult1 = ThrowOnError extends true
      ? PostgrestResponseSuccess<Result>
      : PostgrestSingleResponse<Result>,
    TResult2 = never,
  >(
    onfulfilled?:
      | ((
          value: ThrowOnError extends true
            ? PostgrestResponseSuccess<Result>
            : PostgrestSingleResponse<Result>
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): PromiseLike<TResult1 | TResult2> {
    // https://postgrest.org/en/stable/api.html#switching-schemas
    if (this.schema === undefined) {
      // skip
    } else if (['GET', 'HEAD'].includes(this.method)) {
      this.headers.set('Accept-Profile', this.schema)
    } else {
      this.headers.set('Content-Profile', this.schema)
    }
    if (this.method !== 'GET' && this.method !== 'HEAD') {
      this.headers.set('Content-Type', 'application/json')
    }

    // https://docs.postgrest.org/en/stable/references/api/resource_representation.html#stripped-nulls
    if (this.shouldStripNulls) {
      const currentAccept = this.headers.get('Accept')
      if (currentAccept === 'application/vnd.pgrst.object+json') {
        this.headers.set('Accept', 'application/vnd.pgrst.object+json;nulls=stripped')
      } else if (!currentAccept || currentAccept === 'application/json') {
        this.headers.set('Accept', 'application/vnd.pgrst.array+json;nulls=stripped')
      }
    }

    // NOTE: Invoke w/o `this` to avoid illegal invocation error.
    // https://github.com/supabase/postgrest-js/pull/247
    const _fetch = this.fetch

    // Execute fetch with retry logic
    const executeWithRetry = async (): Promise<{
      error: any
      data: any
      count: number | null
      status: number
      statusText: string
    }> => {
      let attemptCount = 0

      while (true) {
        const requestHeaders = new Headers(this.headers)
        if (attemptCount > 0) {
          requestHeaders.set('X-Retry-Count', String(attemptCount))
        }

        // Only wrap the fetch call itself — processResponse errors must never trigger retries
        let res: Response
        try {
          res = await _fetch(this.url.toString(), {
            method: this.method,
            headers: requestHeaders,
            body: JSON.stringify(this.body, (_, value) =>
              typeof value === 'bigint' ? value.toString() : value
            ),
            signal: this.signal,
          })
        } catch (fetchError: any) {
          // Never retry aborted requests
          if (fetchError?.name === 'AbortError' || fetchError?.code === 'ABORT_ERR') {
            throw fetchError
          }

          // Don't retry network errors for non-idempotent methods
          if (!RETRYABLE_METHODS.includes(this.method as (typeof RETRYABLE_METHODS)[number])) {
            throw fetchError
          }

          // Check if we should retry network errors
          if (this.retryEnabled && attemptCount < DEFAULT_MAX_RETRIES) {
            const delay = getRetryDelay(attemptCount)
            attemptCount++
            await sleep(delay, this.signal)
            continue
          }

          // Exhausted retries or retries disabled, throw the last error
          throw fetchError
        }

        // Check if we should retry this HTTP response
        if (shouldRetry(this.method, res.status, attemptCount, this.retryEnabled)) {
          const retryAfterHeader = res.headers?.get('Retry-After') ?? null
          const delay =
            retryAfterHeader !== null
              ? Math.max(0, parseInt(retryAfterHeader, 10) || 0) * 1000
              : getRetryDelay(attemptCount)
          await res.text()
          attemptCount++
          await sleep(delay, this.signal)
          continue
        }

        return await this.processResponse(res)
      }
    }

    let res = executeWithRetry()

    if (!this.shouldThrowOnError) {
      res = res.catch((fetchError) => {
        // Build detailed error information including cause if available
        // Note: We don't populate code/hint for client-side network errors since those
        // fields are meant for upstream service errors (PostgREST/PostgreSQL)
        let errorDetails = ''
        let hint = ''
        let code = ''

        // Add cause information if available (e.g., DNS errors, network failures)
        const cause = fetchError?.cause
        if (cause) {
          const causeMessage = cause?.message ?? ''
          const causeCode = cause?.code ?? ''

          errorDetails = `${fetchError?.name ?? 'FetchError'}: ${fetchError?.message}`
          errorDetails += `\n\nCaused by: ${cause?.name ?? 'Error'}: ${causeMessage}`
          if (causeCode) {
            errorDetails += ` (${causeCode})`
          }
          if (cause?.stack) {
            errorDetails += `\n${cause.stack}`
          }
        } else {
          // No cause available, just include the error stack
          errorDetails = fetchError?.stack ?? ''
        }

        // Get URL length for potential hints
        const urlLength = this.url.toString().length

        // Handle AbortError specially with helpful hints
        if (fetchError?.name === 'AbortError' || fetchError?.code === 'ABORT_ERR') {
          code = ''
          hint = 'Request was aborted (timeout or manual cancellation)'

          if (urlLength > this.urlLengthLimit) {
            hint += `. Note: Your request URL is ${urlLength} characters, which may exceed server limits. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [many IDs])), consider using an RPC function to pass values server-side.`
          }
        }
        // Handle HeadersOverflowError from undici (Node.js fetch implementation)
        else if (
          cause?.name === 'HeadersOverflowError' ||
          cause?.code === 'UND_ERR_HEADERS_OVERFLOW'
        ) {
          code = ''
          hint = 'HTTP headers exceeded server limits (typically 16KB)'

          if (urlLength > this.urlLengthLimit) {
            hint += `. Your request URL is ${urlLength} characters. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [200+ IDs])), consider using an RPC function instead.`
          }
        }

        return {
          success: false as const,
          error: {
            message: `${fetchError?.name ?? 'FetchError'}: ${fetchError?.message}`,
            details: errorDetails,
            hint: hint,
            code: code,
          },
          data: null,
          count: null,
          status: 0,
          statusText: '',
        }
      })
    }

    return (
      res as Promise<
        ThrowOnError extends true
          ? PostgrestResponseSuccess<Result>
          : PostgrestSingleResponse<Result>
      >
    ).then(onfulfilled, onrejected)
  }

  /**
   * Process a fetch response and return the standardized postgrest response.
   */
  private async processResponse(res: Response): Promise<{
    success: boolean
    error: any
    data: any
    count: number | null
    status: number
    statusText: string
  }> {
    let error = null
    let data = null
    let count: number | null = null
    let status = res.status
    let statusText = res.statusText

    if (res.ok) {
      if (this.method !== 'HEAD') {
        const body = await res.text()
        if (body === '') {
          // Prefer: return=minimal
        } else if (this.headers.get('Accept') === 'text/csv') {
          data = body
        } else if (
          this.headers.get('Accept') &&
          this.headers.get('Accept')?.includes('application/vnd.pgrst.plan+text')
        ) {
          data = body
        } else {
          data = JSON.parse(body)
        }
      }

      const countHeader = this.headers.get('Prefer')?.match(/count=(exact|planned|estimated)/)
      const contentRange = res.headers.get('content-range')?.split('/')
      if (countHeader && contentRange && contentRange.length > 1) {
        count = parseInt(contentRange[1])
      }

      // Fix for https://github.com/supabase/postgrest-js/issues/361 — applies to all methods.
      if (this.isMaybeSingle && Array.isArray(data)) {
        if (data.length > 1) {
          error = {
            // https://github.com/PostgREST/postgrest/blob/a867d79c42419af16c18c3fb019eba8df992626f/src/PostgREST/Error.hs#L553
            code: 'PGRST116',
            details: `Results contain ${data.length} rows, application/vnd.pgrst.object+json requires 1 row`,
            hint: null,
            message: 'JSON object requested, multiple (or no) rows returned',
          }
          data = null
          count = null
          status = 406
          statusText = 'Not Acceptable'
        } else if (data.length === 1) {
          data = data[0]
        } else {
          data = null
        }
      }
    } else {
      const body = await res.text()

      try {
        error = JSON.parse(body)

        // Workaround for https://github.com/supabase/postgrest-js/issues/295
        if (Array.isArray(error) && res.status === 404) {
          data = []
          error = null
          status = 200
          statusText = 'OK'
        }
      } catch {
        // Workaround for https://github.com/supabase/postgrest-js/issues/295
        if (res.status === 404 && body === '') {
          status = 204
          statusText = 'No Content'
        } else {
          error = {
            message: body,
          }
        }
      }

      if (error && this.shouldThrowOnError) {
        throw new PostgrestError(error)
      }
    }

    return {
      success: error === null,
      error,
      data,
      count,
      status,
      statusText,
    }
  }

  /**
   * Override the type of the returned `data`.
   *
   * @typeParam NewResult - The new result type to override with
   * @deprecated Use overrideTypes<yourType, { merge: false }>() method at the end of your call chain instead
   *
   * @category Database
   */
  returns<NewResult>(): PostgrestBuilder<
    ClientOptions,
    CheckMatchingArrayTypes<Result, NewResult>,
    ThrowOnError
  > {
    /* istanbul ignore next */
    return this as unknown as PostgrestBuilder<
      ClientOptions,
      CheckMatchingArrayTypes<Result, NewResult>,
      ThrowOnError
    >
  }

  /**
   * Override the type of the returned `data` field in the response.
   *
   * @typeParam NewResult - The new type to cast the response data to
   * @typeParam Options - Optional type configuration (defaults to { merge: true })
   * @typeParam Options.merge - When true, merges the new type with existing return type. When false, replaces the existing types entirely (defaults to true)
   * @example
   * ```typescript
   * // Merge with existing types (default behavior)
   * const query = supabase
   *   .from('users')
   *   .select()
   *   .overrideTypes<{ custom_field: string }>()
   *
   * // Replace existing types completely
   * const replaceQuery = supabase
   *   .from('users')
   *   .select()
   *   .overrideTypes<{ id: number; name: string }, { merge: false }>()
   * ```
   * @returns A PostgrestBuilder instance with the new type
   *
   * @category Database
   *
   * @example Complete Override type of successful response
   * ```ts
   * const { data } = await supabase
   *   .from('countries')
   *   .select()
   *   .overrideTypes<Array<MyType>, { merge: false }>()
   * ```
   *
   * @exampleResponse Complete Override type of successful response
   * ```ts
   * let x: typeof data // MyType[]
   * ```
   *
   * @example Complete Override type of object response
   * ```ts
   * const { data } = await supabase
   *   .from('countries')
   *   .select()
   *   .maybeSingle()
   *   .overrideTypes<MyType, { merge: false }>()
   * ```
   *
   * @exampleResponse Complete Override type of object response
   * ```ts
   * let x: typeof data // MyType | null
   * ```
   *
   * @example Partial Override type of successful response
   * ```ts
   * const { data } = await supabase
   *   .from('countries')
   *   .select()
   *   .overrideTypes<Array<{ status: "A" | "B" }>>()
   * ```
   *
   * @exampleResponse Partial Override type of successful response
   * ```ts
   * let x: typeof data // Array<CountryRowProperties & { status: "A" | "B" }>
   * ```
   *
   * @example Partial Override type of object response
   * ```ts
   * const { data } = await supabase
   *   .from('countries')
   *   .select()
   *   .maybeSingle()
   *   .overrideTypes<{ status: "A" | "B" }>()
   * ```
   *
   * @exampleResponse Partial Override type of object response
   * ```ts
   * let x: typeof data // CountryRowProperties & { status: "A" | "B" } | null
   * ```
   *
   * @example Example 5
   * ```typescript
   * // Merge with existing types (default behavior)
   * const query = supabase
   *   .from('users')
   *   .select()
   *   .overrideTypes<{ custom_field: string }>()
   *
   * // Replace existing types completely
   * const replaceQuery = supabase
   *   .from('users')
   *   .select()
   *   .overrideTypes<{ id: number; name: string }, { merge: false }>()
   * ```
   */
  overrideTypes<
    NewResult,
    Options extends { merge?: boolean } = { merge: true },
  >(): PostgrestBuilder<
    ClientOptions,
    IsValidResultOverride<Result, NewResult, false, false> extends true
      ? // Preserve the optionality of the result if the overriden type is an object (case of chaining with `maybeSingle`)
        ContainsNull<Result> extends true
        ? MergePartialResult<NewResult, NonNullable<Result>, Options> | null
        : MergePartialResult<NewResult, Result, Options>
      : CheckMatchingArrayTypes<Result, NewResult>,
    ThrowOnError
  > {
    return this as unknown as PostgrestBuilder<
      ClientOptions,
      IsValidResultOverride<Result, NewResult, false, false> extends true
        ? // Preserve the optionality of the result if the overriden type is an object (case of chaining with `maybeSingle`)
          ContainsNull<Result> extends true
          ? MergePartialResult<NewResult, NonNullable<Result>, Options> | null
          : MergePartialResult<NewResult, Result, Options>
        : CheckMatchingArrayTypes<Result, NewResult>,
      ThrowOnError
    >
  }
}
