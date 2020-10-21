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
  data: T[] | null
  status: number
  statusText: string
  // For backward compatibility: body === data
  body: T[] | null
}

export interface PostgrestSingleResponse<T> {
  error: PostgrestError | null
  data: T | null
  status: number
  statusText: string
  // For backward compatibility: body === data
  body: T | null
}

export abstract class PostgrestBuilder<T> implements PromiseLike<PostgrestResponse<T>> {
  protected method!: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'DELETE'
  protected url!: URL
  protected headers!: { [key: string]: string }
  protected schema?: string
  protected body?: Partial<T> | Partial<T>[]

  constructor(builder: PostgrestBuilder<T>) {
    Object.assign(this, builder)
  }

  then<TResult1 = PostgrestResponse<T>, TResult2 = never>(
    onfulfilled?:
      | ((value: PostgrestResponse<T>) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?: (value: any) => any
  ): Promise<any> {
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
        const postgrestResponse: PostgrestResponse<T> = {
          error,
          data,
          status: res.status,
          statusText: res.statusText,
          body: data,
        }
        return postgrestResponse
      })
      .then(onfulfilled, onrejected)
  }
}
