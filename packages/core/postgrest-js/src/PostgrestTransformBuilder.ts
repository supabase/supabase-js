import PostgrestBuilder from './PostgrestBuilder'
import { PostgrestMaybeSingleResponse, PostgrestResponse, PostgrestSingleResponse } from './types'

/**
 * Post-filters (transforms)
 */

export default class PostgrestTransformBuilder<T> extends PostgrestBuilder<T> {
  /**
   * Performs vertical filtering with SELECT.
   *
   * @param columns  The columns to retrieve, separated by commas.
   */
  select(columns = '*'): this {
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
    return this
  }

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
  ): this {
    const key = typeof foreignTable === 'undefined' ? 'order' : `${foreignTable}.order`
    const existingOrder = this.url.searchParams.get(key)

    this.url.searchParams.set(
      key,
      `${existingOrder ? `${existingOrder},` : ''}${column}.${ascending ? 'asc' : 'desc'}.${
        nullsFirst ? 'nullsfirst' : 'nullslast'
      }`
    )
    return this
  }

  /**
   * Limits the result with the specified `count`.
   *
   * @param count  The maximum no. of rows to limit to.
   * @param foreignTable  The foreign table to use (for foreign columns).
   */
  limit(count: number, { foreignTable }: { foreignTable?: string } = {}): this {
    const key = typeof foreignTable === 'undefined' ? 'limit' : `${foreignTable}.limit`
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
  range(from: number, to: number, { foreignTable }: { foreignTable?: string } = {}): this {
    const keyOffset = typeof foreignTable === 'undefined' ? 'offset' : `${foreignTable}.offset`
    const keyLimit = typeof foreignTable === 'undefined' ? 'limit' : `${foreignTable}.limit`
    this.url.searchParams.set(keyOffset, `${from}`)
    // Range is inclusive, so add 1
    this.url.searchParams.set(keyLimit, `${to - from + 1}`)
    return this
  }

  /**
   * Sets the AbortSignal for the fetch request.
   */
  abortSignal(signal: AbortSignal): this {
    this.signal = signal
    return this
  }

  /**
   * Retrieves only one row from the result. Result must be one row (e.g. using
   * `limit`), otherwise this will result in an error.
   */
  single(): PromiseLike<PostgrestSingleResponse<T>> {
    this.headers['Accept'] = 'application/vnd.pgrst.object+json'
    return this as PromiseLike<PostgrestSingleResponse<T>>
  }

  /**
   * Retrieves at most one row from the result. Result must be at most one row
   * (e.g. using `eq` on a UNIQUE column), otherwise this will result in an
   * error.
   */
  maybeSingle(): PromiseLike<PostgrestMaybeSingleResponse<T>> {
    this.headers['Accept'] = 'application/vnd.pgrst.object+json'
    this.allowEmpty = true
    return this as PromiseLike<PostgrestMaybeSingleResponse<T>>
  }

  /**
   * Set the response type to CSV.
   */
  csv(): PromiseLike<PostgrestSingleResponse<string>> {
    this.headers['Accept'] = 'text/csv'
    return this as PromiseLike<PostgrestSingleResponse<string>>
  }

  /**
   * Set the response type to GeoJSON.
   */
  geojson(): PromiseLike<PostgrestSingleResponse<Record<string, unknown>>> {
    this.headers['Accept'] = 'application/geo+json'
    return this as PromiseLike<PostgrestSingleResponse<Record<string, unknown>>>
  }

  /**
   * Obtains the EXPLAIN plan for this request.
   *
   * @param analyze  If `true`, the query will be executed and the actual run time will be displayed.
   * @param verbose  If `true`, the query identifier will be displayed and the result will include the output columns of the query.
   * @param settings  If `true`, include information on configuration parameters that affect query planning.
   * @param buffers  If `true`, include information on buffer usage.
   * @param wal     If `true`, include information on WAL record generation
   */
  explain({
    analyze = false,
    verbose = false,
    settings = false,
    buffers = false,
    wal = false,
  }: {
    analyze?: boolean
    verbose?: boolean
    settings?: boolean
    buffers?: boolean
    wal?: boolean
  } = {}): PromiseLike<PostgrestResponse<Record<string, unknown>>> {
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
    ] = `application/vnd.pgrst.plan+json; for="${forMediatype}"; options=${options};`
    return this as PromiseLike<PostgrestResponse<Record<string, unknown>>>
  }
}
