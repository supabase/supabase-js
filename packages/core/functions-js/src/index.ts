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

  // do we need a setAuth method?

  // can type body via filter RequestInit from https://microsoft.github.io/PowerBI-JavaScript/interfaces/_node_modules_typedoc_node_modules_typescript_lib_lib_dom_d_.requestinit.html
  async invoke(
    functionName: string,
    headers: { [key: string]: string } = {},
    body?: Blob | BufferSource | FormData | URLSearchParams | ReadableStream<Uint8Array> | string
  ): Promise<{ data: string | null; error: Error | null }> {
    try {
      console.log(`calling ${functionName}`)

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
