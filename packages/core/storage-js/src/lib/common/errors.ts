/**
 * Namespace type for error classes
 * Determines the error class names and type guards
 */
export type ErrorNamespace = 'storage' | 'vectors'

/**
 * Base error class for all Storage errors
 * Supports both 'storage' and 'vectors' namespaces
 */
export class StorageError extends Error {
  protected __isStorageError = true
  protected namespace: ErrorNamespace
  status?: number
  statusCode?: string

  constructor(
    message: string,
    namespace: ErrorNamespace = 'storage',
    status?: number,
    statusCode?: string
  ) {
    super(message)
    this.namespace = namespace
    this.name = namespace === 'vectors' ? 'StorageVectorsError' : 'StorageError'
    this.status = status
    this.statusCode = statusCode
  }
}

/**
 * Type guard to check if an error is a StorageError
 * @param error - The error to check
 * @returns True if the error is a StorageError
 */
export function isStorageError(error: unknown): error is StorageError {
  return typeof error === 'object' && error !== null && '__isStorageError' in error
}

/**
 * API error returned from Storage service
 * Includes HTTP status code and service-specific error code
 */
export class StorageApiError extends StorageError {
  override status: number
  override statusCode: string

  constructor(
    message: string,
    status: number,
    statusCode: string,
    namespace: ErrorNamespace = 'storage'
  ) {
    super(message, namespace, status, statusCode)
    this.name = namespace === 'vectors' ? 'StorageVectorsApiError' : 'StorageApiError'
    this.status = status
    this.statusCode = statusCode
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      statusCode: this.statusCode,
    }
  }
}

/**
 * Unknown error that doesn't match expected error patterns
 * Wraps the original error for debugging
 */
export class StorageUnknownError extends StorageError {
  originalError: unknown

  constructor(message: string, originalError: unknown, namespace: ErrorNamespace = 'storage') {
    super(message, namespace)
    this.name = namespace === 'vectors' ? 'StorageVectorsUnknownError' : 'StorageUnknownError'
    this.originalError = originalError
  }
}

// ============================================================================
// Backward Compatibility Exports for Vectors
// ============================================================================

/**
 * @deprecated Use StorageError with namespace='vectors' instead
 * Alias for backward compatibility with existing vector storage code
 */
export class StorageVectorsError extends StorageError {
  constructor(message: string) {
    super(message, 'vectors')
  }
}

/**
 * Type guard to check if an error is a StorageVectorsError
 * @param error - The error to check
 * @returns True if the error is a StorageVectorsError
 */
export function isStorageVectorsError(error: unknown): error is StorageVectorsError {
  return isStorageError(error) && (error as StorageError)['namespace'] === 'vectors'
}

/**
 * @deprecated Use StorageApiError with namespace='vectors' instead
 * Alias for backward compatibility with existing vector storage code
 */
export class StorageVectorsApiError extends StorageApiError {
  constructor(message: string, status: number, statusCode: string) {
    super(message, status, statusCode, 'vectors')
  }
}

/**
 * @deprecated Use StorageUnknownError with namespace='vectors' instead
 * Alias for backward compatibility with existing vector storage code
 */
export class StorageVectorsUnknownError extends StorageUnknownError {
  constructor(message: string, originalError: unknown) {
    super(message, originalError, 'vectors')
  }
}

/**
 * Error codes specific to S3 Vectors API
 * Maps AWS service errors to application-friendly error codes
 */
export enum StorageVectorsErrorCode {
  /** Internal server fault (HTTP 500) */
  InternalError = 'InternalError',
  /** Resource already exists / conflict (HTTP 409) */
  S3VectorConflictException = 'S3VectorConflictException',
  /** Resource not found (HTTP 404) */
  S3VectorNotFoundException = 'S3VectorNotFoundException',
  /** Delete bucket while not empty (HTTP 400) */
  S3VectorBucketNotEmpty = 'S3VectorBucketNotEmpty',
  /** Exceeds bucket quota/limit (HTTP 400) */
  S3VectorMaxBucketsExceeded = 'S3VectorMaxBucketsExceeded',
  /** Exceeds index quota/limit (HTTP 400) */
  S3VectorMaxIndexesExceeded = 'S3VectorMaxIndexesExceeded',
}
