import crossFetch from 'cross-fetch'

export type Fetch = typeof crossFetch
export type FunctionInvokeOptions = {
  headers: { [key: string]: string }
  body?: Blob | BufferSource | FormData | URLSearchParams | ReadableStream<Uint8Array> | string
}
