import PostgrestTransformBuilder from './PostgrestTransformBuilder'

/**
 * Filters
 */

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

export default class PostgrestFilterBuilder<
  Row extends Record<string, unknown>,
  Result
> extends PostgrestTransformBuilder<Row, Result> {
  /**
   * Finds all rows which doesn't satisfy the filter.
   *
   * @param column  The column to filter on.
   * @param operator  The operator to filter with.
   * @param value  The value to filter with.
   */
  not<ColumnName extends string & keyof Row>(
    column: ColumnName,
    operator: FilterOperator,
    value: Row[ColumnName]
  ): this
  not(column: string, operator: string, value: unknown): this
  not(column: string, operator: string, value: unknown): this {
    this.url.searchParams.append(column, `not.${operator}.${value}`)
    return this
  }

  /**
   * Finds all rows satisfying at least one of the filters.
   *
   * @param filters  The filters to use, separated by commas.
   * @param foreignTable  The foreign table to use (if `column` is a foreign column).
   */
  or(filters: string, { foreignTable }: { foreignTable?: string } = {}): this {
    const key = foreignTable ? `${foreignTable}.or` : 'or'
    this.url.searchParams.append(key, `(${filters})`)
    return this
  }

  /**
   * Finds all rows whose value on the stated `column` exactly matches the
   * specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  eq<ColumnName extends string & keyof Row>(column: ColumnName, value: Row[ColumnName]): this
  eq(column: string, value: unknown): this
  eq(column: string, value: unknown): this {
    this.url.searchParams.append(column, `eq.${value}`)
    return this
  }

  /**
   * Finds all rows whose value on the stated `column` doesn't match the
   * specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  neq<ColumnName extends string & keyof Row>(column: ColumnName, value: Row[ColumnName]): this
  neq(column: string, value: unknown): this
  neq(column: string, value: unknown): this {
    this.url.searchParams.append(column, `neq.${value}`)
    return this
  }

  /**
   * Finds all rows whose value on the stated `column` is greater than the
   * specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  gt<ColumnName extends string & keyof Row>(column: ColumnName, value: Row[ColumnName]): this
  gt(column: string, value: unknown): this
  gt(column: string, value: unknown): this {
    this.url.searchParams.append(column, `gt.${value}`)
    return this
  }

  /**
   * Finds all rows whose value on the stated `column` is greater than or
   * equal to the specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  gte<ColumnName extends string & keyof Row>(column: ColumnName, value: Row[ColumnName]): this
  gte(column: string, value: unknown): this
  gte(column: string, value: unknown): this {
    this.url.searchParams.append(column, `gte.${value}`)
    return this
  }

  /**
   * Finds all rows whose value on the stated `column` is less than the
   * specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  lt<ColumnName extends string & keyof Row>(column: ColumnName, value: Row[ColumnName]): this
  lt(column: string, value: unknown): this
  lt(column: string, value: unknown): this {
    this.url.searchParams.append(column, `lt.${value}`)
    return this
  }

  /**
   * Finds all rows whose value on the stated `column` is less than or equal
   * to the specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  lte<ColumnName extends string & keyof Row>(column: ColumnName, value: Row[ColumnName]): this
  lte(column: string, value: unknown): this
  lte(column: string, value: unknown): this {
    this.url.searchParams.append(column, `lte.${value}`)
    return this
  }

  /**
   * Finds all rows whose value in the stated `column` matches the supplied
   * `pattern` (case sensitive).
   *
   * @param column  The column to filter on.
   * @param pattern  The pattern to filter with.
   */
  like<ColumnName extends string & keyof Row>(column: ColumnName, pattern: string): this
  like(column: string, pattern: string): this
  like(column: string, pattern: string): this {
    this.url.searchParams.append(column, `like.${pattern}`)
    return this
  }

  /**
   * Finds all rows whose value in the stated `column` matches the supplied
   * `pattern` (case insensitive).
   *
   * @param column  The column to filter on.
   * @param pattern  The pattern to filter with.
   */
  ilike<ColumnName extends string & keyof Row>(column: ColumnName, pattern: string): this
  ilike(column: string, pattern: string): this
  ilike(column: string, pattern: string): this {
    this.url.searchParams.append(column, `ilike.${pattern}`)
    return this
  }

  /**
   * A check for exact equality (null, true, false), finds all rows whose
   * value on the stated `column` exactly match the specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  is<ColumnName extends string & keyof Row>(
    column: ColumnName,
    value: Row[ColumnName] & (boolean | null)
  ): this
  is(column: string, value: boolean | null): this
  is(column: string, value: boolean | null): this {
    this.url.searchParams.append(column, `is.${value}`)
    return this
  }

  /**
   * Finds all rows whose value on the stated `column` is found on the
   * specified `values`.
   *
   * @param column  The column to filter on.
   * @param values  The values to filter with.
   */
  in<ColumnName extends string & keyof Row>(column: ColumnName, values: Row[ColumnName][]): this
  in(column: string, values: unknown[]): this
  in(column: string, values: unknown[]): this {
    const cleanedValues = values
      .map((s) => {
        // handle postgrest reserved characters
        // https://postgrest.org/en/v7.0.0/api.html#reserved-characters
        if (typeof s === 'string' && new RegExp('[,()]').test(s)) return `"${s}"`
        else return `${s}`
      })
      .join(',')
    this.url.searchParams.append(column, `in.(${cleanedValues})`)
    return this
  }

  /**
   * Finds all rows whose json, array, or range value on the stated `column`
   * contains the values specified in `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  contains<ColumnName extends string & keyof Row>(
    column: ColumnName,
    value: string | Row[ColumnName][] | Record<string, unknown>
  ): this
  contains(column: string, value: string | unknown[] | Record<string, unknown>): this
  contains(column: string, value: string | unknown[] | Record<string, unknown>): this {
    if (typeof value === 'string') {
      // range types can be inclusive '[', ']' or exclusive '(', ')' so just
      // keep it simple and accept a string
      this.url.searchParams.append(column, `cs.${value}`)
    } else if (Array.isArray(value)) {
      // array
      this.url.searchParams.append(column, `cs.{${value.join(',')}}`)
    } else {
      // json
      this.url.searchParams.append(column, `cs.${JSON.stringify(value)}`)
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
  containedBy<ColumnName extends string & keyof Row>(
    column: ColumnName,
    value: string | Row[ColumnName][] | Record<string, unknown>
  ): this
  containedBy(column: string, value: string | unknown[] | Record<string, unknown>): this
  containedBy(column: string, value: string | unknown[] | Record<string, unknown>): this {
    if (typeof value === 'string') {
      // range
      this.url.searchParams.append(column, `cd.${value}`)
    } else if (Array.isArray(value)) {
      // array
      this.url.searchParams.append(column, `cd.{${value.join(',')}}`)
    } else {
      // json
      this.url.searchParams.append(column, `cd.${JSON.stringify(value)}`)
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
  rangeLt<ColumnName extends string & keyof Row>(column: ColumnName, range: string): this
  rangeLt(column: string, range: string): this
  rangeLt(column: string, range: string): this {
    this.url.searchParams.append(column, `sl.${range}`)
    return this
  }

  /**
   * Finds all rows whose range value on the stated `column` is strictly to
   * the right of the specified `range`.
   *
   * @param column  The column to filter on.
   * @param range  The range to filter with.
   */
  rangeGt<ColumnName extends string & keyof Row>(column: ColumnName, range: string): this
  rangeGt(column: string, range: string): this
  rangeGt(column: string, range: string): this {
    this.url.searchParams.append(column, `sr.${range}`)
    return this
  }

  /**
   * Finds all rows whose range value on the stated `column` does not extend
   * to the left of the specified `range`.
   *
   * @param column  The column to filter on.
   * @param range  The range to filter with.
   */
  rangeGte<ColumnName extends string & keyof Row>(column: ColumnName, range: string): this
  rangeGte(column: string, range: string): this
  rangeGte(column: string, range: string): this {
    this.url.searchParams.append(column, `nxl.${range}`)
    return this
  }

  /**
   * Finds all rows whose range value on the stated `column` does not extend
   * to the right of the specified `range`.
   *
   * @param column  The column to filter on.
   * @param range  The range to filter with.
   */
  rangeLte<ColumnName extends string & keyof Row>(column: ColumnName, range: string): this
  rangeLte(column: string, range: string): this
  rangeLte(column: string, range: string): this {
    this.url.searchParams.append(column, `nxr.${range}`)
    return this
  }

  /**
   * Finds all rows whose range value on the stated `column` is adjacent to
   * the specified `range`.
   *
   * @param column  The column to filter on.
   * @param range  The range to filter with.
   */
  rangeAdjacent<ColumnName extends string & keyof Row>(column: ColumnName, range: string): this
  rangeAdjacent(column: string, range: string): this
  rangeAdjacent(column: string, range: string): this {
    this.url.searchParams.append(column, `adj.${range}`)
    return this
  }

  /**
   * Finds all rows whose array or range value on the stated `column` overlaps
   * (has a value in common) with the specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  overlaps<ColumnName extends string & keyof Row>(
    column: ColumnName,
    value: string | Row[ColumnName][]
  ): this
  overlaps(column: string, value: string | unknown[]): this
  overlaps(column: string, value: string | unknown[]): this {
    if (typeof value === 'string') {
      // range
      this.url.searchParams.append(column, `ov.${value}`)
    } else {
      // array
      this.url.searchParams.append(column, `ov.{${value.join(',')}}`)
    }
    return this
  }

  /**
   * Finds all rows whose text or tsvector value on the stated `column` matches
   * the tsquery in `query`.
   *
   * @param column  The column to filter on.
   * @param query  The Postgres tsquery string to filter with.
   * @param config  The text search configuration to use.
   * @param type  The type of tsquery conversion to use on `query`.
   */
  textSearch<ColumnName extends string & keyof Row>(
    column: ColumnName,
    query: string,
    options?: { config?: string; type?: 'plain' | 'phrase' | 'websearch' }
  ): this
  textSearch(
    column: string,
    query: string,
    options?: { config?: string; type?: 'plain' | 'phrase' | 'websearch' }
  ): this
  textSearch(
    column: string,
    query: string,
    { config, type }: { config?: string; type?: 'plain' | 'phrase' | 'websearch' } = {}
  ): this {
    let typePart = ''
    if (type === 'plain') {
      typePart = 'pl'
    } else if (type === 'phrase') {
      typePart = 'ph'
    } else if (type === 'websearch') {
      typePart = 'w'
    }
    const configPart = config === undefined ? '' : `(${config})`
    this.url.searchParams.append(column, `${typePart}fts${configPart}.${query}`)
    return this
  }

  /**
   * Finds all rows whose `column` satisfies the filter.
   *
   * @param column  The column to filter on.
   * @param operator  The operator to filter with.
   * @param value  The value to filter with.
   */
  filter<ColumnName extends string & keyof Row>(
    column: ColumnName,
    operator: `${'' | 'not.'}${FilterOperator}`,
    value: unknown
  ): this
  filter(column: string, operator: string, value: unknown): this
  filter(column: string, operator: string, value: unknown): this {
    this.url.searchParams.append(column, `${operator}.${value}`)
    return this
  }

  /**
   * Finds all rows whose columns match the specified `query` object.
   *
   * @param query  The object to filter with, with column names as keys mapped
   *               to their filter values.
   */
  match<ColumnName extends string & keyof Row>(query: Record<ColumnName, Row[ColumnName]>): this
  match(query: Record<string, unknown>): this
  match(query: Record<string, unknown>): this {
    Object.entries(query).forEach(([column, value]) => {
      this.url.searchParams.append(column, `eq.${value}`)
    })
    return this
  }
}
