import PostgrestQueryBuilder from './PostgrestQueryBuilder'
import PostgrestRpcBuilder from './PostgrestRpcBuilder'
import PostgrestFilterBuilder from './PostgrestFilterBuilder'
import PostgrestBuilder from './PostgrestBuilder'
import { DEFAULT_HEADERS } from './constants'
import { Fetch } from './types'

export default class PostgrestClient {
  url: string
  headers: Record<string, string>
  schema?: string
  fetch?: Fetch
  shouldThrowOnError: boolean

  /**
   * Creates a PostgREST client.
   *
   * @param url  URL of the PostgREST endpoint.
   * @param headers  Custom headers.
   * @param schema  Postgres schema to switch to.
   */
  constructor(
    url: string,
    {
      headers = {},
      schema,
      fetch,
      throwOnError = false,
    }: {
      headers?: Record<string, string>
      schema?: string
      fetch?: Fetch
      throwOnError?: boolean
    } = {}
  ) {
    this.url = url
    this.headers = { ...DEFAULT_HEADERS, ...headers }
    this.schema = schema
    this.fetch = fetch
    this.shouldThrowOnError = throwOnError
  }

  /**
   * Authenticates the request with JWT.
   *
   * @param token  The JWT token to use.
   *
   * @deprecated Use `headers` in constructor instead.
   */
  auth(token: string): this {
    this.headers['Authorization'] = `Bearer ${token}`
    return this
  }

  /**
   * Perform a table operation.
   *
   * @param table  The table name to operate on.
   */
  from<T = any>(table: string): PostgrestQueryBuilder<T> {
    const url = `${this.url}/${table}`
    return new PostgrestQueryBuilder<T>(url, {
      headers: { ...this.headers },
      schema: this.schema,
      fetch: this.fetch,
      shouldThrowOnError: this.shouldThrowOnError,
    })
  }

  /**
   * Perform a function call.
   *
   * @param fn  The function name to call.
   * @param params  The parameters to pass to the function call.
   * @param head  When set to true, no data will be returned.
   * @param count  Count algorithm to use to count rows in a table.
   */
  rpc<T = any>(
    fn: string,
    params?: object,
    {
      head = false,
      count = null,
    }: {
      head?: boolean
      count?: null | 'exact' | 'planned' | 'estimated'
    } = {}
  ): PostgrestFilterBuilder<T> {
    const url = `${this.url}/rpc/${fn}`
    return new PostgrestRpcBuilder<T>(url, {
      headers: this.headers,
      schema: this.schema,
      fetch: this.fetch,
      shouldThrowOnError: this.shouldThrowOnError,
    }).rpc(params, { head, count })
  }
}
