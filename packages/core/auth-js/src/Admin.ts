import { AdminConfig } from './Admin.types'

export default class Admin {
  url: string
  headers: AdminConfig['headers'] = {}

  /**
   * Creates a GoTrue instance for admin interactions.
   *
   * @param url  URL of the GoTrue instance.
   * @param headers  Custom headers.
   */
  constructor(url: string, options?: AdminConfig) {
    this.url = url
    if (options?.headers) {
      this.headers = { ...this.headers, ...options.headers }
    }
  }
}
