// Base API Client
export { default as BaseApiClient } from './BaseApiClient'

// Unified Error Classes
export {
  StorageError,
  StorageApiError,
  StorageUnknownError,
  StorageVectorsError,
  StorageVectorsApiError,
  StorageVectorsUnknownError,
  StorageVectorsErrorCode,
  isStorageError,
  isStorageVectorsError,
} from './errors'
export type { ErrorNamespace } from './errors'

// Unified Fetch API
export { createFetchApi, get, post, put, head, remove } from './fetch'
export type { Fetch, FetchOptions, FetchParameters, RequestMethodType } from './fetch'

// Consolidated Helpers
export {
  resolveFetch,
  resolveResponse,
  isPlainObject,
  recursiveToCamel,
  isValidBucketName,
  normalizeToFloat32,
  validateVectorDimension,
} from './helpers'
