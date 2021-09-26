import { PostgrestBuilder, PostgrestMaybeSingleResponse, PostgrestSingleResponse } from './types'

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
    const _this = new PostgrestTransformBuilder(this)
    _this.then = ((onfulfilled: any, onrejected: any) =>
      this.then((res: any): any => {
        if (res.error?.details?.includes('Results contain 0 rows')) {
          return onfulfilled({
            error: null,
            data: null,
            count: res.count,
            status: 200,
            statusText: 'OK',
            body: null,
          })
        }

        return onfulfilled(res)
      }, onrejected)) as any
    return _this as PromiseLike<PostgrestMaybeSingleResponse<T>>
  }

  /**
   * Set the response type to CSV.
   */
  csv(): PromiseLike<PostgrestSingleResponse<string>> {
    this.headers['Accept'] = 'text/csv'
    return this as PromiseLike<PostgrestSingleResponse<string>>
  }
}
