import { resolveFetch } from './helper'
import {
  Fetch,
  FunctionInvokeOptions,
  FunctionRegion,
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsResponse,
} from './types'

/**
 * Client for invoking Supabase Edge Functions.
 */
export class FunctionsClient {
  protected url: string
  protected headers: Record<string, string>
  protected region: FunctionRegion
  protected fetch: Fetch

  /**
   * Creates a new Functions client bound to an Edge Functions URL.
   *
   * @example Using supabase-js (recommended)
   * ```ts
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key')
   * const { data, error } = await supabase.functions.invoke('hello-world')
   * ```
   *
   * @category Functions
   *
   * @example Standalone import for bundle-sensitive environments
   * ```ts
   * import { FunctionsClient, FunctionRegion } from '@supabase/functions-js'
   *
   * const functions = new FunctionsClient('https://xyzcompany.supabase.co/functions/v1', {
   *   headers: { apikey: 'publishable-or-anon-key' },
   *   region: FunctionRegion.UsEast1,
   * })
   * ```
   */
  constructor(
    url: string,
    {
      headers = {},
      customFetch,
      region = FunctionRegion.Any,
    }: {
      headers?: Record<string, string>
      customFetch?: Fetch
      region?: FunctionRegion
    } = {}
  ) {
    this.url = url
    this.headers = headers
    this.region = region
    this.fetch = resolveFetch(customFetch)
  }

  /**
   * Updates the authorization header
   * @param token - the new jwt token sent in the authorisation header
   *
   * @category Functions
   *
   * @example Setting the authorization header
   * ```ts
   * functions.setAuth(session.access_token)
   * ```
   */
  setAuth(token: string) {
    this.headers.Authorization = `Bearer ${token}`
  }

  /**
   * Invokes a function
   * @param functionName - The name of the Function to invoke.
   * @param options - Options for invoking the Function.
   * @example
   * ```ts
   * const { data, error } = await functions.invoke('hello-world', {
   *   body: { name: 'Ada' },
   * })
   * ```
   *
   * @category Functions
   *
   * @remarks
   * - Requires an Authorization header.
   * - Invoke params generally match the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) spec.
   * - When you pass in a body to your function, we automatically attach the Content-Type header for `Blob`, `ArrayBuffer`, `File`, `FormData` and `String`. If it doesn't match any of these types we assume the payload is `json`, serialize it and attach the `Content-Type` header as `application/json`. You can override this behavior by passing in a `Content-Type` header of your own.
   * - Responses are automatically parsed as `json`, `blob` and `form-data` depending on the `Content-Type` header sent by your function. Responses are parsed as `text` by default.
   *
   * @example Basic invocation
   * ```js
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   body: { foo: 'bar' }
   * })
   * ```
   *
   * @exampleDescription Error handling
   * A `FunctionsHttpError` error is returned if your function throws an error, `FunctionsRelayError` if the Supabase Relay has an error processing your function and `FunctionsFetchError` if there is a network error in calling your function.
   *
   * @example Error handling
   * ```js
   * import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from "@supabase/supabase-js";
   *
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   headers: {
   *     "my-custom-header": 'my-custom-header-value'
   *   },
   *   body: { foo: 'bar' }
   * })
   *
   * if (error instanceof FunctionsHttpError) {
   *   const errorMessage = await error.context.json()
   *   console.log('Function returned an error', errorMessage)
   * } else if (error instanceof FunctionsRelayError) {
   *   console.log('Relay error:', error.message)
   * } else if (error instanceof FunctionsFetchError) {
   *   console.log('Fetch error:', error.message)
   * }
   * ```
   *
   * @exampleDescription Passing custom headers
   * You can pass custom headers to your function. Note: supabase-js automatically passes the `Authorization` header with the signed in user's JWT.
   *
   * @example Passing custom headers
   * ```js
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   headers: {
   *     "my-custom-header": 'my-custom-header-value'
   *   },
   *   body: { foo: 'bar' }
   * })
   * ```
   *
   * @exampleDescription Calling with DELETE HTTP verb
   * You can also set the HTTP verb to `DELETE` when calling your Edge Function.
   *
   * @example Calling with DELETE HTTP verb
   * ```js
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   headers: {
   *     "my-custom-header": 'my-custom-header-value'
   *   },
   *   body: { foo: 'bar' },
   *   method: 'DELETE'
   * })
   * ```
   *
   * @exampleDescription Invoking a Function in the UsEast1 region
   * Here are the available regions:
   * - `FunctionRegion.Any`
   * - `FunctionRegion.ApNortheast1`
   * - `FunctionRegion.ApNortheast2`
   * - `FunctionRegion.ApSouth1`
   * - `FunctionRegion.ApSoutheast1`
   * - `FunctionRegion.ApSoutheast2`
   * - `FunctionRegion.CaCentral1`
   * - `FunctionRegion.EuCentral1`
   * - `FunctionRegion.EuWest1`
   * - `FunctionRegion.EuWest2`
   * - `FunctionRegion.EuWest3`
   * - `FunctionRegion.SaEast1`
   * - `FunctionRegion.UsEast1`
   * - `FunctionRegion.UsWest1`
   * - `FunctionRegion.UsWest2`
   *
   * @example Invoking a Function in the UsEast1 region
   * ```js
   * import { createClient, FunctionRegion } from '@supabase/supabase-js'
   *
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   body: { foo: 'bar' },
   *   region: FunctionRegion.UsEast1
   * })
   * ```
   *
   * @exampleDescription Calling with GET HTTP verb
   * You can also set the HTTP verb to `GET` when calling your Edge Function.
   *
   * @example Calling with GET HTTP verb
   * ```js
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   headers: {
   *     "my-custom-header": 'my-custom-header-value'
   *   },
   *   method: 'GET'
   * })
   * ```
   *
   * @example Example 7
   * ```ts
   * const { data, error } = await functions.invoke('hello-world', {
   *   body: { name: 'Ada' },
   * })
   * ```
   */
  async invoke<T = any>(
    functionName: string,
    options: FunctionInvokeOptions = {}
  ): Promise<FunctionsResponse<T>> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let timeoutController: AbortController | undefined

