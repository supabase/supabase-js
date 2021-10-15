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
  | 'not.eq'
  | 'not.neq'
  | 'not.gt'
  | 'not.gte'
  | 'not.lt'
  | 'not.lte'
  | 'not.like'
  | 'not.ilike'
  | 'not.is'
  | 'not.in'
  | 'not.cs'
  | 'not.cd'
  | 'not.sl'
  | 'not.sr'
  | 'not.nxl'
  | 'not.nxr'
  | 'not.adj'
  | 'not.ov'
  | 'not.fts'
  | 'not.plfts'
  | 'not.phfts'
  | 'not.wfts'

export default class PostgrestFilterBuilder<T> extends PostgrestTransformBuilder<T> {
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
   * @param foreignTable  The foreign table to use (if `column` is a foreign column).
   */
  or(filters: string, { foreignTable }: { foreignTable?: string } = {}): this {
    const key = typeof foreignTable === 'undefined' ? 'or' : `${foreignTable}.or`
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
    const cleanedValues = values
      .map((s) => {
        // handle postgrest reserved characters
        // https://postgrest.org/en/v7.0.0/api.html#reserved-characters
        if (typeof s === 'string' && new RegExp('[,()]').test(s)) return `"${s}"`
        else return `${s}`
      })
      .join(',')
    this.url.searchParams.append(`${column}`, `in.(${cleanedValues})`)
    return this
  }

  /**
   * Finds all rows whose json, array, or range value on the stated `column`
   * contains the values specified in `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  contains(column: keyof T, value: string | T[keyof T][] | object): this {
    if (typeof value === 'string') {
      // range types can be inclusive '[', ']' or exclusive '(', ')' so just
      // keep it simple and accept a string
      this.url.searchParams.append(`${column}`, `cs.${value}`)
    } else if (Array.isArray(value)) {
      // array
      this.url.searchParams.append(`${column}`, `cs.{${value.join(',')}}`)
    } else {
      // json
      this.url.searchParams.append(`${column}`, `cs.${JSON.stringify(value)}`)
    }
    return this
  }

  /** @deprecated Use `contains()` instead. */
  cs = this.contains

  /**
   * Finds all rows whose json, array, or range value on the stated `column` is
   * contained by the specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  containedBy(column: keyof T, value: string | T[keyof T][] | object): this {
    if (typeof value === 'string') {
      // range
      this.url.searchParams.append(`${column}`, `cd.${value}`)
    } else if (Array.isArray(value)) {
      // array
      this.url.searchParams.append(`${column}`, `cd.{${value.join(',')}}`)
    } else {
      // json
      this.url.searchParams.append(`${column}`, `cd.${JSON.stringify(value)}`)
    }
    return this
  }

  /** @deprecated Use `containedBy()` instead. */
  cd = this.containedBy

  /**
   * Finds all rows whose range value on the stated `column` is strictly to the
   * left of the specified `range`.
   *
   * @param column  The column to filter on.
   * @param range  The range to filter with.
   */
  rangeLt(column: keyof T, range: string): this {
    this.url.searchParams.append(`${column}`, `sl.${range}`)
    return this
  }

  /** @deprecated Use `rangeLt()` instead. */
  sl = this.rangeLt

  /**
   * Finds all rows whose range value on the stated `column` is strictly to
   * the right of the specified `range`.
   *
   * @param column  The column to filter on.
   * @param range  The range to filter with.
   */
  rangeGt(column: keyof T, range: string): this {
    this.url.searchParams.append(`${column}`, `sr.${range}`)
    return this
  }

  /** @deprecated Use `rangeGt()` instead. */
  sr = this.rangeGt

  /**
   * Finds all rows whose range value on the stated `column` does not extend
   * to the left of the specified `range`.
   *
   * @param column  The column to filter on.
   * @param range  The range to filter with.
   */
  rangeGte(column: keyof T, range: string): this {
    this.url.searchParams.append(`${column}`, `nxl.${range}`)
    return this
  }

  /** @deprecated Use `rangeGte()` instead. */
  nxl = this.rangeGte

  /**
   * Finds all rows whose range value on the stated `column` does not extend
   * to the right of the specified `range`.
   *
   * @param column  The column to filter on.
   * @param range  The range to filter with.
   */
  rangeLte(column: keyof T, range: string): this {
    this.url.searchParams.append(`${column}`, `nxr.${range}`)
    return this
  }

  /** @deprecated Use `rangeLte()` instead. */
  nxr = this.rangeLte

  /**
   * Finds all rows whose range value on the stated `column` is adjacent to
   * the specified `range`.
   *
   * @param column  The column to filter on.
   * @param range  The range to filter with.
   */
  rangeAdjacent(column: keyof T, range: string): this {
    this.url.searchParams.append(`${column}`, `adj.${range}`)
    return this
  }

  /** @deprecated Use `rangeAdjacent()` instead. */
  adj = this.rangeAdjacent

  /**
   * Finds all rows whose array or range value on the stated `column` overlaps
   * (has a value in common) with the specified `value`.
   *
   * @param column  The column to filter on.
   * @param value  The value to filter with.
   */
  overlaps(column: keyof T, value: string | T[keyof T][]): this {
    if (typeof value === 'string') {
      // range
      this.url.searchParams.append(`${column}`, `ov.${value}`)
    } else {
      // array
      this.url.searchParams.append(`${column}`, `ov.{${value.join(',')}}`)
    }
    return this
  }

  /** @deprecated Use `overlaps()` instead. */
  ov = this.overlaps

  /**
   * Finds all rows whose text or tsvector value on the stated `column` matches
   * the tsquery in `query`.
   *
   * @param column  The column to filter on.
   * @param query  The Postgres tsquery string to filter with.
   * @param config  The text search configuration to use.
   * @param type  The type of tsquery conversion to use on `query`.
   */
  textSearch(
    column: keyof T,
    query: string,
    {
      config,
      type = null,
    }: { config?: string; type?: 'plain' | 'phrase' | 'websearch' | null } = {}
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
    this.url.searchParams.append(`${column}`, `${typePart}fts${configPart}.${query}`)
    return this
  }

  /**
   * Finds all rows whose tsvector value on the stated `column` matches
   * to_tsquery(`query`).
   *
   * @param column  The column to filter on.
   * @param query  The Postgres tsquery string to filter with.
   * @param config  The text search configuration to use.
   *
   * @deprecated Use `textSearch()` instead.
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
   *
   * @deprecated Use `textSearch()` with `type: 'plain'` instead.
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
   *
   * @deprecated Use `textSearch()` with `type: 'phrase'` instead.
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
   *
   * @deprecated Use `textSearch()` with `type: 'websearch'` instead.
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
  match(query: Record<string, unknown>): this {
    Object.keys(query).forEach((key) => {
      this.url.searchParams.append(`${key}`, `eq.${query[key]}`)
    })
    return this
  }
}
