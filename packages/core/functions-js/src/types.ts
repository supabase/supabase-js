export type Fetch = typeof fetch

export enum ResponseType {
  json,
  text,
  arrayBuffer,
  blob,
}

export type FunctionInvokeOptions = {
  headers?: { [key: string]: string }
  body?: Blob | BufferSource | FormData | URLSearchParams | ReadableStream<Uint8Array> | string
  responseType?: keyof typeof ResponseType
}
