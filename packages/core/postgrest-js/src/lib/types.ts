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
