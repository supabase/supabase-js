import PostgrestBuilder from './PostgrestBuilder'
import PostgrestFilterBuilder from './PostgrestFilterBuilder'
import { GetResult } from './select-query-parser'
import { Fetch, GenericTable } from './types'

export default class PostgrestQueryBuilder<Table extends GenericTable> {
  url: URL
  headers: Record<string, string>
  schema?: string
  signal?: AbortSignal
  fetch?: Fetch

  constructor(
    url: URL,
    {
      headers = {},
      schema,
      fetch,
    }: {
      headers?: Record<string, string>
      schema?: string
      fetch?: Fetch
    }
  ) {
    this.url = url
    this.headers = headers
    this.schema = schema
    this.fetch = fetch
  }

  /**
   * Performs vertical filtering with SELECT.
   *
   * @param columns  The columns to retrieve, separated by commas.
   * @param head  When set to true, select will void data.
   * @param count  Count algorithm to use to count rows in a table.
   */
  select<
    Query extends string = '*',
    Result = GetResult<Table['Row'], Query extends '*' ? '*' : Query>
  >(
    columns?: Query,
    {
      head = false,
      count,
    }: {
      head?: boolean
      count?: 'exact' | 'planned' | 'estimated'
    } = {}
  ): PostgrestFilterBuilder<Table['Row'], Result> {
    const method = head ? 'HEAD' : 'GET'
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
    if (count) {
      this.headers['Prefer'] = `count=${count}`
    }

    return new PostgrestFilterBuilder({
      method,
      url: this.url,
      headers: this.headers,
      schema: this.schema,
      fetch: this.fetch,
      allowEmpty: false,
    } as unknown as PostgrestBuilder<Result>)
  }

  /**
   * Performs an INSERT into the table.
   *
   * @param values    The values to insert.
   * @param count     Count algorithm to use to count rows in a table.
   * @param rollback  Rollback the operation
   */
  insert<Row extends Table['Insert']>(
    values: Row | Row[],
    {
      count,
      rollback = false,
    }: {
      count?: 'exact' | 'planned' | 'estimated'
      rollback?: boolean
    } = {}
  ): PostgrestFilterBuilder<Table['Row'], undefined> {
    const method = 'POST'

    const prefersHeaders = []
    const body = values
    if (count) {
      prefersHeaders.push(`count=${count}`)
    }
    if (rollback) {
      prefersHeaders.push(`tx=rollback`)
    }
    if (this.headers['Prefer']) {
      prefersHeaders.unshift(this.headers['Prefer'])
    }
    this.headers['Prefer'] = prefersHeaders.join(',')

    if (Array.isArray(values)) {
      const columns = values.reduce((acc, x) => acc.concat(Object.keys(x)), [] as string[])
      if (columns.length > 0) {
        const uniqueColumns = [...new Set(columns)].map((column) => `"${column}"`)
        this.url.searchParams.set('columns', uniqueColumns.join(','))
      }
    }

    return new PostgrestFilterBuilder({
      method,
      url: this.url,
      headers: this.headers,
      schema: this.schema,
      body,
      fetch: this.fetch,
      allowEmpty: false,
    } as unknown as PostgrestBuilder<undefined>)
  }

  /**
   * Performs an UPSERT into the table.
   *
   * @param values  The values to insert.
   * @param count  Count algorithm to use to count rows in a table.
   * @param options  Named parameters.
   * @param options.onConflict  By specifying the `on_conflict` query parameter, you can make UPSERT work on a column(s) that has a UNIQUE constraint.
   * @param options.ignoreDuplicates  Specifies if duplicate rows should be ignored and not inserted.
   * @param rollback  Rollback the operation
   */
  upsert<Row extends Table['Insert']>(
    values: Row | Row[],
    {
      onConflict,
      count,
      ignoreDuplicates = false,
      rollback = false,
    }: {
      onConflict?: string
      count?: 'exact' | 'planned' | 'estimated'
      ignoreDuplicates?: boolean
      rollback?: boolean
    } = {}
  ): PostgrestFilterBuilder<Table['Row'], undefined> {
    const method = 'POST'

    const prefersHeaders = [`resolution=${ignoreDuplicates ? 'ignore' : 'merge'}-duplicates`]

    if (onConflict !== undefined) this.url.searchParams.set('on_conflict', onConflict)
    const body = values
    if (count) {
      prefersHeaders.push(`count=${count}`)
    }
    if (rollback) {
      prefersHeaders.push(`tx=rollback`)
    }
    if (this.headers['Prefer']) {
      prefersHeaders.unshift(this.headers['Prefer'])
    }
    this.headers['Prefer'] = prefersHeaders.join(',')

    return new PostgrestFilterBuilder({
      method,
      url: this.url,
      headers: this.headers,
      schema: this.schema,
      body,
      fetch: this.fetch,
      allowEmpty: false,
    } as unknown as PostgrestBuilder<undefined>)
  }

  /**
   * Performs an UPDATE on the table.
   *
   * @param values  The values to update.
   * @param count  Count algorithm to use to count rows in a table.
   * @param rollback  Rollback the operation
   */
  update<Row extends Table['Update']>(
    values: Row,
    {
      count,
      rollback = false,
    }: {
      count?: 'exact' | 'planned' | 'estimated'
      rollback?: boolean
    } = {}
  ): PostgrestFilterBuilder<Table['Row'], undefined> {
    const method = 'PATCH'
    const prefersHeaders = []
    const body = values
    if (count) {
      prefersHeaders.push(`count=${count}`)
    }
    if (rollback) {
      prefersHeaders.push(`tx=rollback`)
    }
    if (this.headers['Prefer']) {
      prefersHeaders.unshift(this.headers['Prefer'])
    }
    this.headers['Prefer'] = prefersHeaders.join(',')

    return new PostgrestFilterBuilder({
      method,
      url: this.url,
      headers: this.headers,
      schema: this.schema,
      body,
      fetch: this.fetch,
      allowEmpty: false,
    } as unknown as PostgrestBuilder<undefined>)
  }

  /**
   * Performs a DELETE on the table.
   *
   * @param count  Count algorithm to use to count rows in a table.
   * @param rollback  Rollback the operation
   */
  delete({
    count,
    rollback = false,
  }: {
    count?: 'exact' | 'planned' | 'estimated'
    rollback?: boolean
  } = {}): PostgrestFilterBuilder<Table['Row'], undefined> {
    const method = 'DELETE'
    const prefersHeaders = []
    if (count) {
      prefersHeaders.push(`count=${count}`)
    }
    if (rollback) {
      prefersHeaders.push(`tx=rollback`)
    }
    if (this.headers['Prefer']) {
      prefersHeaders.unshift(this.headers['Prefer'])
    }
    this.headers['Prefer'] = prefersHeaders.join(',')

    return new PostgrestFilterBuilder({
      method,
      url: this.url,
      headers: this.headers,
      schema: this.schema,
      fetch: this.fetch,
      allowEmpty: false,
    } as unknown as PostgrestBuilder<undefined>)
  }
}
