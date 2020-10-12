import fetch from 'cross-fetch'

/**
 * Error format
 *
 * {@link https://postgrest.org/en/stable/api.html?highlight=options#errors-and-http-status-codes}
 */
interface PostgrestError {
  message: string
  details: string
  hint: string
  code: string
}

/**
 * Response format
 *
 * {@link https://github.com/supabase/supabase-js/issues/32}
 */
interface PostgrestResponse<T> {
  error: PostgrestError | null
  data: T | T[] | null
  status: number
  statusText: string
  // For backward compatibility: body === data
  body: T | T[] | null
}

/**
 * Base builder
 */

export abstract class PostgrestBuilder<T> implements PromiseLike<any> {
  method!: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'DELETE'
  url!: URL
  headers!: { [key: string]: string }
  schema?: string
  body?: Partial<T> | Partial<T>[]

  constructor(builder: PostgrestBuilder<T>) {
    Object.assign(this, builder)
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (value: any) => any): Promise<any> {
    // https://postgrest.org/en/stable/api.html#switching-schemas
    if (typeof this.schema === 'undefined') {
      // skip
    } else if (['GET', 'HEAD'].includes(this.method)) {
      this.headers['Accept-Profile'] = this.schema
    } else {
      this.headers['Content-Profile'] = this.schema
    }
    if (this.method !== 'GET' && this.method !== 'HEAD') {
      this.headers['Content-Type'] = 'application/json'
    }

    return fetch(this.url.toString(), {
      method: this.method,
      headers: this.headers,
      body: JSON.stringify(this.body),
    })
      .then(async (res) => {
        let error, data
        if (res.ok) {
          error = null
          data = await res.json()
        } else {
          error = await res.json()
          data = null
        }
        return {
          error,
          data,
          status: res.status,
          statusText: res.statusText,
          body: data,
        } as PostgrestResponse<T>
      })
      .then(onfulfilled, onrejected)
  }
}

/**
 * CRUD
 */

export class PostgrestQueryBuilder<T> extends PostgrestBuilder<T> {
  constructor(
    url: string,
    { headers = {}, schema }: { headers?: { [key: string]: string }; schema?: string } = {}
  ) {
    super({} as PostgrestBuilder<T>)
    this.url = new URL(url)
    this.headers = { ...headers }
    this.schema = schema
  }

  /**
   * Performs horizontal filtering with SELECT.
   *
   * @param columns  The columns to retrieve, separated by commas.
   */
  select(columns = '*'): PostgrestFilterBuilder<T> {
    this.method = 'GET'
    // Remove whitespaces except when quoted
    let quoted = false
    const cleanedColumns = columns
      .split('')
      .map((c) => {
        if (/\s/.test(c) && !quoted) {
          return ''
        }
        if (c === '"') {
          quoted = !quoted
        }
        return c
      })
      .join('')
    this.url.searchParams.set('select', cleanedColumns)
    return new PostgrestFilterBuilder(this)
  }

  /**
   * Performs an INSERT into the table.
   *
   * @param values  The values to insert.
   * @param upsert  If `true`, performs an UPSERT.
   * @param onConflict By specifying the `on_conflict` query parameter, you can make UPSERT work on a column(s) that has a UNIQUE constraint.
   */
  insert(
    values: Partial<T> | Partial<T>[],
    { upsert = false, onConflict }: { upsert?: boolean; onConflict?: string } = {}
  ): PostgrestFilterBuilder<T> {
    this.method = 'POST'
    this.headers['Prefer'] = upsert
      ? 'return=representation,resolution=merge-duplicates'
      : 'return=representation'
    if (upsert && onConflict !== undefined) this.url.searchParams.set('on_conflict', onConflict)
    this.body = values
    return new PostgrestFilterBuilder(this)
  }

  /**
   * Performs an UPDATE on the table.
   *
   * @param values  The values to update.
   */
  update(values: Partial<T>): PostgrestFilterBuilder<T> {
    this.method = 'PATCH'
    this.headers['Prefer'] = 'return=representation'
    this.body = values
    return new PostgrestFilterBuilder(this)
  }

  /**
   * Performs a DELETE on the table.
   */
  delete(): PostgrestFilterBuilder<T> {
    this.method = 'DELETE'
    this.headers['Prefer'] = 'return=representation'
    return new PostgrestFilterBuilder(this)
  }

