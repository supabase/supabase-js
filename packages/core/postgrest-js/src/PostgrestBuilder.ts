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
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

  // Retry configuration - enabled by default
  protected retryEnabled: boolean = true

  /**
   * Creates a builder configured for a specific PostgREST request.
   *
   * @example
   * ```ts
   * import PostgrestQueryBuilder from '@supabase/postgrest-js'
   *
   * const builder = new PostgrestQueryBuilder(
   *   new URL('https://xyzcompany.supabase.co/rest/v1/users'),
   *   { headers: new Headers({ apikey: 'public-anon-key' }) }
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
   */
  throwOnError(): this & PostgrestBuilder<ClientOptions, Result, true> {
    this.shouldThrowOnError = true
    return this as this & PostgrestBuilder<ClientOptions, Result, true>
  }

  /**
   * Set an HTTP header for the request.
   */
  setHeader(name: string, value: string): this {
    this.headers = new Headers(this.headers)
    this.headers.set(name, value)
    return this
  }

  /**
   * Configure retry behavior for this request.
   *
   * By default, retries are enabled for GET/HEAD requests that fail with
   * 520 status codes (Cloudflare timeout/connection errors). Retries use
   * exponential backoff (1s, 2s, 4s) with a maximum of 3 attempts.
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
        // Clone headers for each attempt and add retry count header if this is a retry
        const requestHeaders = new Headers(this.headers)
        if (attemptCount > 0) {
          requestHeaders.set('X-Retry-Count', String(attemptCount))
        }

        try {
          const res = await _fetch(this.url.toString(), {
            method: this.method,
            headers: requestHeaders,
            body: JSON.stringify(this.body),
            signal: this.signal,
          })

          // Check if we should retry this response
          if (shouldRetry(this.method, res.status, attemptCount, this.retryEnabled)) {
            const delay = getRetryDelay(attemptCount)
            attemptCount++
            await sleep(delay)
            continue
          }

          // Process successful or final response
          return await this.processResponse(res)
        } catch (fetchError: any) {
          // Don't retry network errors for non-idempotent methods
          if (!RETRYABLE_METHODS.includes(this.method as (typeof RETRYABLE_METHODS)[number])) {
            throw fetchError
          }

          // Check if we should retry network errors
          if (this.retryEnabled && attemptCount < DEFAULT_MAX_RETRIES) {
            const delay = getRetryDelay(attemptCount)
            attemptCount++
            await sleep(delay)
            continue
          }

          // Exhausted retries or retries disabled, throw the last error
          throw fetchError
        }
      }
    }

    let res = executeWithRetry()

    if (!this.shouldThrowOnError) {
      res = res.catch((fetchError) => {
        // Build detailed error information including cause if available
        // Note: We don't populate code/hint for client-side network errors since those
        // fields are meant for upstream service errors (PostgREST/PostgreSQL)
        let errorDetails = ''

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

        return {
          error: {
            message: `${fetchError?.name ?? 'FetchError'}: ${fetchError?.message}`,
            details: errorDetails,
            hint: '',
            code: '',
          },
          data: null,
          count: null,
          status: 0,
          statusText: '',
        }
      })
    }

    return res.then(onfulfilled, onrejected)
  }

  /**
   * Process a fetch response and return the standardized postgrest response.
   */
  private async processResponse(res: Response): Promise<{
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

      // Temporary partial fix for https://github.com/supabase/postgrest-js/issues/361
      // Issue persists e.g. for `.insert([...]).select().maybeSingle()`
      if (this.isMaybeSingle && this.method === 'GET' && Array.isArray(data)) {
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

      if (error && this.isMaybeSingle && error?.details?.includes('0 rows')) {
        error = null
        status = 200
        statusText = 'OK'
      }

      if (error && this.shouldThrowOnError) {
        throw new PostgrestError(error)
      }
    }

    return {
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
