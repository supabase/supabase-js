import PostgrestQueryBuilder from './PostgrestQueryBuilder'
import PostgrestFilterBuilder from './PostgrestFilterBuilder'
import type { Fetch } from './types/common/common'
import type { DefaultDatabase } from './types/planner/globals'
import type { MS } from './types/planner/lookup'
import type { RpcOp, RpcOptions, SelCount } from './types/planner/options'
import type {
  AllKeys,
  ArgsMismatch,
  BaseOfCalls,
  CallReject,
  CallsOf,
  FnDefs,
  ReadRefusal,
  RelDefs,
  ReturnsOf,
  RowCalls,
  RpcB,
  SchemaOf,
  Unchecked,
} from './types/planner/rpc'
import type { RpcDesc } from './types/planner/lookup'
import PostgrestError from './PostgrestError'
import { fetchWithRetry } from './fetchWithRetry'
import { rpcReadRefusal } from './rpcReadRefusal'
import type {
  PostgrestOpenApiSpec,
  PostgrestResponseFailure,
  PostgrestSingleResponse,
} from './types/types'

function toOpenApiError(body: string, statusText: string): PostgrestError {
  try {
    const parsed = JSON.parse(body)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return new PostgrestError({
        message: String(parsed.message ?? body),
        details: parsed.details ?? '',
        hint: parsed.hint ?? '',
        code: parsed.code ?? '',
      })
    }
  } catch {
    // Not JSON; fall through to the plain-text message.
  }
  return new PostgrestError({ message: body || statusText, details: '', hint: '', code: '' })
}

/**
 * Build the response for a request that yielded no readable body: the fetch
 * itself rejected (no status is known, so it is 0), or the body stream failed
 * while being read (the response status is preserved).
 */
function toTransportFailure(
  cause: unknown,
  status: number,
  statusText: string
): PostgrestResponseFailure {
  const err = cause as { name?: string; message?: string } | null | undefined
  return {
    success: false,
    error: new PostgrestError({
      message: `${err?.name ?? 'FetchError'}: ${err?.message}`,
      details: '',
      hint: '',
      code: '',
    }),
    data: null,
    count: null,
    status,
    statusText,
  }
}

// the `args` parameter of an rpc: the argument object, or what is wrong with it
type RpcArgs<
  Database,
  SchemaName extends string & keyof Database,
  F extends string & keyof FnDefs<Database, SchemaName>,
  A,
  O,
> = [AllKeys<A>] extends [never]
  ? A
  : [ReadRefusal<A, O>] extends [never]
    ? [CallReject<CallsOf<SchemaOf<Database, SchemaName>, F, A, O>>] extends [never]
      ? Unchecked<CallsOf<SchemaOf<Database, SchemaName>, F, A, O>> extends true
        ? A
        : [ArgsMismatch<A, FnDefs<Database, SchemaName>[F]>] extends [never]
          ? A
          : ArgsMismatch<A, FnDefs<Database, SchemaName>[F]> // wrong value types: the error points at the offending property
      : CallReject<CallsOf<SchemaOf<Database, SchemaName>, F, A, O>>
    : ReadRefusal<A, O>

/**
 * The v2 options object, the second type argument of the client in place of a schema name. PostgREST features are
 * resolved by the generator now, so it carries nothing the client reads.
 *
 * @deprecated Pass the schema name, or only the database.
 */
export type PostgrestClientOptions = {
  PostgrestVersion?: string
}

/**
 * The schema names of a database. `__InternalSupabase`, which the type generator emits next to the schemas, is not one.
 */
export type SchemaNameOf<Database> = Exclude<string & keyof Database, '__InternalSupabase'>

/** The schema a client reads when none is given: `"public"` when the database has it, else any of its schemas. */
export type DefaultSchemaNameOf<Database> =
  'public' extends SchemaNameOf<Database> ? 'public' : SchemaNameOf<Database>

