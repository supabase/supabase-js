/**
 * Type alias for the native fetch function
 */
export type Fetch = typeof fetch

/**
 * Resolves the fetch implementation to use
 * @param customFetch - Optional custom fetch implementation
 * @returns Resolved fetch function
 */
export const resolveFetch = (customFetch?: Fetch): Fetch => {
  if (customFetch) {
    return (...args) => customFetch(...args)
  }
  return (...args) => fetch(...args)
}

/**
 * Resolves the Response constructor
 * @returns Response constructor
 */
export const resolveResponse = (): typeof Response => {
  return Response
}

/**
 * Resolves the Headers constructor
 * @returns Headers constructor
 */
export const resolveHeadersConstructor = (): typeof Headers => {
  return Headers
}
