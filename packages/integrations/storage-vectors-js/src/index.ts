// Main client
export { StorageVectorsClient, VectorBucketScope, VectorIndexScope } from './lib/StorageVectorsClient'
export type { StorageVectorsClientOptions } from './lib/StorageVectorsClient'

// API classes (for advanced usage)
export { default as VectorBucketApi } from './lib/VectorBucketApi'
export { default as VectorIndexApi } from './lib/VectorIndexApi'
export { default as VectorDataApi } from './lib/VectorDataApi'
export type { CreateIndexOptions } from './lib/VectorIndexApi'

// Types
export type {
  // Core types
  VectorBucket,
  VectorIndex,
  VectorData,
  VectorMetadata,
  VectorObject,
  VectorMatch,
  EncryptionConfiguration,
  MetadataConfiguration,
  VectorDataType,
  DistanceMetric,
  VectorFilter,

  // Request/Response types
  ListVectorBucketsOptions,
  ListVectorBucketsResponse,
  ListIndexesOptions,
  ListIndexesResponse,
  PutVectorsOptions,
  GetVectorsOptions,
  GetVectorsResponse,
  DeleteVectorsOptions,
  ListVectorsOptions,
  ListVectorsResponse,
  QueryVectorsOptions,
  QueryVectorsResponse,

  // Response wrappers
  ApiResponse,
  SuccessResponse,
  ErrorResponse,
  VectorFetchParameters,
} from './lib/types'

// Errors
export {
  StorageVectorsError,
  StorageVectorsApiError,
  StorageVectorsUnknownError,
  StorageVectorsErrorCode,
  isStorageVectorsError,
} from './lib/errors'

// Fetch utilities (for custom implementations)
export type { Fetch, FetchOptions, RequestMethodType } from './lib/fetch'

// Helper utilities
export { resolveFetch, resolveResponse, isPlainObject, normalizeToFloat32, validateVectorDimension } from './lib/helpers'

// Constants
export { DEFAULT_HEADERS } from './lib/constants'
