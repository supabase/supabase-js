import PostgrestBuilder from './PostgrestBuilder'
import PostgrestFilterBuilder from './PostgrestFilterBuilder'
import { Fetch } from './types'

export default class PostgrestQueryBuilder<T> extends PostgrestBuilder<T> {
  constructor(
    url: string,
    {
      headers = {},
      schema,
      fetch,
      shouldThrowOnError,
    }: {
      headers?: Record<string, string>
      schema?: string
      fetch?: Fetch
      shouldThrowOnError: boolean
    }
  ) {
    super({
      method: 'GET',
      url: new URL(url),
      headers,
      schema,
      fetch,
      shouldThrowOnError,
      allowEmpty: false,
    } as unknown as PostgrestBuilder<T>)
  }

  /**
   * Performs vertical filtering with SELECT.
   *
   * @param columns  The columns to retrieve, separated by commas.
   * @param head  When set to true, select will void data.
   * @param count  Count algorithm to use to count rows in a table.
   */
  select(
    columns = '*',
    {
      head = false,
      count = null,
    }: {
      head?: boolean
      count?: null | 'exact' | 'planned' | 'estimated'
    } = {}
  ): PostgrestFilterBuilder<T> {
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
    if (count) {
      this.headers['Prefer'] = `count=${count}`
    }
    if (head) {
      this.method = 'HEAD'
    }
    return new PostgrestFilterBuilder(this)
  }

  /**
   * Performs an INSERT into the table.
   *
   * @param values  The values to insert.
   * @param count  Count algorithm to use to count rows in a table.
   */
  insert(
    values: Partial<T> | Partial<T>[],
    {
      count = null,
    }: {
      count?: null | 'exact' | 'planned' | 'estimated'
    } = {}
  ): PostgrestFilterBuilder<T> {
    this.method = 'POST'

    const prefersHeaders = []
    this.body = values
    if (count) {
      prefersHeaders.push(`count=${count}`)
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

    return new PostgrestFilterBuilder(this)
  }

  /**
   * Performs an UPSERT into the table.
   *
   * @param values  The values to insert.
   * @param count  Count algorithm to use to count rows in a table.
   * @param options  Named parameters.
   * @param options.onConflict  By specifying the `on_conflict` query parameter, you can make UPSERT work on a column(s) that has a UNIQUE constraint.
   * @param options.ignoreDuplicates  Specifies if duplicate rows should be ignored and not inserted.
   */
  upsert(
    values: Partial<T> | Partial<T>[],
    {
      onConflict,
      count = null,
      ignoreDuplicates = false,
    }: {
      onConflict?: string
      count?: null | 'exact' | 'planned' | 'estimated'
      ignoreDuplicates?: boolean
    } = {}
  ): PostgrestFilterBuilder<T> {
    this.method = 'POST'

    const prefersHeaders = [`resolution=${ignoreDuplicates ? 'ignore' : 'merge'}-duplicates`]

    if (onConflict !== undefined) this.url.searchParams.set('on_conflict', onConflict)
    this.body = values
    if (count) {
      prefersHeaders.push(`count=${count}`)
    }
    if (this.headers['Prefer']) {
      prefersHeaders.unshift(this.headers['Prefer'])
    }
    this.headers['Prefer'] = prefersHeaders.join(',')

    return new PostgrestFilterBuilder(this)
  }

  /**
   * Performs an UPDATE on the table.
   *
   * @param values  The values to update.
   * @param count  Count algorithm to use to count rows in a table.
   */
  update(
    values: Partial<T>,
    {
      count = null,
    }: {
      count?: null | 'exact' | 'planned' | 'estimated'
    } = {}
  ): PostgrestFilterBuilder<T> {
    this.method = 'PATCH'
    const prefersHeaders = []
    this.body = values
    if (count) {
      prefersHeaders.push(`count=${count}`)
    }
    if (this.headers['Prefer']) {
      prefersHeaders.unshift(this.headers['Prefer'])
    }
    this.headers['Prefer'] = prefersHeaders.join(',')
    return new PostgrestFilterBuilder(this)
  }

  /**
   * Performs a DELETE on the table.
   *
   * @param count  Count algorithm to use to count rows in a table.
   */
  delete({
    count = null,
  }: {
    count?: null | 'exact' | 'planned' | 'estimated'
  } = {}): PostgrestFilterBuilder<T> {
    this.method = 'DELETE'
    const prefersHeaders = []
    if (count) {
      prefersHeaders.push(`count=${count}`)
    }
    if (this.headers['Prefer']) {
      prefersHeaders.unshift(this.headers['Prefer'])
    }
    this.headers['Prefer'] = prefersHeaders.join(',')
    return new PostgrestFilterBuilder(this)
  }
}
