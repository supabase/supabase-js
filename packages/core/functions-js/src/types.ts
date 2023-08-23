export type Fetch = typeof fetch

/**
 * Response format
 *
 */
export interface FunctionsResponseSuccess<T> {
  data: T
  error: null
}
export interface FunctionsResponseFailure {
  data: null
  error: any
}
export type FunctionsResponse<T> = FunctionsResponseSuccess<T> | FunctionsResponseFailure

export class FunctionsError extends Error {
  context: any
  constructor(message: string, name = 'FunctionsError', context?: any) {
    super(message)
    this.name = name
    this.context = context
  }
}

export class FunctionsFetchError extends FunctionsError {
  constructor(context: any) {
    super('Failed to send a request to the Edge Function', 'FunctionsFetchError', context)
  }
}

export class FunctionsRelayError extends FunctionsError {
  constructor(context: any) {
    super('Relay Error invoking the Edge Function', 'FunctionsRelayError', context)
  }
}

export class FunctionsHttpError extends FunctionsError {
  constructor(context: any) {
    super('Edge Function returned a non-2xx status code', 'FunctionsHttpError', context)
  }
}

export type FunctionInvokeOptions = {
  /**
   * Object representing the headers to send with the request.
   * */
  headers?: { [key: string]: string }
  /**
   * The HTTP verb of the request
   */
  method?: 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE'
  /**
   * The body of the request.
   */
  body?:
    | File
    | Blob
    | ArrayBuffer
    | FormData
    | ReadableStream<Uint8Array>
    | Record<string, any>
    | string
}
