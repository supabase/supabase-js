import type { Fetch } from './types/common/common'
import type { BState, MState, SetM } from './types/planner/lookup'
import type { Res } from './types/planner/response'
import PostgrestError from './PostgrestError'
import { fetchWithRetry } from './fetchWithRetry'

export default abstract class PostgrestBuilder<
  B extends BState,
  E,
  F,
  M extends MState,
> implements PromiseLike<Res<E, F, M>> {
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
  // a request refused before sending: `then` settles with it and never calls fetch
  protected clientError?: PostgrestError

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
    clientError?: PostgrestError
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
    this.clientError = builder.clientError

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
   * @subcategory Using modifiers
   */
  throwOnError(): PostgrestBuilder<B, E, F, SetM<M, { thr: true }>> {
    this.shouldThrowOnError = true
    return this as any
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
   * @subcategory Using modifiers
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
  stripNulls(): PostgrestBuilder<B, E, F, SetM<M, { strip: true }>> {
    if (this.headers.get('Accept') === 'text/csv') {
      throw new Error('stripNulls() cannot be used with csv()')
    }
    this.shouldStripNulls = true
    return this as any
  }

  /**
   * Set an HTTP header on this single PostgREST request, overriding any header
   * with the same name set on the client.
   *
   * This is an advanced escape hatch for one-off needs (passing a custom
   * `Authorization` for a single query, attaching a tracing header, etc.).
   * Most callers do not need it: configure client-wide headers via the
   * `headers` option when constructing the client, and authentication via
   * Supabase Auth.
   *
   * @param name - HTTP header name
   * @param value - HTTP header value
   *
   * @category Database
   * @subcategory Using modifiers
   */
  setHeader(name: string, value: string): this {
    this.headers = new Headers(this.headers)
    this.headers.set(name, value)
    return this
  }

  /**
   * @category Database
   * @subcategory Using modifiers
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

  then<TResult1 = Res<E, F, M>, TResult2 = never>(
    onfulfilled?: ((value: Res<E, F, M>) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): PromiseLike<TResult1 | TResult2> {
    if (this.clientError) {
      const refused: Promise<any> = this.shouldThrowOnError
        ? Promise.reject(this.clientError)
        : Promise.resolve({
            success: false as const,
            error: this.clientError,
            data: null,
            count: null,
            status: 0,
            statusText: '',
          })
      return (refused as Promise<Res<E, F, M>>).then(onfulfilled, onrejected)
    }

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
      // Serialize headers as a plain object rather than a Headers instance.
      // React Native's XHR-based fetch silently drops headers (notably Content-Type)
      // when given a Headers instance, causing PGRST202 on parameter-less RPC calls.
      // See supabase/supabase-js#1562 and facebook/react-native#33933.
      // All sibling packages (auth-js, storage-js, functions-js) already pass plain objects.
      const headers: Record<string, string> = {}
      this.headers.forEach((value, key) => {
        headers[key] = value
      })

      // Only the fetch itself is retried — processResponse errors must never trigger retries
      const res = await fetchWithRetry(
        _fetch,
        this.url.toString(),
        {
          method: this.method,
          headers,
          body: JSON.stringify(this.body, (_, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ),
          signal: this.signal,
        },
        this.retryEnabled
      )

      return await this.processResponse(res)
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

    return (res as Promise<Res<E, F, M>>).then(onfulfilled, onrejected)
  }

  /**
   * Process a fetch response and return the standardized postgrest response.
   */
  private async processResponse(res: Response): Promise<{
    success: boolean
    error: PostgrestError | null
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
          try {
            data = JSON.parse(body)
          } catch {
            // A 2xx status doesn't guarantee a JSON body; mirror the non-2xx fallback below.
            error = { message: body }
            data = null

            if (this.shouldThrowOnError) {
              throw new PostgrestError({ message: body, details: '', hint: '', code: '' })
            }
          }
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

          if (this.shouldThrowOnError) {
            // `hint` is null in the returned error to match PostgREST, but
            // PostgrestError types it as a string, like the other throws here.
            throw new PostgrestError({ ...error, hint: error.hint ?? '' })
          }
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
      error: error ? new PostgrestError(error) : null,
      data,
      count,
      status,
      statusText,
    }
  }
}
