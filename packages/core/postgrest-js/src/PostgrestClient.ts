import PostgrestQueryBuilder from './PostgrestQueryBuilder'
import PostgrestFilterBuilder from './PostgrestFilterBuilder'
import { Fetch, GenericSchema, ClientServerOptions } from './types/common/common'
import { GetRpcFunctionFilterBuilderByArgs } from './types/common/rpc'

/**
 * PostgREST client.
 *
 * @typeParam Database - Types for the schema from the [type
 * generator](https://supabase.com/docs/reference/javascript/next/typescript-support)
 *
 * @typeParam SchemaName - Postgres schema to switch to. Must be a string
 * literal, the same one passed to the constructor. If the schema is not
 * `"public"`, this must be supplied manually.
 */
export default class PostgrestClient<
  Database = any,
  ClientOptions extends ClientServerOptions = Database extends {
    __InternalSupabase: infer I extends ClientServerOptions
  }
    ? I
    : {},
  SchemaName extends string &
    keyof Omit<Database, '__InternalSupabase'> = 'public' extends keyof Omit<
    Database,
    '__InternalSupabase'
  >
    ? 'public'
    : string & keyof Omit<Database, '__InternalSupabase'>,
  Schema extends GenericSchema = Omit<
    Database,
    '__InternalSupabase'
  >[SchemaName] extends GenericSchema
    ? Omit<Database, '__InternalSupabase'>[SchemaName]
    : any,
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
  from<
    TableName extends string & keyof Schema['Tables'],
    Table extends Schema['Tables'][TableName],
  >(relation: TableName): PostgrestQueryBuilder<ClientOptions, Schema, Table, TableName>
  from<ViewName extends string & keyof Schema['Views'], View extends Schema['Views'][ViewName]>(
    relation: ViewName
  ): PostgrestQueryBuilder<ClientOptions, Schema, View, ViewName>
  /**
   * Perform a query on a table or a view.
   *
   * @param relation - The table or view name to query
   *
   * @category Database
   */
  from(
    relation: (string & keyof Schema['Tables']) | (string & keyof Schema['Views'])
  ): PostgrestQueryBuilder<ClientOptions, Schema, any, any> {
    if (!relation || typeof relation !== 'string' || relation.trim() === '') {
      throw new Error('Invalid relation name: relation must be a non-empty string.')
    }

    const url = new URL(`${this.url}/${relation}`)
    return new PostgrestQueryBuilder(url, {
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
  schema<DynamicSchema extends string & keyof Omit<Database, '__InternalSupabase'>>(
    schema: DynamicSchema
  ): PostgrestClient<
    Database,
    ClientOptions,
    DynamicSchema,
    Database[DynamicSchema] extends GenericSchema ? Database[DynamicSchema] : any
  > {
    return new PostgrestClient(this.url, {
      headers: this.headers,
      schema,
      fetch: this.fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry,
    })
  }

  /**
   * Perform a function call.
   *
   * @param fn - The function name to call
   * @param args - The arguments to pass to the function call
   * @param options - Named parameters
   * @param options.head - When set to `true`, `data` will not be returned.
   * Useful if you only need the count.
   * @param options.get - When set to `true`, the function will be called with
   * read-only access mode.
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
   * // For cross-schema functions where type inference fails, use overrideTypes:
   * const { data } = await supabase
   *   .schema('schema_b')
   *   .rpc('function_a', {})
   *   .overrideTypes<{ id: string; user_id: string }[]>()
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
    FnName extends string & keyof Schema['Functions'],
    Args extends Schema['Functions'][FnName]['Args'] = never,
    FilterBuilder extends GetRpcFunctionFilterBuilderByArgs<
      Schema,
      FnName,
      Args
    > = GetRpcFunctionFilterBuilderByArgs<Schema, FnName, Args>,
  >(
    fn: FnName,
    args: Args = {} as Args,
    {
      head = false,
      get = false,
      count,
    }: {
      head?: boolean
      get?: boolean
      count?: 'exact' | 'planned' | 'estimated'
    } = {}
  ): PostgrestFilterBuilder<
    ClientOptions,
    Schema,
    FilterBuilder['Row'],
    FilterBuilder['Result'],
    FilterBuilder['RelationName'],
    FilterBuilder['Relationships'],
    'RPC'
  > {
    let method: 'HEAD' | 'GET' | 'POST'
    const url = new URL(`${this.url}/rpc/${fn}`)
    let body: unknown | undefined
    // objects/arrays-of-objects can't be serialized to URL params, use POST + return=minimal instead
    const _isObject = (v: unknown): boolean =>
      v !== null && typeof v === 'object' && (!Array.isArray(v) || v.some(_isObject))
    const _hasObjectArg = head && Object.values(args as object).some(_isObject)
    if (_hasObjectArg) {
      method = 'POST'
      body = args
    } else if (head || get) {
      method = head ? 'HEAD' : 'GET'
      Object.entries(args)
        // params with undefined value needs to be filtered out, otherwise it'll
        // show up as `?param=undefined`
        .filter(([_, value]) => value !== undefined)
        // array values need special syntax
        .map(([name, value]) => [name, Array.isArray(value) ? `{${value.join(',')}}` : `${value}`])
        .forEach(([name, value]) => {
          url.searchParams.append(name, value)
        })
    } else {
      method = 'POST'
      body = args
    }

    const headers = new Headers(this.headers)
    if (_hasObjectArg) {
      headers.set('Prefer', count ? `count=${count},return=minimal` : 'return=minimal')
    } else if (count) {
      headers.set('Prefer', `count=${count}`)
    }

    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schemaName,
      body,
      fetch: this.fetch ?? fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry,
    })
  }
}