  /** @internal */
  rpc(params?: object): PostgrestBuilder<T> {
    this.method = 'POST'
    this.body = params
    return this
  }
}

/**
 * Post-filters (transforms)
 */

class PostgrestTransformBuilder<T> extends PostgrestBuilder<T> {
  /**
   * Orders the result with the specified `column`.
   *
   * @param column  The column to order on.
   * @param ascending  If `true`, the result will be in ascending order.
   * @param nullsFirst  If `true`, `null`s appear first.
   * @param foreignTable  The foreign table to use (if `column` is a foreign column).
   */
  order(
    column: keyof T,
    {
      ascending = true,
      nullsFirst = false,
      foreignTable,
    }: { ascending?: boolean; nullsFirst?: boolean; foreignTable?: string } = {}
  ): PostgrestTransformBuilder<T> {
    const key = typeof foreignTable === 'undefined' ? 'order' : `"${foreignTable}".order`
    this.url.searchParams.set(
      key,
      `"${column}".${ascending ? 'asc' : 'desc'}.${nullsFirst ? 'nullsfirst' : 'nullslast'}`
    )
    return this
  }

  /**
   * Limits the result with the specified `count`.
   *
   * @param count  The maximum no. of rows to limit to.
   * @param foreignTable  The foreign table to use (for foreign columns).
   */
  limit(
    count: number,
    { foreignTable }: { foreignTable?: string } = {}
  ): PostgrestTransformBuilder<T> {
    const key = typeof foreignTable === 'undefined' ? 'limit' : `"${foreignTable}".limit`
    this.url.searchParams.set(key, `${count}`)
    return this
  }

  /**
   * Limits the result to rows within the specified range, inclusive.
   *
   * @param from  The starting index from which to limit the result, inclusive.
   * @param to  The last index to which to limit the result, inclusive.
   * @param foreignTable  The foreign table to use (for foreign columns).
   */
  range(
    from: number,
    to: number,
    { foreignTable }: { foreignTable?: string } = {}
  ): PostgrestTransformBuilder<T> {
    const keyOffset = typeof foreignTable === 'undefined' ? 'offset' : `"${foreignTable}".offset`
    const keyLimit = typeof foreignTable === 'undefined' ? 'limit' : `"${foreignTable}".limit`
    this.url.searchParams.set(keyOffset, `${from}`)
    // Range is inclusive, so add 1
    this.url.searchParams.set(keyLimit, `${to - from + 1}`)
    return this
  }

  /**
   * Retrieves only one row from the result. Result must be one row (e.g. using
   * `limit`), otherwise this will result in an error.
   */
  single(): PostgrestTransformBuilder<T> {
    this.headers['Accept'] = 'application/vnd.pgrst.object+json'
    return this
  }
}

/**
 * Filters
 */

const cleanFilterArray = <T>(filter: T[keyof T][]) => filter.map((s) => `"${s}"`).join(',')

type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'is'
  | 'in'
  | 'cs'
  | 'cd'
  | 'sl'
  | 'sr'
  | 'nxl'
  | 'nxr'
  | 'adj'
  | 'ov'
  | 'fts'
  | 'plfts'
  | 'phfts'
  | 'wfts'

class PostgrestFilterBuilder<T> extends PostgrestTransformBuilder<T> {
  /**
   * Finds all rows which doesn't satisfy the filter.
   *
   * @param column  The column to filter on.
   * @param operator  The operator to filter with.
   * @param value  The value to filter with.
   */
  not(column: keyof T, operator: FilterOperator, value: any): this {
    this.url.searchParams.append(`${column}`, `not.${operator}.${value}`)
    return this
  }

  /**
   * Finds all rows satisfying at least one of the filters.
   *
   * @param filters  The filters to use, separated by commas.
   */
  or(filters: string): this {
    this.url.searchParams.append('or', `(${filters})`)
    return this
  }

