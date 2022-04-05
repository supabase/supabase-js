import { resolveFetch } from './helper'
import { Fetch, FunctionInvokeOptions } from './types'

export class FunctionsClient {
  protected url: string
  protected headers: Record<string, string>
  protected fetch: Fetch

  constructor(
    url: string,
    {
      headers = {},
      customFetch,
    }: {
      headers?: Record<string, string>
      customFetch?: Fetch
    } = {}
  ) {
    this.url = url
    this.headers = headers
    this.fetch = resolveFetch(customFetch)
  }

  /**
   * Updates the authorization header
   * @params token - the new jwt token sent in the authorisation header
   */
  setAuth(token: string) {
    this.headers.Authorization = `Bearer ${token}`
  }

  /**
   * Invokes a function
   * @param functionName - the name of the function to invoke
   * @param invokeOptions - object with the following properties
   * `headers`: object representing the headers to send with the request
   * `body`: the body of the request
   * `responseType`: how the response should be parsed. The default is `json`
   */
  async invoke<T = any>(
    functionName: string,
    invokeOptions?: FunctionInvokeOptions
  ): Promise<{ data: T; error: null } | { data: null; error: Error }> {
    try {
      const { headers, body } = invokeOptions ?? {}
      const response = await this.fetch(`${this.url}/${functionName}`, {
        method: 'POST',
        headers: Object.assign({}, this.headers, headers),
        body,
      })

      const isRelayError = response.headers.get('x-relay-error')
      if (isRelayError && isRelayError === 'true') {
        return { data: null, error: new Error(await response.text()) }
      }

      let data
      const { responseType } = invokeOptions ?? {}
      if (!responseType || responseType === 'json') {
        data = await response.json()
      } else if (responseType === 'arrayBuffer') {
        data = await response.arrayBuffer()
      } else if (responseType === 'blob') {
        data = await response.blob()
      } else {
        data = await response.text()
      }

      return { data, error: null }
    } catch (error: any) {
      return { data: null, error }
    }
  }
}
