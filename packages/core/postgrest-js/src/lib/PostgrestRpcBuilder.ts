import { PostgrestBuilder } from './types'
import PostgrestTransformBuilder from './PostgrestTransformBuilder'

export default class PostgrestRpcBuilder<T> extends PostgrestBuilder<T> {
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
   * Perform a stored procedure call.
   */
  rpc(
    params?: object,
    {
      count = null,
    }: {
      count?: null | 'exact' | 'planned' | 'estimated'
    } = {}
  ): PostgrestTransformBuilder<T> {
    this.method = 'POST'
    this.body = params

    if (count) {
      if (this.headers['Prefer'] !== undefined) this.headers['Prefer'] += `,count=${count}`
      else this.headers['Prefer'] = `count=${count}`
    }

    return new PostgrestTransformBuilder(this)
  }
}
