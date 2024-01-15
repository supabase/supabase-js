// @ts-ignore
import nodeFetch from '@supabase/node-fetch'

import type { Fetch, PostgrestSingleResponse } from './types'
import PostgrestError from './PostgrestError'

export default abstract class PostgrestBuilder<Result>
  implements PromiseLike<PostgrestSingleResponse<Result>>
{
  protected method: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'DELETE'
  protected url: URL
  protected headers: Record<string, string>
  protected schema?: string
  protected body?: unknown
  protected shouldThrowOnError = false
  protected signal?: AbortSignal
  protected fetch: Fetch
  protected isMaybeSingle: boolean

  constructor(builder: PostgrestBuilder<Result>) {
    this.method = builder.method
    this.url = builder.url
    this.headers = builder.headers
    this.schema = builder.schema
    this.body = builder.body
    this.shouldThrowOnError = builder.shouldThrowOnError
    this.signal = builder.signal
    this.isMaybeSingle = builder.isMaybeSingle

    if (builder.fetch) {
      this.fetch = builder.fetch
    } else if (typeof fetch === 'undefined') {
      this.fetch = nodeFetch
    } else {
      this.fetch = fetch
    }
  }

  /**
   * If there's an error with the query, throwOnError will reject the promise by
   * throwing the error instead of returning it as part of a successful response.
   *
   * {@link https://github.com/supabase/supabase-js/issues/92}
   */
  throwOnError(): this {
    this.shouldThrowOnError = true
    return this
  }

  then<TResult1 = PostgrestSingleResponse<Result>, TResult2 = never>(
    onfulfilled?:
      | ((value: PostgrestSingleResponse<Result>) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): PromiseLike<TResult1 | TResult2> {
    // https://postgrest.org/en/stable/api.html#switching-schemas
    if (this.schema === undefined) {
      // skip
    } else if (['GET', 'HEAD'].includes(this.method)) {
      this.headers['Accept-Profile'] = this.schema
    } else {
      this.headers['Content-Profile'] = this.schema
    }
    if (this.method !== 'GET' && this.method !== 'HEAD') {
      this.headers['Content-Type'] = 'application/json'
    }

    // NOTE: Invoke w/o `this` to avoid illegal invocation error.
    // https://github.com/supabase/postgrest-js/pull/247
    const _fetch = this.fetch
    let res = _fetch(this.url.toString(), {
      method: this.method,
      headers: this.headers,
      body: JSON.stringify(this.body),
      signal: this.signal,
    }).then(async (res) => {
      let error = null
      let data = null
      let count: number | null = null
      let status = res.status
      let statusText = res.statusText

      if (res.ok) {
        if (this.method !== 'HEAD') {
          const body = await res.text()
          if (body === '') {
            // Prefer: return=minimal
          } else if (this.headers['Accept'] === 'text/csv') {
            data = body
          } else if (
            this.headers['Accept'] &&
            this.headers['Accept'].includes('application/vnd.pgrst.plan+text')
          ) {
            data = body
          } else {
            data = JSON.parse(body)
          }
        }

        const countHeader = this.headers['Prefer']?.match(/count=(exact|planned|estimated)/)
        const contentRange = res.headers.get('content-range')?.split('/')
        if (countHeader && contentRange && contentRange.length > 1) {
          count = parseInt(contentRange[1])
        }

        // Temporary partial fix for https://github.com/supabase/postgrest-js/issues/361
        // Issue persists e.g. for `.insert([...]).select().maybeSingle()`
        if (this.isMaybeSingle && this.method === 'GET' && Array.isArray(data)) {
          if (data.length > 1) {
            error = {
              // https://github.com/PostgREST/postgrest/blob/a867d79c42419af16c18c3fb019eba8df992626f/src/PostgREST/Error.hs#L553
              code: 'PGRST116',
              details: `Results contain ${data.length} rows, application/vnd.pgrst.object+json requires 1 row`,
              hint: null,
              message: 'JSON object requested, multiple (or no) rows returned',
            }
            data = null
            count = null
            status = 406
            statusText = 'Not Acceptable'
          } else if (data.length === 1) {
            data = data[0]
          } else {
            data = null
          }
        }
      } else {
        const body = await res.text()

        try {
          error = JSON.parse(body)

          // Workaround for https://github.com/supabase/postgrest-js/issues/295
          if (Array.isArray(error) && res.status === 404) {
            data = []
            error = null
            status = 200
            statusText = 'OK'
          }
        } catch {
          // Workaround for https://github.com/supabase/postgrest-js/issues/295
          if (res.status === 404 && body === '') {
            status = 204
            statusText = 'No Content'
          } else {
            error = {
              message: body,
            }
          }
        }

        if (error && this.isMaybeSingle && error?.details?.includes('0 rows')) {
          error = null
          status = 200
          statusText = 'OK'
        }

        if (error && this.shouldThrowOnError) {
          throw new PostgrestError(error)
        }
      }

      const postgrestResponse = {
        error,
        data,
        count,
        status,
        statusText,
      }

      return postgrestResponse
    })
    if (!this.shouldThrowOnError) {
      res = res.catch((fetchError) => ({
        error: {
          message: `${fetchError?.name ?? 'FetchError'}: ${fetchError?.message}`,
          details: `${fetchError?.stack ?? ''}`,
          hint: '',
          code: `${fetchError?.code ?? ''}`,
        },
        data: null,
        count: null,
        status: 0,
        statusText: '',
      }))
    }

    return res.then(onfulfilled, onrejected)
  }
}