  /**
   * Finds all rows whose value on the stated `column` exactly matches the
   * specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  eq(column: keyof T, value: T[keyof T]): this {
    this.url.searchParams.append(`${column}`, `eq.${value}`)
    return this
  }

  /**
   * Finds all rows whose value on the stated `column` doesn't match the
   * specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  neq(column: keyof T, value: T[keyof T]): this {
    this.url.searchParams.append(`${column}`, `neq.${value}`)
    return this
  }

  /**
   * Finds all rows whose value on the stated `column` is greater than the
   * specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  gt(column: keyof T, value: T[keyof T]): this {
    this.url.searchParams.append(`${column}`, `gt.${value}`)
    return this
  }

  /**
   * Finds all rows whose value on the stated `column` is greater than or
   * equal to the specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  gte(column: keyof T, value: T[keyof T]): this {
    this.url.searchParams.append(`${column}`, `gte.${value}`)
    return this
  }

  /**
   * Finds all rows whose value on the stated `column` is less than the
   * specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  lt(column: keyof T, value: T[keyof T]): this {
    this.url.searchParams.append(`${column}`, `lt.${value}`)
    return this
  }

  /**
   * Finds all rows whose value on the stated `column` is less than or equal
   * to the specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  lte(column: keyof T, value: T[keyof T]): this {
    this.url.searchParams.append(`${column}`, `lte.${value}`)
    return this
  }

  /**
   * Finds all rows whose value in the stated `column` matches the supplied
   * `pattern` (case sensitive).
   *
   * @param column  The column to filter on.
   * @param pattern  The pattern to filter with.
   */
  like(column: keyof T, pattern: string): this {
    this.url.searchParams.append(`${column}`, `like.${pattern}`)
    return this
  }

  /**
   * Finds all rows whose value in the stated `column` matches the supplied
   * `pattern` (case insensitive).
   *
   * @param column  The column to filter on.
   * @param pattern  The pattern to filter with.
   */
  ilike(column: keyof T, pattern: string): this {
    this.url.searchParams.append(`${column}`, `ilike.${pattern}`)
    return this
  }

  /**
   * A check for exact equality (null, true, false), finds all rows whose
   * value on the stated `column` exactly match the specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  is(column: keyof T, value: boolean | null): this {
    this.url.searchParams.append(`${column}`, `is.${value}`)
    return this
  }

  /**
   * Finds all rows whose value on the stated `column` is found on the
   * specified `values`.
   *
   * @param column  The column to filter on.
   * @param values  The values to filter with.
   */
  in(column: keyof T, values: T[keyof T][]): this {
    this.url.searchParams.append(`${column}`, `in.(${cleanFilterArray(values)})`)
    return this
  }

  /**
   * Finds all rows whose json, array, or range value on the stated `column`
   * contains the values specified in `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  cs(column: keyof T, value: string | T[keyof T][] | object): this {
    if (typeof value === 'string') {
      // range types can be inclusive '[', ']' or exclusive '(', ')' so just
      // keep it simple and accept a string
      this.url.searchParams.append(`${column}`, `cs.${value}`)
    } else if (Array.isArray(value)) {
      // array
      this.url.searchParams.append(`${column}`, `cs.{${cleanFilterArray(value)}}`)
    } else {
      // json
      this.url.searchParams.append(`${column}`, `cs.${JSON.stringify(value)}`)
    }
    return this
  }

  /**
   * Finds all rows whose json, array, or range value on the stated `column` is
   * contained by the specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  cd(column: keyof T, value: string | T[keyof T][] | object): this {
    if (typeof value === 'string') {
      // range
      this.url.searchParams.append(`${column}`, `cd.${value}`)
    } else if (Array.isArray(value)) {
      // array
      this.url.searchParams.append(`${column}`, `cd.{${cleanFilterArray(value)}}`)
    } else {
      // json
      this.url.searchParams.append(`${column}`, `cd.${JSON.stringify(value)}`)
    }
    return this
  }

  /**
   * Finds all rows whose range value on the stated `column` is strictly to the
   * left of the specified `range`.
   *
   * @param column  The column to filter on.
   * @param range  The range to filter with.
   */
  sl(column: keyof T, range: string): this {
    this.url.searchParams.append(`${column}`, `sl.${range}`)
    return this
  }

  /**
   * Finds all rows whose range value on the stated `column` is strictly to
   * the right of the specified `range`.
   *
   * @param column  The column to filter on.
   * @param range  The range to filter with.
   */
  sr(column: keyof T, range: string): this {
    this.url.searchParams.append(`${column}`, `sr.${range}`)
    return this
  }