/**
 * PostgREST client.
 *
 * @typeParam Database - Types for the schema from the [type
 * generator](https://supabase.com/docs/reference/javascript/next/typescript-support)
 *
 * @typeParam SchemaNameOrClientOptions - Postgres schema to switch to, or the
 * v2 options object (`{ PostgrestVersion: string }`, ignored). Must be a string
 * literal, the same one passed to the constructor. If the schema is not
 * `"public"`, this must be supplied manually.
 *
 * @typeParam SchemaName - The Postgres schema, when `SchemaNameOrClientOptions`
 * is the options object. Defaults to `"public"`, else the first schema.
 * `__InternalSupabase`, which the type generator emits next to the schemas, is
 * never a schema.
 */
export default class PostgrestClient<
  Database = DefaultDatabase,
  SchemaNameOrClientOptions extends SchemaNameOf<Database> | PostgrestClientOptions =
    DefaultSchemaNameOf<Database>,
  SchemaName extends SchemaNameOf<Database> =
    SchemaNameOrClientOptions extends SchemaNameOf<Database>
      ? SchemaNameOrClientOptions
      : DefaultSchemaNameOf<Database>,
> {
  url: string
  headers: Headers
  schemaName?: SchemaName
  fetch?: Fetch
  urlLengthLimit: number

  // Retry configuration - enabled by default
  retry?: boolean

  // TODO: Add back shouldThrowOnError once we figure out the typings
  /**
   * Creates a PostgREST client.
   *
   * @param url - URL of the PostgREST endpoint
   * @param options - Named parameters
   * @param options.headers - Custom headers
   * @param options.schema - Postgres schema to switch to
   * @param options.fetch - Custom fetch
   * @param options.timeout - Optional timeout in milliseconds for all requests. When set, requests will automatically abort after this duration to prevent indefinite hangs.
   * @param options.urlLengthLimit - Maximum URL length in characters before warnings/errors are triggered. Defaults to 8000.
   * @param options.retry - Enable or disable automatic retries for transient errors.
   *   When enabled, idempotent requests (GET, HEAD, OPTIONS) that fail with network
   *   errors or HTTP 503/520 responses will be automatically retried up to 3 times
   *   with exponential backoff (1s, 2s, 4s). Defaults to `true`.
   * @example Using supabase-js (recommended)
   * ```ts
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
   * const { data, error } = await supabase.from('profiles').select('*')
   * ```
   *
   * @category Database
   *
   * @remarks
   * - A `timeout` option (in milliseconds) can be set to automatically abort requests that take too long.
   * - A `urlLengthLimit` option (default: 8000) can be set to control when URL length warnings are included in error messages for aborted requests.
   *
   * @example Standalone import for bundle-sensitive environments
   * ```ts
   * import { PostgrestClient } from '@supabase/postgrest-js'
   *
   * const postgrest = new PostgrestClient('https://xyzcompany.supabase.co/rest/v1', {
   *   headers: { apikey: 'your-publishable-key' },
   *   schema: 'public',
   *   timeout: 30000, // 30 second timeout
   * })
   * ```
   */
  constructor(
    url: string,
    {
      headers = {},
      schema,
      fetch,
      timeout,
      urlLengthLimit = 8000,
      retry,
    }: {
      headers?: HeadersInit
      schema?: SchemaName
      fetch?: Fetch
      timeout?: number
      urlLengthLimit?: number
      retry?: boolean
    } = {}
  ) {
    this.url = url
    this.headers = new Headers(headers)
    this.schemaName = schema
    this.urlLengthLimit = urlLengthLimit

    const originalFetch = fetch ?? globalThis.fetch

    // Wrap fetch with timeout if specified
    if (timeout !== undefined && timeout > 0) {
      this.fetch = (input, init) => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        // Merge abort signals if one already exists
        const existingSignal = init?.signal
        if (existingSignal) {
          // If the existing signal is already aborted, use it directly
          if (existingSignal.aborted) {
            clearTimeout(timeoutId)
            return originalFetch(input, init)
          }

          // Listen to existing signal and abort our controller too
          const abortHandler = () => {
            clearTimeout(timeoutId)
            controller.abort()
          }
          existingSignal.addEventListener('abort', abortHandler, { once: true })

          return originalFetch(input, {
            ...init,
            signal: controller.signal,
          }).finally(() => {
            clearTimeout(timeoutId)
            existingSignal.removeEventListener('abort', abortHandler)
          })
        }

        return originalFetch(input, {
          ...init,
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId))
      }
    } else {
      this.fetch = originalFetch
    }
    this.retry = retry
  }
  /**
   * Perform a query on a table or a view.
   *
   * @param relation - The table or view name to query
   *
   * @category Database
   */
  from<const R extends string & keyof RelDefs<Database, SchemaName>>(
    relation: R
  ): PostgrestQueryBuilder<Database, SchemaName, R>
  from(relation: string): PostgrestQueryBuilder<any, any, any> {
    if (!relation || typeof relation !== 'string' || relation.trim() === '') {
      throw new Error('Invalid relation name: relation must be a non-empty string.')
    }

    const url = new URL(`${this.url}/${relation}`)
    return new PostgrestQueryBuilder<any, any, any>(url, {
      headers: new Headers(this.headers),
      schema: this.schemaName,
      fetch: this.fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry,
    })
  }

  /**
   * Select a schema to query or perform an function (rpc) call.
   *
   * The schema needs to be on the list of exposed schemas inside Supabase.
   *
   * @param schema - The schema to query
   *
   * @category Database
   */
  schema<const S2 extends SchemaNameOf<Database>>(schema: S2): PostgrestClient<Database, S2, S2> {
    return new PostgrestClient(this.url, {
      headers: this.headers,
      schema,
      fetch: this.fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry,
    })
  }

  /**
   * Fetch the OpenAPI description PostgREST publishes for this client's schema.
   *
   * The document lists only the tables, views and functions the caller's role
   * holds privileges on; PostgREST applies that filtering server-side. The
   * schema is the one this client was created with, so call `.schema()` first
   * to describe a different one. Transient failures are retried according to
   * the client's `retry` option, like any other idempotent request.
   *
   * @example
   * ```ts
   * const { data, error } = await supabase.getOpenApiSpec()
   * ```
   *
   * @example Describe a schema other than the client default
   * ```ts
   * const { data, error } = await supabase.schema('billing').getOpenApiSpec()
   * ```
   *
   * @category Database
   */
  async getOpenApiSpec(): Promise<PostgrestSingleResponse<PostgrestOpenApiSpec>> {
    const headers = new Headers(this.headers)
    headers.set('Accept', 'application/openapi+json')
    if (this.schemaName) {
      headers.set('Accept-Profile', this.schemaName)
    }

    // Headers reach the fetch implementation as a plain object, as in
    // PostgrestBuilder: React Native's XHR-based fetch drops headers that are
    // supplied as a Headers instance.
    const requestHeaders: Record<string, string> = {}
    headers.forEach((value, key) => {
      requestHeaders[key] = value
    })

    const fetchImpl = this.fetch ?? globalThis.fetch
    let res: Response
    try {
      res = await fetchWithRetry(
        fetchImpl,
        `${this.url}/`,
        { method: 'GET', headers: requestHeaders },
        this.retry ?? true
      )
    } catch (fetchError) {
      return toTransportFailure(fetchError, 0, '')
    }

    let body: string
    try {
      body = await res.text()
    } catch (readError) {
      return toTransportFailure(readError, res.status, res.statusText)
    }

    if (res.ok) {
      try {
        return {
          success: true,
          error: null,
          data: JSON.parse(body) as PostgrestOpenApiSpec,
          count: null,
          status: res.status,
          statusText: res.statusText,
        }
      } catch {
        // A 2xx status does not guarantee a JSON body; report it like a failure.
      }
    }

    return {
      success: false,
      error: toOpenApiError(body, res.statusText),
      data: null,
      count: null,
      status: res.status,
      statusText: res.statusText,
    }
  }

  /**
   * Perform a function call.
   *
   * The request is a `POST` by default, a `GET` with `get: true` and a `HEAD` with `head: true` (`head` wins over
   * `get`). The method never changes on its own. `GET` and `HEAD` run the function in a read-only transaction and
   * send the arguments in the query string, so a request the query string can't carry faithfully is refused
   * client-side, before any network call: the result is `{ data: null, error }` with a `PostgrestError` whose `code`
   * is `PGRSTJS01` (it throws instead after `.throwOnError()`). That covers a reserved key (`select`, `columns`,
   * `on_conflict`, or a key ending in `.order`, `.limit`, `.offset`, `.and` or `.or`), an object value (or an array
   * containing one), and a string value PostgREST would read as a filter (such as `'eq.x'` or `'in.(1,2)'`). Use
   * `POST` for those.
   *
   * @param fn - The function name to call
   * @param args - The arguments to pass to the function call
   * @param options - Named parameters
   * @param options.head - When set to `true`, the function is called with `HEAD`: `data` will not be returned.
   * Useful if you only need the count.
   * @param options.get - When set to `true`, the function is called with `GET`, which gives it read-only access
   * mode.
   * @param options.count - Count algorithm to use to count rows returned by the
   * function. Only applicable for [set-returning
   * functions](https://www.postgresql.org/docs/current/functions-srf.html).
   *
   * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
   * hood.
   *
   * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
   * statistics under the hood.
   *
   * `"estimated"`: Uses exact count for low numbers and planned count for high
   * numbers.
   *
   * @example
   * ```ts
   * // When the planner can't type a call, state the result yourself with `.cast<T>()`:
   * const { data } = await supabase
   *   .schema('schema_b')
   *   .rpc('function_a', {})
   *   .cast<{ id: string; user_id: string }[]>()
   * ```
   *
   * @category Database
   *
   * @example Call a Postgres function without arguments
   * ```ts
   * const { data, error } = await supabase.rpc('hello_world')
   * ```
   *
   * @exampleSql Call a Postgres function without arguments
   * ```sql
   * create function hello_world() returns text as $$
   *   select 'Hello world';
   * $$ language sql;
   * ```
   *
   * @exampleResponse Call a Postgres function without arguments
   * ```json
   * {
   *   "data": "Hello world",
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   *
   * @example Call a Postgres function with arguments
   * ```ts
   * const { data, error } = await supabase.rpc('echo', { say: '👋' })
   * ```
   *
   * @exampleSql Call a Postgres function with arguments
   * ```sql
   * create function echo(say text) returns text as $$
   *   select say;
   * $$ language sql;
   * ```
   *
   * @exampleResponse Call a Postgres function with arguments
   * ```json
   *   {
   *     "data": "👋",
   *     "status": 200,
   *     "statusText": "OK"
   *   }
   *
   * ```
   *
   * @exampleDescription Bulk processing
   * You can process large payloads by passing in an array as an argument.
   *
   * @example Bulk processing
   * ```ts
   * const { data, error } = await supabase.rpc('add_one_each', { arr: [1, 2, 3] })
   * ```
   *
   * @exampleSql Bulk processing
   * ```sql
   * create function add_one_each(arr int[]) returns int[] as $$
   *   select array_agg(n + 1) from unnest(arr) as n;
   * $$ language sql;
   * ```
   *
   * @exampleResponse Bulk processing
   * ```json
   * {
   *   "data": [
   *     2,
   *     3,
   *     4
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   *
   * @exampleDescription Call a Postgres function with filters
   * Postgres functions that return tables can also be combined with [Filters](/docs/reference/javascript/using-filters) and [Modifiers](/docs/reference/javascript/using-modifiers).
   *
   * @example Call a Postgres function with filters
   * ```ts
   * const { data, error } = await supabase
   *   .rpc('list_stored_countries')
   *   .eq('id', 1)
   *   .single()
   * ```
   *
   * @exampleSql Call a Postgres function with filters
   * ```sql
   * create table
   *   countries (id int8 primary key, name text);
   *
   * insert into
   *   countries (id, name)
   * values
   *   (1, 'Rohan'),
   *   (2, 'The Shire');
   *
   * create function list_stored_countries() returns setof countries as $$
   *   select * from countries;
   * $$ language sql;
   * ```
   *
   * @exampleResponse Call a Postgres function with filters
   * ```json
   * {
   *   "data": {
   *     "id": 1,
   *     "name": "Rohan"
   *   },
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   *
   * @example Call a read-only Postgres function
   * ```ts
   * const { data, error } = await supabase.rpc('hello_world', undefined, { get: true })
   * ```
   *
   * @exampleSql Call a read-only Postgres function
   * ```sql
   * create function hello_world() returns text as $$
   *   select 'Hello world';
   * $$ language sql;
   * ```
   *
   * @exampleResponse Call a read-only Postgres function
   * ```json
   * {
   *   "data": "Hello world",
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  rpc<
    const F extends string & keyof FnDefs<Database, SchemaName>,
    const A extends object = {},
    const O extends RpcOptions | undefined = {},
  >(
    // with no arguments there is no `args` to flag: the rejection lands on the name
    fn: [AllKeys<A>] extends [never]
      ? [CallReject<CallsOf<SchemaOf<Database, SchemaName>, F, A, O>>] extends [never]
        ? F
        : CallReject<CallsOf<SchemaOf<Database, SchemaName>, F, A, O>>
      : F,
    // a rest tuple: an optional parameter next to a conditional type would infer A one union member at a time, and an
    // optional `options` would drop `undefined` from the inferred O, while a bag that may be absent is one more
    // possible request
    ...rest:
      | [args?: undefined]
      | [args: undefined, options: O]
      | [args: RpcArgs<Database, SchemaName, F, A, O>]
      | [args: RpcArgs<Database, SchemaName, F, A, O>, options: O]
  ): PostgrestFilterBuilder<
    RpcB<Database, SchemaName, F, A, O>,
    RpcDesc<
      RowCalls<CallsOf<SchemaOf<Database, SchemaName>, F, A, O>, O>,
      true,
      ReturnsOf<Database, SchemaName, F>
    >,
    {},
    MS<
      RpcOp<O>,
      true,
      BaseOfCalls<
        CallsOf<SchemaOf<Database, SchemaName>, F, A, O>,
        ReturnsOf<Database, SchemaName, F>
      >,
      'default',
      'json',
      false,
      SelCount<O>,
      false,
      true
    >
  >
  rpc(
    fn: string,
    // `any`: the overload's `args` is, for the checker's erased signature, also the rejection message
    args: any = {},
    {
      head = false,
      get = false,
      count,
    }: {
      head?: boolean
      get?: boolean
      count?: 'exact' | 'planned' | 'estimated'
    } = {}
  ): any {
    // never switches method on its own: `head` wins over `get`, and arguments the query string can't carry are refused
    const method: 'HEAD' | 'GET' | 'POST' = head ? 'HEAD' : get ? 'GET' : 'POST'
    const url = new URL(`${this.url}/rpc/${fn}`)
    let body: unknown | undefined
    let clientError: PostgrestError | undefined
    if (method === 'POST') {
      body = args
    } else {
      clientError = rpcReadRefusal(args) ?? undefined
      // a refused request is never sent, and its arguments may not even be coercible to a string
      if (!clientError) {
        Object.entries(args)
          // params with undefined value needs to be filtered out, otherwise it'll
          // show up as `?param=undefined`
          .filter(([_, value]) => value !== undefined)
          // array values need special syntax
          .map(([name, value]) => [
            name,
            Array.isArray(value) ? `{${value.join(',')}}` : `${value}`,
          ])
          .forEach(([name, value]) => {
            url.searchParams.append(name, value)
          })
      }
    }

    const headers = new Headers(this.headers)
    if (count) {
      headers.set('Prefer', `count=${count}`)
    }

    return new PostgrestFilterBuilder<any, any, any, any>({
      method,
      url,
      headers,
      schema: this.schemaName,
      body,
      fetch: this.fetch ?? fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry,
      clientError,
    })
  }
}
