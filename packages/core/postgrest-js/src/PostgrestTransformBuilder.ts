import PostgrestBuilder from './PostgrestBuilder'
import { GetResult } from './select-query-parser'
import { GenericSchema } from './types'

export default class PostgrestTransformBuilder<
  Schema extends GenericSchema,
  Row extends Record<string, unknown>,
  Result,
  Relationships = unknown
> extends PostgrestBuilder<Result> {
  /**
   * Perform a SELECT on the query result.
   *
   * By default, `.insert()`, `.update()`, `.upsert()`, and `.delete()` do not
   * return modified rows. By calling this method, modified rows are returned in
   * `data`.
   *
   * @param columns - The columns to retrieve, separated by commas
   */
  select<Query extends string = '*', NewResultOne = GetResult<Schema, Row, Relationships, Query>>(
    columns?: Query
  ): PostgrestTransformBuilder<Schema, Row, NewResultOne[], Relationships> {
    // Remove whitespaces except when quoted
    let quoted = false
    const cleanedColumns = (columns ?? '*')
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
    if (this.headers['Prefer']) {
      this.headers['Prefer'] += ','
    }
    this.headers['Prefer'] += 'return=representation'
    return this as unknown as PostgrestTransformBuilder<Schema, Row, NewResultOne[], Relationships>
  }

  order<ColumnName extends string & keyof Row>(
    column: ColumnName,
    options?: { ascending?: boolean; nullsFirst?: boolean; foreignTable?: undefined }
  ): this
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean; foreignTable: string }
  ): this
  /**
   * Order the query result by `column`.
   *
   * You can call this method multiple times to order by multiple columns.
   *
   * You can order foreign tables, but it doesn't affect the ordering of the
   * current table.
   *
   * @param column - The column to order by
   * @param options - Named parameters
   * @param options.ascending - If `true`, the result will be in ascending order
   * @param options.nullsFirst - If `true`, `null`s appear first. If `false`,
   * `null`s appear last.
   * @param options.foreignTable - Set this to order a foreign table by foreign
   * columns
   */
  order(
    column: string,
    {
      ascending = true,
      nullsFirst,
      foreignTable,
    }: { ascending?: boolean; nullsFirst?: boolean; foreignTable?: string } = {}
  ): this {
    const key = foreignTable ? `${foreignTable}.order` : 'order'
    const existingOrder = this.url.searchParams.get(key)

    this.url.searchParams.set(
      key,
      `${existingOrder ? `${existingOrder},` : ''}${column}.${ascending ? 'asc' : 'desc'}${
        nullsFirst === undefined ? '' : nullsFirst ? '.nullsfirst' : '.nullslast'
      }`
    )
    return this
  }

  /**
   * Limit the query result by `count`.
   *
   * @param count - The maximum number of rows to return
   * @param options - Named parameters
   * @param options.foreignTable - Set this to limit rows of foreign tables
   * instead of the current table
   */
  limit(count: number, { foreignTable }: { foreignTable?: string } = {}): this {
    const key = typeof foreignTable === 'undefined' ? 'limit' : `${foreignTable}.limit`
    this.url.searchParams.set(key, `${count}`)
    return this
  }

  /**
   * Limit the query result by `from` and `to` inclusively.
   *
   * @param from - The starting index from which to limit the result
   * @param to - The last index to which to limit the result
   * @param options - Named parameters
   * @param options.foreignTable - Set this to limit rows of foreign tables
   * instead of the current table
   */
  range(from: number, to: number, { foreignTable }: { foreignTable?: string } = {}): this {
    const keyOffset = typeof foreignTable === 'undefined' ? 'offset' : `${foreignTable}.offset`
    const keyLimit = typeof foreignTable === 'undefined' ? 'limit' : `${foreignTable}.limit`
    this.url.searchParams.set(keyOffset, `${from}`)
    // Range is inclusive, so add 1
    this.url.searchParams.set(keyLimit, `${to - from + 1}`)
    return this
  }

  /**
   * Set the AbortSignal for the fetch request.
   *
   * @param signal - The AbortSignal to use for the fetch request
   */
  abortSignal(signal: AbortSignal): this {
    this.signal = signal
    return this
  }

  /**
   * Return `data` as a single object instead of an array of objects.
   *
   * Query result must be one row (e.g. using `.limit(1)`), otherwise this
   * returns an error.
   */
  single<
    ResultOne = Result extends (infer ResultOne)[] ? ResultOne : never
  >(): PostgrestBuilder<ResultOne> {
    this.headers['Accept'] = 'application/vnd.pgrst.object+json'
    return this as PostgrestBuilder<ResultOne>
  }

  /**
   * Return `data` as a single object instead of an array of objects.
   *
   * Query result must be zero or one row (e.g. using `.limit(1)`), otherwise
   * this returns an error.
   */
  maybeSingle<
    ResultOne = Result extends (infer ResultOne)[] ? ResultOne : never
  >(): PostgrestBuilder<ResultOne | null> {
    // Temporary partial fix for https://github.com/supabase/postgrest-js/issues/361
    // Issue persists e.g. for `.insert([...]).select().maybeSingle()`
    if (this.method === 'GET') {
      this.headers['Accept'] = 'application/json'
    } else {
      this.headers['Accept'] = 'application/vnd.pgrst.object+json'
    }
    this.isMaybeSingle = true
    return this as PostgrestBuilder<ResultOne | null>
  }

  /**
   * Return `data` as a string in CSV format.
   */
  csv(): PostgrestBuilder<string> {
    this.headers['Accept'] = 'text/csv'
    return this as PostgrestBuilder<string>
  }

  /**
   * Return `data` as an object in [GeoJSON](https://geojson.org) format.
   */
  geojson(): PostgrestBuilder<Record<string, unknown>> {
    this.headers['Accept'] = 'application/geo+json'
    return this as PostgrestBuilder<Record<string, unknown>>
  }

  /**
   * Return `data` as the EXPLAIN plan for the query.
   *
   * @param options - Named parameters
   *
   * @param options.analyze - If `true`, the query will be executed and the
   * actual run time will be returned
   *
   * @param options.verbose - If `true`, the query identifier will be returned
   * and `data` will include the output columns of the query
   *
   * @param options.settings - If `true`, include information on configuration
   * parameters that affect query planning
   *
   * @param options.buffers - If `true`, include information on buffer usage
   *
   * @param options.wal - If `true`, include information on WAL record generation
   *
   * @param options.format - The format of the output, can be `"text"` (default)
   * or `"json"`
   */
  explain({
    analyze = false,
    verbose = false,
    settings = false,
    buffers = false,
    wal = false,
    format = 'text',
  }: {
    analyze?: boolean
    verbose?: boolean
    settings?: boolean
    buffers?: boolean
    wal?: boolean
    format?: 'json' | 'text'
  } = {}): PostgrestBuilder<Record<string, unknown>[]> | PostgrestBuilder<string> {
    const options = [
      analyze ? 'analyze' : null,
      verbose ? 'verbose' : null,
      settings ? 'settings' : null,
      buffers ? 'buffers' : null,
      wal ? 'wal' : null,
    ]
      .filter(Boolean)
      .join('|')
    // An Accept header can carry multiple media types but postgrest-js always sends one
    const forMediatype = this.headers['Accept']
    this.headers[
      'Accept'
    ] = `application/vnd.pgrst.plan+${format}; for="${forMediatype}"; options=${options};`
    if (format === 'json') return this as PostgrestBuilder<Record<string, unknown>[]>
    else return this as PostgrestBuilder<string>
  }

  /**
   * Rollback the query.
   *
   * `data` will still be returned, but the query is not committed.
   */
  rollback(): this {
    if ((this.headers['Prefer'] ?? '').trim().length > 0) {
      this.headers['Prefer'] += ',tx=rollback'
    } else {
      this.headers['Prefer'] = 'tx=rollback'
    }
    return this
  }

  /**
   * Override the type of the returned `data`.
   *
   * @typeParam NewResult - The new result type to override with
   */
  returns<NewResult>(): PostgrestTransformBuilder<Schema, Row, NewResult, Relationships> {
    return this as unknown as PostgrestTransformBuilder<Schema, Row, NewResult, Relationships>
  }
}
