import { StorageApiError, StorageUnknownError, ErrorNamespace } from './errors'
import { isPlainObject, resolveResponse } from './helpers'

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
 * Additional fetch parameters (e.g., signal for cancellation)
 */
export interface FetchParameters {
  signal?: AbortSignal
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
const _getErrorMessage = (err: any): string =>
  err.msg ||
  err.message ||
  err.error_description ||
  (typeof err.error === 'string' ? err.error : err.error?.message) ||
  JSON.stringify(err)

/**
 * Handles fetch errors and converts them to Storage error types
 * @param error - The error caught from fetch
 * @param reject - Promise rejection function
 * @param options - Fetch options that may affect error handling
 * @param namespace - Error namespace ('storage' or 'vectors')
 */
const handleError = async (
  error: unknown,
  reject: (reason?: any) => void,
  options: FetchOptions | undefined,
  namespace: ErrorNamespace
) => {
  // Check if error is a Response-like object (has status and ok properties)
  // This is more reliable than instanceof which can fail across realms
  const isResponseLike =
    error &&
    typeof error === 'object' &&
    'status' in error &&
    'ok' in error &&
    typeof (error as any).status === 'number'

  if (isResponseLike && !options?.noResolveJson) {
    const responseError = error as any
    const status = responseError.status || 500

    // Try to parse JSON body if available
    if (typeof responseError.json === 'function') {
      responseError
        .json()
        .then((err: any) => {
          const statusCode = err?.statusCode || err?.code || status + ''
          reject(new StorageApiError(_getErrorMessage(err), status, statusCode, namespace))
        })
        .catch(() => {
          // If JSON parsing fails for vectors, create ApiError with HTTP status
          if (namespace === 'vectors') {
            const statusCode = status + ''
            const message = responseError.statusText || `HTTP ${status} error`
            reject(new StorageApiError(message, status, statusCode, namespace))
          } else {
            const statusCode = status + ''
            const message = responseError.statusText || `HTTP ${status} error`
            reject(new StorageApiError(message, status, statusCode, namespace))
          }
        })
    } else {
      // No json() method available, create error from status
      const statusCode = status + ''
      const message = responseError.statusText || `HTTP ${status} error`
      reject(new StorageApiError(message, status, statusCode, namespace))
    }
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
    params.headers = { 'Content-Type': 'application/json', ...options?.headers }
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

        // Handle empty responses (204, empty body) - especially for vectors
        if (namespace === 'vectors') {
          const contentType = result.headers.get('content-type')
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
