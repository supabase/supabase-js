import crossFetch from 'cross-fetch'
type Fetch = typeof crossFetch

export class FunctionsClient {
  protected url: string
  protected headers: { [key: string]: string }
  protected fetch: Fetch

  constructor(url: string, headers: { [key: string]: string }, customFetch?: Fetch) {
    this.url = url
    this.headers = headers

    if (customFetch) {
      this.fetch = customFetch
    } else if (typeof fetch !== 'undefined') {
      this.fetch = fetch
    } else {
      this.fetch = crossFetch
    }
  }

  /**
   * Updates the authorization header
   * @params token - the new jwt token sent in the authorisation header
   */
  setAuth(token: string) {
    this.headers.Authorization = `Bearer ${token}`
  }

  // can type body via filter RequestInit from https://microsoft.github.io/PowerBI-JavaScript/interfaces/_node_modules_typedoc_node_modules_typescript_lib_lib_dom_d_.requestinit.html

  /**
   * Invokes a function
   * @params functionName - the name of the function to invoke
   * @params body - the body to be sent when invoking the function
   * @params headers - the headers to be sent when invoking the function
   */
  async invoke(
    functionName: string,
    headers: { [key: string]: string } = {},
    body?: Blob | BufferSource | FormData | URLSearchParams | ReadableStream<Uint8Array> | string
  ): Promise<{ data: string | null; error: Error | null }> {
    try {
      const response = await this.fetch(`${this.url}/${functionName}`, {
        method: 'POST',
        headers: Object.assign({}, headers, this.headers),
        body,
      })

      const data = await response.text()
      return { data, error: null }
    } catch (error: any) {
      return { data: null, error }
    }
  }
}