  /**
   * Finds all rows whose range value on the stated `column` does not extend
   * to the left of the specified `range`.
   *
   * @param column  The column to filter on.
   * @param range  The range to filter with.
   */
  nxl(column: keyof T, range: string): this {
    this.url.searchParams.append(`${column}`, `nxl.${range}`)
    return this
  }

  /**
   * Finds all rows whose range value on the stated `column` does not extend
   * to the right of the specified `range`.
   *
   * @param column  The column to filter on.
   * @param range  The range to filter with.
   */
  nxr(column: keyof T, range: string): this {
    this.url.searchParams.append(`${column}`, `nxr.${range}`)
    return this
  }

  /**
   * Finds all rows whose range value on the stated `column` is adjacent to
   * the specified `range`.
   *
   * @param column  The column to filter on.
   * @param range  The range to filter with.
   */
  adj(column: keyof T, range: string): this {
    this.url.searchParams.append(`${column}`, `adj.${range}`)
    return this
  }

  /**
   * Finds all rows whose array or range value on the stated `column` is
   * contained by the specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  ov(column: keyof T, value: string | T[keyof T][]): this {
    if (typeof value === 'string') {
      // range
      this.url.searchParams.append(`${column}`, `ov.${value}`)
    } else {
      // array
      this.url.searchParams.append(`${column}`, `ov.{${cleanFilterArray(value)}}`)
    }
    return this
  }

  /**
   * Finds all rows whose tsvector value on the stated `column` matches
   * to_tsquery(`query`).
   *
   * @param column  The column to filter on.
   * @param query  The Postgres tsquery string to filter with.
   * @param config  The text search configuration to use.
   */
  fts(column: keyof T, query: string, { config }: { config?: string } = {}): this {
    const configPart = typeof config === 'undefined' ? '' : `(${config})`
    this.url.searchParams.append(`${column}`, `fts${configPart}.${query}`)
    return this
  }

  /**
   * Finds all rows whose tsvector value on the stated `column` matches
   * plainto_tsquery(`query`).
   *
   * @param column  The column to filter on.
   * @param query  The Postgres tsquery string to filter with.
   * @param config  The text search configuration to use.
   */
  plfts(column: keyof T, query: string, { config }: { config?: string } = {}): this {
    const configPart = typeof config === 'undefined' ? '' : `(${config})`
    this.url.searchParams.append(`${column}`, `plfts${configPart}.${query}`)
    return this
  }

  /**
   * Finds all rows whose tsvector value on the stated `column` matches
   * phraseto_tsquery(`query`).
   *
   * @param column  The column to filter on.
   * @param query  The Postgres tsquery string to filter with.
   * @param config  The text search configuration to use.
   */
  phfts(column: keyof T, query: string, { config }: { config?: string } = {}): this {
    const configPart = typeof config === 'undefined' ? '' : `(${config})`
    this.url.searchParams.append(`${column}`, `phfts${configPart}.${query}`)
    return this
  }

  /**
   * Finds all rows whose tsvector value on the stated `column` matches
   * websearch_to_tsquery(`query`).
   *
   * @param column  The column to filter on.
   * @param query  The Postgres tsquery string to filter with.
   * @param config  The text search configuration to use.
   */
  wfts(column: keyof T, query: string, { config }: { config?: string } = {}): this {
    const configPart = typeof config === 'undefined' ? '' : `(${config})`
    this.url.searchParams.append(`${column}`, `wfts${configPart}.${query}`)
    return this
  }

  /**
   * Finds all rows whose `column` satisfies the filter.
   *
   * @param column  The column to filter on.
   * @param operator  The operator to filter with.
   * @param value  The value to filter with.
   */
  filter(column: keyof T, operator: FilterOperator, value: any): this {
    this.url.searchParams.append(`${column}`, `${operator}.${value}`)
    return this
  }

  /**
   * Finds all rows whose columns match the specified `query` object.
   *
   * @param query  The object to filter with, with column names as keys mapped
   *               to their filter values.
   */
  match(query: { [key: string]: string }) {
    Object.keys(query).forEach((key) => {
      this.url.searchParams.append(`${key}`, `eq.${query[key]}`)
    })
    return this
  }
}
