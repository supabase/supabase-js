import { Fetch, PostgrestBuilder } from './types'
import PostgrestFilterBuilder from './PostgrestFilterBuilder'

export default class PostgrestRpcBuilder<T> extends PostgrestBuilder<T> {
  constructor(
    url: string,
    {
      headers = {},
      schema,
      fetch,
    }: { headers?: { [key: string]: string }; schema?: string; fetch?: Fetch } = {}
  ) {
    super(({ fetch } as unknown) as PostgrestBuilder<T>)
    this.url = new URL(url)
    this.headers = { ...headers }
    this.schema = schema
  }

  /**
   * Perform a function call.
   */
  rpc(
    params?: object,
    {
      head = false,
      count = null,
    }: {
      head?: boolean
      count?: null | 'exact' | 'planned' | 'estimated'
    } = {}
  ): PostgrestFilterBuilder<T> {
    if (head) {
      this.method = 'HEAD'

      if (params) {
        Object.entries(params).forEach(([name, value]) => {
          this.url.searchParams.append(name, value)
        })
      }
    } else {
      this.method = 'POST'
      this.body = params
    }

    if (count) {
      if (this.headers['Prefer'] !== undefined) this.headers['Prefer'] += `,count=${count}`
      else this.headers['Prefer'] = `count=${count}`
    }

    return new PostgrestFilterBuilder(this)
  }
}
