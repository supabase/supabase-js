import { StorageApiError, StorageError, StorageUnknownError, ErrorNamespace } from './errors'
import { setHeader } from './headers'
import { isPlainObject, resolveResponse } from './helpers'
import { FetchParameters } from '../types'

export type Fetch = typeof fetch

/**
 * Options for fetch requests
 */
export interface FetchOptions {
  headers?: {
    [key: string]: string
  }
  duplex?: string
  noResolveJson?: boolean
}

/**
 * HTTP methods supported by the API
 */
export type RequestMethodType = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD'

/**
 * Extracts error message from various error response formats
 * @param err - Error object from API
 * @returns Human-readable error message
 */
const _getErrorMessage = (err: unknown): string => {
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>
    if (typeof e.msg === 'string') return e.msg
    if (typeof e.message === 'string') return e.message
    if (typeof e.error_description === 'string') return e.error_description
    if (typeof e.error === 'string') return e.error
    if (typeof e.error === 'object' && e.error !== null) {
      const nested = e.error as Record<string, unknown>
      if (typeof nested.message === 'string') return nested.message
    }
  }
  return JSON.stringify(err)
}

/**
 * Handles fetch errors and converts them to Storage error types
 * @param error - The error caught from fetch
 * @param reject - Promise rejection function
 * @param options - Fetch options that may affect error handling
 * @param namespace - Error namespace ('storage' or 'vectors')
 */
const handleError = async (
  error: unknown,
  reject: (reason: StorageError) => void,
  options: FetchOptions | undefined,
  namespace: ErrorNamespace
) => {
  // Structural detection of json() method, present in all Response implementations
  // (native, node-fetch, cross-fetch, undici) and absent from standard Error objects.
  // Checking 'ok' or 'status' via `in` is unreliable across fetch polyfills/realms.
  const isResponseLike =
    error !== null &&
    typeof error === 'object' &&
    'json' in error &&
    typeof (error as Record<string, unknown>).json === 'function'

  if (isResponseLike) {
    const responseError = error as Response
    // Defensive coercion: some fetch polyfills have historically returned status as a string.
    let status = parseInt(String(responseError.status), 10)
    if (!Number.isFinite(status)) {
      status = 500
    }

    responseError
      .json()
      .then(
        (err: { statusCode?: string; code?: string; error?: string; message?: string } | null) => {
          const statusCode = err?.statusCode || err?.code || status + ''
          reject(new StorageApiError(_getErrorMessage(err), status, statusCode, namespace))
        }
      )
      .catch(() => {
        const statusCode = status + ''
        const message = responseError.statusText || `HTTP ${status} error`
        reject(new StorageApiError(message, status, statusCode, namespace))
      })
  } else {
    reject(new StorageUnknownError(_getErrorMessage(error), error, namespace))
  }
}

/**
 * Builds request parameters for fetch calls
 * @param method - HTTP method
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters like AbortSignal
 * @param body - Request body (will be JSON stringified if plain object)
 * @returns Complete fetch request parameters
 */
const _getRequestParams = (
  method: RequestMethodType,
  options?: FetchOptions,
  parameters?: FetchParameters,
  body?: object
) => {
  const params: { [k: string]: any } = { method, headers: options?.headers || {} }

  if (method === 'GET' || method === 'HEAD' || !body) {
    return { ...params, ...parameters }
  }

  if (isPlainObject(body)) {
    const headers = options?.headers || {}
    let contentType: string | undefined

    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === 'content-type') {
        contentType = value
      }
    }

    params.headers = setHeader(headers, 'Content-Type', contentType ?? 'application/json')
    params.body = JSON.stringify(body)
  } else {
    params.body = body
  }

  if (options?.duplex) {
    params.duplex = options.duplex
  }

  return { ...params, ...parameters }
}

/**
 * Internal request handler that wraps fetch with error handling
 * @param fetcher - Fetch function to use
 * @param method - HTTP method
 * @param url - Request URL
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters
 * @param body - Request body
 * @param namespace - Error namespace ('storage' or 'vectors')
 * @returns Promise with parsed response or error
 */
