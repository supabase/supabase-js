import { AuthApiError, AuthRetryableFetchError, AuthUnknownError } from './errors'
import { resolveResponse } from './helpers'

export type Fetch = typeof fetch

export interface FetchOptions {
  headers?: {
    [key: string]: string
  }
  noResolveJson?: boolean
}

export interface FetchParameters {
  signal?: AbortSignal
}

export type RequestMethodType = 'GET' | 'POST' | 'PUT' | 'DELETE'

const _getErrorMessage = (err: any): string =>
  err.msg || err.message || err.error_description || err.error || JSON.stringify(err)

const handleError = async (error: unknown, reject: (reason?: any) => void) => {
  const Res = await resolveResponse()

  if (!(error instanceof Res)) {
    reject(new AuthRetryableFetchError(_getErrorMessage(error), 0))
  } else if (error.status >= 500 && error.status <= 599) {
    // status in 500...599 range - server had an error, request might be retryed.
    reject(new AuthRetryableFetchError(_getErrorMessage(error), error.status))
  } else {
    // got a response from server that is not in the 500...599 range - should not retry
    error
      .json()
      .then((err) => {
        reject(new AuthApiError(_getErrorMessage(err), error.status || 500))
      })
      .catch((e) => {
        // not a valid json response
        reject(new AuthUnknownError(_getErrorMessage(e), e))
      })
  }
}

const _getRequestParams = (
  method: RequestMethodType,
  options?: FetchOptions,
  parameters?: FetchParameters,
  body?: object
) => {
  const params: { [k: string]: any } = { method, headers: options?.headers || {} }

  if (method === 'GET') {
    return params
  }

  params.headers = { 'Content-Type': 'application/json', ...options?.headers }
  params.body = JSON.stringify(body)
  return { ...params, ...parameters }
}

async function _handleRequest(
  fetcher: Fetch,
  method: RequestMethodType,
  url: string,
  options?: FetchOptions,
  parameters?: FetchParameters,
  body?: object
): Promise<any> {
  return new Promise((resolve, reject) => {
    fetcher(url, _getRequestParams(method, options, parameters, body))
      .then((result) => {
        if (!result.ok) throw result
        if (options?.noResolveJson) return result
        return result.json()
      })
      .then((data) => resolve(data))
      .catch((error) => handleError(error, reject))
  })
}

export async function get(
  fetcher: Fetch,
  url: string,
  options?: FetchOptions,
  parameters?: FetchParameters
): Promise<any> {
  return _handleRequest(fetcher, 'GET', url, options, parameters)
}

export async function post(
  fetcher: Fetch,
  url: string,
  body: object,
  options?: FetchOptions,
  parameters?: FetchParameters
): Promise<any> {
  return _handleRequest(fetcher, 'POST', url, options, parameters, body)
}

export async function put(
  fetcher: Fetch,
  url: string,
  body: object,
  options?: FetchOptions,
  parameters?: FetchParameters
): Promise<any> {
  return _handleRequest(fetcher, 'PUT', url, options, parameters, body)
}

export async function remove(
  fetcher: Fetch,
  url: string,
  body: object,
  options?: FetchOptions,
  parameters?: FetchParameters
): Promise<any> {
  return _handleRequest(fetcher, 'DELETE', url, options, parameters, body)
}
