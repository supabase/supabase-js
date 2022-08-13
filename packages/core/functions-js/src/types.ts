export type Fetch = typeof fetch

/**
 * Response format
 *
 */
interface FunctionsResponseSuccess {
  data: any
  error: null
}
interface FunctionsResponseFailure {
  data: null
  error: any
}
export type FunctionsResponse = FunctionsResponseSuccess | FunctionsResponseFailure

export class FunctionsError extends Error {
  context: any
  constructor(message: string, name = 'FunctionsError', context?: any) {
    super(message)
    super.name = name
    this.context = context
  }
}

export class FunctionsFetchError extends FunctionsError {
  constructor(context: any) {
    super('Failed to perform request to Edge Function', 'FunctionsFetchError', context)
  }
}

export class FunctionsRelayError extends FunctionsError {
  constructor(context: any) {
    super('Relay error communicating with deno backend', 'FunctionsRelayError', context)
  }
}

export class FunctionsHttpError extends FunctionsError {
  constructor(context: any) {
    super('Edge Function returned a non-2xx status code', 'FunctionsHttpError', context)
  }
}