async function _handleRequest(
  fetcher: Fetch,
  method: RequestMethodType,
  url: string,
  options: FetchOptions | undefined,
  parameters: FetchParameters | undefined,
  body: object | undefined,
  namespace: ErrorNamespace
): Promise<any> {
  return new Promise((resolve, reject) => {
    fetcher(url, _getRequestParams(method, options, parameters, body))
      .then((result) => {
        if (!result.ok) throw result
        if (options?.noResolveJson) return result

        // AWS S3 Vectors API returns 200 OK with content-length: 0 for successful mutations
        // (putVectors, deleteVectors) instead of 204 or JSON response. This is AWS's design choice
        // for performance optimization of bulk operations (up to 500 vectors per request).
        // We handle this to prevent "Unexpected end of JSON input" errors when calling result.json()
        if (namespace === 'vectors') {
          const contentType = result.headers.get('content-type')
          const contentLength = result.headers.get('content-length')

          // Return empty object for explicitly empty responses
          if (contentLength === '0' || result.status === 204) {
            return {}
          }

          // Return empty object if no JSON content type
          if (!contentType || !contentType.includes('application/json')) {
            return {}
          }
        }

        return result.json()
      })
      .then((data) => resolve(data))
      .catch((error) => handleError(error, reject, options, namespace))
  })
}

/**
 * Creates a fetch API with the specified namespace
 * @param namespace - Error namespace ('storage' or 'vectors')
 * @returns Object with HTTP method functions
 */
export function createFetchApi(namespace: ErrorNamespace = 'storage') {
  return {
    /**
     * Performs a GET request
     * @param fetcher - Fetch function to use
     * @param url - Request URL
     * @param options - Custom fetch options
     * @param parameters - Additional fetch parameters
     * @returns Promise with parsed response
     */
    get: async (
      fetcher: Fetch,
      url: string,
      options?: FetchOptions,
      parameters?: FetchParameters
    ): Promise<any> => {
      return _handleRequest(fetcher, 'GET', url, options, parameters, undefined, namespace)
    },

    /**
     * Performs a POST request
     * @param fetcher - Fetch function to use
     * @param url - Request URL
     * @param body - Request body to be JSON stringified
     * @param options - Custom fetch options
     * @param parameters - Additional fetch parameters
     * @returns Promise with parsed response
     */
    post: async (
      fetcher: Fetch,
      url: string,
      body: object,
      options?: FetchOptions,
      parameters?: FetchParameters
    ): Promise<any> => {
      return _handleRequest(fetcher, 'POST', url, options, parameters, body, namespace)
    },

    /**
     * Performs a PUT request
     * @param fetcher - Fetch function to use
     * @param url - Request URL
     * @param body - Request body to be JSON stringified
     * @param options - Custom fetch options
     * @param parameters - Additional fetch parameters
     * @returns Promise with parsed response
     */
    put: async (
      fetcher: Fetch,
      url: string,
      body: object,
      options?: FetchOptions,
      parameters?: FetchParameters
    ): Promise<any> => {
      return _handleRequest(fetcher, 'PUT', url, options, parameters, body, namespace)
    },

    /**
     * Performs a HEAD request
     * @param fetcher - Fetch function to use
     * @param url - Request URL
     * @param options - Custom fetch options
     * @param parameters - Additional fetch parameters
     * @returns Promise with Response object (not JSON parsed)
     */
    head: async (
      fetcher: Fetch,
      url: string,
      options?: FetchOptions,
      parameters?: FetchParameters
    ): Promise<any> => {
      return _handleRequest(
        fetcher,
        'HEAD',
        url,
        {
          ...options,
          noResolveJson: true,
        },
        parameters,
        undefined,
        namespace
      )
    },

    /**
     * Performs a DELETE request
     * @param fetcher - Fetch function to use
     * @param url - Request URL
     * @param body - Request body to be JSON stringified
     * @param options - Custom fetch options
     * @param parameters - Additional fetch parameters
     * @returns Promise with parsed response
     */
    remove: async (
      fetcher: Fetch,
      url: string,
      body: object,
      options?: FetchOptions,
      parameters?: FetchParameters
    ): Promise<any> => {
      return _handleRequest(fetcher, 'DELETE', url, options, parameters, body, namespace)
    },
  }
}

// Default exports for backward compatibility with 'storage' namespace
const defaultApi = createFetchApi('storage')
export const { get, post, put, head, remove } = defaultApi

// Vectors API with 'vectors' namespace for proper error handling
export const vectorsApi = createFetchApi('vectors')
