import { ErrorNamespace, isStorageError, StorageError } from './errors'
import { Fetch } from './fetch'
import { resolveFetch } from './helpers'

/**
 * @ignore
 * Base API client class for all Storage API classes
 * Provides common infrastructure for error handling and configuration
 *
 * @typeParam TError - The error type (StorageError or subclass)
 */
export default abstract class BaseApiClient<TError extends StorageError = StorageError> {
  protected url: string
  protected headers: { [key: string]: string }
  protected fetch: Fetch
  protected shouldThrowOnError = false
  protected namespace: ErrorNamespace

  /**
   * Creates a new BaseApiClient instance
   * @param url - Base URL for API requests
   * @param headers - Default headers for API requests
   * @param fetch - Optional custom fetch implementation
   * @param namespace - Error namespace ('storage' or 'vectors')
   */
  constructor(
    url: string,
    headers: { [key: string]: string } = {},
    fetch?: Fetch,
    namespace: ErrorNamespace = 'storage'
  ) {
    this.url = url
    this.headers = headers
    this.fetch = resolveFetch(fetch)
    this.namespace = namespace
  }

  /**
   * Enable throwing errors instead of returning them.
   * When enabled, errors are thrown instead of returned in { data, error } format.
   *
   * @returns this - For method chaining
   */
  public throwOnError(): this {
    this.shouldThrowOnError = true
    return this
  }

  /**
   * Set an HTTP header for the request.
   * Creates a shallow copy of headers to avoid mutating shared state.
   *
   * @param name - Header name
   * @param value - Header value
   * @returns this - For method chaining
   */
  public setHeader(name: string, value: string): this {
    this.headers = { ...this.headers, [name]: value }
    return this
  }

  /**
   * Handles API operation with standardized error handling
   * Eliminates repetitive try-catch blocks across all API methods
   *
   * This wrapper:
   * 1. Executes the operation
   * 2. Returns { data, error: null } on success
   * 3. Returns { data: null, error } on failure (if shouldThrowOnError is false)
   * 4. Throws error on failure (if shouldThrowOnError is true)
   *
   * @typeParam T - The expected data type from the operation
   * @param operation - Async function that performs the API call
   * @returns Promise with { data, error } tuple
   *
   * @example
   * ```typescript
   * async listBuckets() {
   *   return this.handleOperation(async () => {
   *     return await get(this.fetch, `${this.url}/bucket`, {
   *       headers: this.headers,
   *     })
   *   })
   * }
   * ```
   */
  protected async handleOperation<T>(
    operation: () => Promise<T>
  ): Promise<{ data: T; error: null } | { data: null; error: TError }> {
    try {
      const data = await operation()
      return { data, error: null }
    } catch (error) {
      if (this.shouldThrowOnError) {
        throw error
      }
      if (isStorageError(error)) {
        return { data: null, error: error as TError }
      }
      throw error
    }
  }
}
