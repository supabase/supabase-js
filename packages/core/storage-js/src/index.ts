export { StorageClient } from './StorageClient'
export type { StorageClientOptions } from './StorageClient'
export { default as StorageAnalyticsClient } from './packages/StorageAnalyticsClient'

// Vector Storage
export {
  StorageVectorsClient,
  VectorBucketScope,
  VectorIndexScope,
} from './packages/StorageVectorsClient'
export type { StorageVectorsClientOptions } from './packages/StorageVectorsClient'
export { default as VectorBucketApi } from './packages/VectorBucketApi'
export { default as VectorDataApi } from './packages/VectorDataApi'
export { default as VectorIndexApi } from './packages/VectorIndexApi'
export type { CreateIndexOptions } from './packages/VectorIndexApi'

// Types and Errors
export * from './lib/types'
export * from './lib/common/errors'
