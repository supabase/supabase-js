export type Fetch = typeof fetch

export enum ResponseType {
  json,
  text,
  arrayBuffer,
  blob,
}

export type FunctionInvokeOptions = {
  /** object representing the headers to send with the request */
  headers?: { [key: string]: string }
  /** the body of the request */
  body?: Blob | BufferSource | FormData | URLSearchParams | ReadableStream<Uint8Array> | string
  /** how the response should be parsed. The default is `json` */
  responseType?: keyof typeof ResponseType
}
