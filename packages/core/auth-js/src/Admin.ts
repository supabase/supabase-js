export default class Admin {
  url: string
  headers: { [key: string]: string }
  schema?: string

  /**
   * Creates a GoTrue instance for admin interactions.
   *
   * @param url  URL of the GoTrue instance.
   * @param headers  Custom headers.
   */
  constructor(
    url: string,
    { headers = {} }: { headers?: { [key: string]: string }; schema?: string } = {}
  ) {
    this.url = url
    this.headers = headers
  }
}
