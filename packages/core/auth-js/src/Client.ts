import { ClientConfig } from './Client.types'

export default class Client {
  url: string
  headers: ClientConfig['headers'] = {}

  /**
   * Creates a GoTrue instance for admin interactions.
   *
   * @param url  URL of the GoTrue instance.
   * @param headers  Custom headers.
   */
  constructor(url: string, options?: ClientConfig) {
    this.url = url
    if (options?.headers) {
      this.headers = { ...this.headers, ...options.headers }
    }
  }
}
