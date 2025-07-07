import PostgrestQueryBuilder from './PostgrestQueryBuilder'
import PostgrestFilterBuilder from './PostgrestFilterBuilder'
import { Fetch, GenericSchema, ClientServerOptions, GetGenericDatabaseWithOptions } from './types'

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
  ClientOptions extends ClientServerOptions = GetGenericDatabaseWithOptions<
    Database,
    { PostgrestVersion: '12' }
  >['options'],
  SchemaName extends string &
    keyof GetGenericDatabaseWithOptions<Database>['db'] = 'public' extends keyof GetGenericDatabaseWithOptions<Database>['db']
    ? 'public'
    : string & keyof GetGenericDatabaseWithOptions<Database>['db'],
  Schema extends GenericSchema = GetGenericDatabaseWithOptions<Database>['db'][SchemaName] extends GenericSchema
    ? GetGenericDatabaseWithOptions<Database>['db'][SchemaName]
    : any
> {
  url: string
  headers: Headers
  schemaName?: SchemaName
  fetch?: Fetch

  // TODO: Add back shouldThrowOnError once we figure out the typings
  /**
   * Creates a PostgREST client.
   *
   * @param url - URL of the PostgREST endpoint
   * @param options - Named parameters
   * @param options.headers - Custom headers
   * @param options.schema - Postgres schema to switch to
   * @param options.fetch - Custom fetch
   */
  constructor(
    url: string,
    {
      headers = {},
      schema,
      fetch,
    }: {
      headers?: HeadersInit
      schema?: SchemaName
      fetch?: Fetch
    } = {}
  ) {
    this.url = url
    this.headers = new Headers(headers)
    this.schemaName = schema
    this.fetch = fetch
  }
  from<
    TableName extends string & keyof Schema['Tables'],
    Table extends Schema['Tables'][TableName]
  >(relation: TableName): PostgrestQueryBuilder<ClientOptions, Schema, Table, TableName>
  from<ViewName extends string & keyof Schema['Views'], View extends Schema['Views'][ViewName]>(
    relation: ViewName
  ): PostgrestQueryBuilder<ClientOptions, Schema, View, ViewName>
  /**
   * Perform a query on a table or a view.
   *
   * @param relation - The table or view name to query
   */
  from(relation: string): PostgrestQueryBuilder<ClientOptions, Schema, any, any> {
    const url = new URL(`${this.url}/${relation}`)
    return new PostgrestQueryBuilder(url, {
      headers: new Headers(this.headers),
      schema: this.schemaName,
      fetch: this.fetch,
    })
  }

  /**
   * Select a schema to query or perform an function (rpc) call.
   *
   * The schema needs to be on the list of exposed schemas inside Supabase.
   *
   * @param schema - The schema to query
   */
  schema<DynamicSchema extends string & keyof GetGenericDatabaseWithOptions<Database>['db']>(
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
   */
  rpc<FnName extends string & keyof Schema['Functions'], Fn extends Schema['Functions'][FnName]>(
    fn: FnName,
    args: Fn['Args'] = {},
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
    Fn['Returns'] extends any[]
      ? Fn['Returns'][number] extends Record<string, unknown>
        ? Fn['Returns'][number]
        : never
      : never,
    Fn['Returns'],
    FnName,
    null,
    'RPC'
  > {
    let method: 'HEAD' | 'GET' | 'POST'
    const url = new URL(`${this.url}/rpc/${fn}`)
    let body: unknown | undefined
    if (head || get) {
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
    if (count) {
      headers.set('Prefer', `count=${count}`)
    }

    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schemaName,
      body,
      fetch: this.fetch ?? fetch,
    })
  }
}
