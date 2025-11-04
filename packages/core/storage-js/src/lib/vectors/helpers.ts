type Fetch = typeof fetch

/**
 * Resolves the fetch implementation to use
 * Uses custom fetch if provided, otherwise uses native fetch
 *
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
 * Resolves the Response constructor to use
 * Returns native Response constructor
 *
 * @returns Response constructor
 */
export const resolveResponse = (): typeof Response => {
  return Response
}

/**
 * Determine if input is a plain object
 * An object is plain if it's created by either {}, new Object(), or Object.create(null)
 *
 * @param value - Value to check
 * @returns True if value is a plain object
 * @source https://github.com/sindresorhus/is-plain-obj
 */
export const isPlainObject = (value: object): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return (
    (prototype === null ||
      prototype === Object.prototype ||
      Object.getPrototypeOf(prototype) === null) &&
    !(Symbol.toStringTag in value) &&
    !(Symbol.iterator in value)
  )
}

/**
 * Normalizes a number array to float32 format
 * Ensures all vector values are valid 32-bit floats
 *
 * @param values - Array of numbers to normalize
 * @returns Normalized float32 array
 */
export const normalizeToFloat32 = (values: number[]): number[] => {
  // Use Float32Array to ensure proper precision
  return Array.from(new Float32Array(values))
}

/**
 * Validates vector dimensions match expected dimension
 * Throws error if dimensions don't match
 *
 * @param vector - Vector data to validate
 * @param expectedDimension - Expected vector dimension
 * @throws Error if dimensions don't match
 */
export const validateVectorDimension = (
  vector: { float32: number[] },
  expectedDimension?: number
): void => {
  if (expectedDimension !== undefined && vector.float32.length !== expectedDimension) {
    throw new Error(
      `Vector dimension mismatch: expected ${expectedDimension}, got ${vector.float32.length}`
    )
  }
}