    try {
      const { headers, method, body: functionArgs, signal, timeout } = options
      let _headers: Record<string, string> = {}
      let { region } = options
      if (!region) {
        region = this.region
      }
      // Add region as query parameter using URL API
      const url = new URL(`${this.url}/${functionName}`)
      if (region && region !== 'any') {
        _headers['x-region'] = region
        url.searchParams.set('forceFunctionRegion', region)
      }
      let body: any
      if (
        functionArgs &&
        ((headers && !Object.prototype.hasOwnProperty.call(headers, 'Content-Type')) || !headers)
      ) {
        if (
          (typeof Blob !== 'undefined' && functionArgs instanceof Blob) ||
          functionArgs instanceof ArrayBuffer
        ) {
          // will work for File as File inherits Blob
          // also works for ArrayBuffer as it is the same underlying structure as a Blob
          _headers['Content-Type'] = 'application/octet-stream'
          body = functionArgs
        } else if (typeof functionArgs === 'string') {
          // plain string
          _headers['Content-Type'] = 'text/plain'
          body = functionArgs
        } else if (typeof FormData !== 'undefined' && functionArgs instanceof FormData) {
          // don't set content-type headers
          // Request will automatically add the right boundary value
          body = functionArgs
        } else {
          // default, assume this is JSON
          _headers['Content-Type'] = 'application/json'
          body = JSON.stringify(functionArgs)
        }
      } else {
        if (
          functionArgs &&
          typeof functionArgs !== 'string' &&
          !(typeof Blob !== 'undefined' && functionArgs instanceof Blob) &&
          !(functionArgs instanceof ArrayBuffer) &&
          !(typeof FormData !== 'undefined' && functionArgs instanceof FormData)
        ) {
          body = JSON.stringify(functionArgs)
        } else {
          body = functionArgs
        }
      }

      // Handle timeout by creating an AbortController
      let effectiveSignal = signal
      if (timeout) {
        timeoutController = new AbortController()
        timeoutId = setTimeout(() => timeoutController!.abort(), timeout)

        // If user provided their own signal, we need to respect both
        if (signal) {
          effectiveSignal = timeoutController.signal
          // If the user's signal is aborted, abort our timeout controller too
          signal.addEventListener('abort', () => timeoutController!.abort())
        } else {
          effectiveSignal = timeoutController.signal
        }
      }

      const response = await this.fetch(url.toString(), {
        method: method || 'POST',
        // headers priority is (high to low):
        // 1. invoke-level headers
        // 2. client-level headers
        // 3. default Content-Type header
        headers: { ..._headers, ...this.headers, ...headers },
        body,
        signal: effectiveSignal,
      }).catch((fetchError) => {
        throw new FunctionsFetchError(fetchError)
      })

      const isRelayError = response.headers.get('x-relay-error')
      if (isRelayError && isRelayError === 'true') {
        throw new FunctionsRelayError(response)
      }

      if (!response.ok) {
        throw new FunctionsHttpError(response)
      }

      let responseType = (response.headers.get('Content-Type') ?? 'text/plain').split(';')[0].trim()
      let data: any
      if (responseType === 'application/json') {
        data = await response.json()
      } else if (
        responseType === 'application/octet-stream' ||
        responseType === 'application/pdf'
      ) {
        data = await response.blob()
      } else if (responseType === 'text/event-stream') {
        data = response
      } else if (responseType === 'multipart/form-data') {
        data = await response.formData()
      } else {
        // default to text
        data = await response.text()
      }

      return { data, error: null, response }
    } catch (error) {
      return {
        data: null,
        error,
        response:
          error instanceof FunctionsHttpError || error instanceof FunctionsRelayError
            ? error.context
            : undefined,
      }
    } finally {
      // Clear the timeout if it was set
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }
}
