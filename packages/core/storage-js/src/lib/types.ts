import { StorageError } from './common/errors'

/**
 * Type of storage bucket
 * - STANDARD: Regular file storage buckets
 * - ANALYTICS: Iceberg table-based buckets for analytical workloads
 */
export type BucketType = 'STANDARD' | 'ANALYTICS'

export interface Bucket {
  id: string
  type?: BucketType
  name: string
  owner: string
  file_size_limit?: number
  allowed_mime_types?: string[]
  created_at: string
  updated_at: string
  public: boolean
}

export interface ListBucketOptions {
  limit?: number
  offset?: number
  sortColumn?: 'id' | 'name' | 'created_at' | 'updated_at'
  sortOrder?: 'asc' | 'desc'
  search?: string
}

/**
 * Represents an Analytics Bucket using Apache Iceberg table format.
 * Analytics buckets are optimized for analytical queries and data processing.
 */
export interface AnalyticBucket {
  /** Unique identifier for the bucket */
  name: string
  /** Bucket type - always 'ANALYTICS' for analytics buckets */
  type: 'ANALYTICS'
  /** Storage format used (e.g., 'iceberg') */
  format: string
  /** ISO 8601 timestamp of bucket creation */
  created_at: string
  /** ISO 8601 timestamp of last update */
  updated_at: string
}

export interface FileObject {
  name: string
  bucket_id: string
  owner: string
  id: string
  updated_at: string
  created_at: string
  /** @deprecated */
  last_accessed_at: string
  metadata: Record<string, any>
  buckets: Bucket
}

export interface FileObjectV2 {
  id: string
  version: string
  name: string
  bucket_id: string
  updated_at: string
  created_at: string
  /** @deprecated */
  last_accessed_at: string
  size?: number
  cache_control?: string
  content_type?: string
  etag?: string
  last_modified?: string
  metadata?: Record<string, any>
}

export interface SortBy {
  column?: string
  order?: string
}

export interface FileOptions {
  /**
   * The number of seconds the asset is cached in the browser and in the Supabase CDN. This is set in the `Cache-Control: max-age=<seconds>` header. Defaults to 3600 seconds.
   */
  cacheControl?: string
  /**
   * the `Content-Type` header value. Should be specified if using a `fileBody` that is neither `Blob` nor `File` nor `FormData`, otherwise will default to `text/plain;charset=UTF-8`.
   */
  contentType?: string
  /**
   * When upsert is set to true, the file is overwritten if it exists. When set to false, an error is thrown if the object already exists. Defaults to false.
   */
  upsert?: boolean
  /**
   * The duplex option is a string parameter that enables or disables duplex streaming, allowing for both reading and writing data in the same stream. It can be passed as an option to the fetch() method.
   */
  duplex?: string

  /**
   * The metadata option is an object that allows you to store additional information about the file. This information can be used to filter and search for files. The metadata object can contain any key-value pairs you want to store.
   */
  metadata?: Record<string, any>

  /**
   * Optionally add extra headers
   */
  headers?: Record<string, string>
}

export interface DestinationOptions {
  destinationBucket?: string
}

export interface SearchOptions {
  /**
   * The number of files you want to be returned.
   * @default 100
   */
  limit?: number

  /**
   * The starting position.
   */
  offset?: number

  /**
   * The column to sort by. Can be any column inside a FileObject.
   */
  sortBy?: SortBy

  /**
   * The search string to filter files by.
   */
  search?: string
}

export interface SortByV2 {
  column: 'name' | 'updated_at' | 'created_at'
  order?: 'asc' | 'desc'
}

export interface SearchV2Options {
  /**
   * The number of files you want to be returned.
   * @default 1000
   */
  limit?: number

  /**
   * The prefix search string to filter files by.
   */
  prefix?: string

  /**
   * The cursor used for pagination. Pass the value received from nextCursor of the previous request.
   */
  cursor?: string

  /**
   * Whether to emulate a hierarchical listing of objects using delimiters.
   *
   * - When `false` (default), all objects are listed as flat key/value pairs.
   * - When `true`, the response groups objects by delimiter, making it appear
   *   like a file/folder hierarchy.
   *
   * @default false
   */
  with_delimiter?: boolean

  /**
   * The column and order to sort by
   * @default 'name asc'
   */
  sortBy?: SortByV2
}

export interface SearchV2Object {
  id: string
  key: string
  name: string
  updated_at: string
  created_at: string
  metadata: Record<string, any>
  /**
   * @deprecated
   */
  last_accessed_at: string
}

export type SearchV2Folder = Omit<SearchV2Object, 'id' | 'metadata' | 'last_accessed_at'>

export interface SearchV2Result {
  hasNext: boolean
  folders: SearchV2Folder[]
  objects: SearchV2Object[]
  nextCursor?: string
}

export interface FetchParameters {
  /**
   * Pass in an AbortController's signal to cancel the request.
   */
  signal?: AbortSignal
}

// TODO: need to check for metadata props. The api swagger doesnt have.
export interface Metadata {
  name: string
}

export interface TransformOptions {
  /**
   * The width of the image in pixels.
   */
  width?: number
  /**
   * The height of the image in pixels.
   */
  height?: number
  /**
   * The resize mode can be cover, contain or fill. Defaults to cover.
   * Cover resizes the image to maintain it's aspect ratio while filling the entire width and height.
   * Contain resizes the image to maintain it's aspect ratio while fitting the entire image within the width and height.
   * Fill resizes the image to fill the entire width and height. If the object's aspect ratio does not match the width and height, the image will be stretched to fit.
   */
  resize?: 'cover' | 'contain' | 'fill'
  /**
   * Set the quality of the returned image.
   * A number from 20 to 100, with 100 being the highest quality.
   * Defaults to 80
   */
  quality?: number
  /**
   * Specify the format of the image requested.
   *
   * When using 'origin' we force the format to be the same as the original image.
   * When this option is not passed in, images are optimized to modern image formats like Webp.
   */
  format?: 'origin'
}

type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
  : S

export type Camelize<T> = {
  [K in keyof T as CamelCase<Extract<K, string>>]: T[K]
}

export type DownloadResult<T> =
  | {
      data: T
      error: null
    }
  | {
      data: null
      error: StorageError
    }
// ============================================================================
// VECTOR STORAGE TYPES
// ============================================================================

/**
 * Configuration for encryption at rest
 * @property kmsKeyArn - ARN of the KMS key used for encryption
 * @property sseType - Server-side encryption type (e.g., 'KMS')
 */
export interface EncryptionConfiguration {
  kmsKeyArn?: string
  sseType?: string
}

/**
 * Vector bucket metadata
 * @property vectorBucketName - Unique name of the vector bucket
 * @property creationTime - Unix timestamp of when the bucket was created
 * @property encryptionConfiguration - Optional encryption settings
 */
export interface VectorBucket {
  vectorBucketName: string
  creationTime?: number
  encryptionConfiguration?: EncryptionConfiguration
}

/**
 * Metadata configuration for vector index
 * Defines which metadata keys should not be indexed for filtering
 * @property nonFilterableMetadataKeys - Array of metadata keys that cannot be used in filters
 */
export interface MetadataConfiguration {
  nonFilterableMetadataKeys?: string[]
}

/**
 * Supported data types for vectors
 * Currently only float32 is supported
 */
export type VectorDataType = 'float32'

/**
 * Distance metrics for vector similarity search
 */
export type DistanceMetric = 'cosine' | 'euclidean' | 'dotproduct'

/**
 * Vector index configuration and metadata
 * @property indexName - Unique name of the index within the bucket
 * @property vectorBucketName - Name of the parent vector bucket
 * @property dataType - Data type of vector components (currently only 'float32')
 * @property dimension - Dimensionality of vectors (e.g., 384, 768, 1536)
 * @property distanceMetric - Similarity metric used for queries
 * @property metadataConfiguration - Configuration for metadata filtering
 * @property creationTime - Unix timestamp of when the index was created
 */
export interface VectorIndex {
  indexName: string
  vectorBucketName: string
  dataType: VectorDataType
  dimension: number
  distanceMetric: DistanceMetric
  metadataConfiguration?: MetadataConfiguration
  creationTime?: number
}

/**
 * Vector data representation
 * Vectors must be float32 arrays with dimensions matching the index
 * @property float32 - Array of 32-bit floating point numbers
 */
export interface VectorData {
  float32: number[]
}

/**
 * Arbitrary JSON metadata attached to vectors
 * Keys configured as non-filterable in the index can be stored but not queried
 */
export type VectorMetadata = Record<string, any>

/**
 * Single vector object for insertion/update
 * @property key - Unique identifier for the vector
 * @property data - Vector embedding data
 * @property metadata - Optional arbitrary metadata
 */
export interface VectorObject {
  key: string
  data: VectorData
  metadata?: VectorMetadata
}

/**
 * Vector object returned from queries with optional distance
 * @property key - Unique identifier for the vector
 * @property data - Vector embedding data (if requested)
 * @property metadata - Arbitrary metadata (if requested)
 * @property distance - Similarity distance from query vector (if requested)
 */
export interface VectorMatch {
  key: string
  data?: VectorData
  metadata?: VectorMetadata
  distance?: number
}

/**
 * Options for fetching vector buckets
 * @property prefix - Filter buckets by name prefix
 * @property maxResults - Maximum number of results to return (default: 100)
 * @property nextToken - Token for pagination from previous response
 */
export interface ListVectorBucketsOptions {
  prefix?: string
  maxResults?: number
  nextToken?: string
}

/**
 * Response from listing vector buckets
 * @property vectorBuckets - Array of bucket names
 * @property nextToken - Token for fetching next page (if more results exist)
 */
export interface ListVectorBucketsResponse {
  vectorBuckets: { vectorBucketName: string }[]
  nextToken?: string
}

/**
 * Options for listing indexes within a bucket
 * @property vectorBucketName - Name of the parent vector bucket
 * @property prefix - Filter indexes by name prefix
 * @property maxResults - Maximum number of results to return (default: 100)
 * @property nextToken - Token for pagination from previous response
 */
export interface ListIndexesOptions {
  vectorBucketName: string
  prefix?: string
  maxResults?: number
  nextToken?: string
}

/**
 * Response from listing indexes
 * @property indexes - Array of index names
 * @property nextToken - Token for fetching next page (if more results exist)
 */
export interface ListIndexesResponse {
  indexes: { indexName: string }[]
  nextToken?: string
}

/**
 * Options for batch reading vectors
 * @property vectorBucketName - Name of the vector bucket
 * @property indexName - Name of the index
 * @property keys - Array of vector keys to retrieve
 * @property returnData - Whether to include vector data in response
 * @property returnMetadata - Whether to include metadata in response
 */
export interface GetVectorsOptions {
  vectorBucketName: string
  indexName: string
  keys: string[]
  returnData?: boolean
  returnMetadata?: boolean
}

/**
 * Response from getting vectors
 * @property vectors - Array of retrieved vector objects
 */
export interface GetVectorsResponse {
  vectors: VectorMatch[]
}

/**
 * Options for batch inserting/updating vectors
 * @property vectorBucketName - Name of the vector bucket
 * @property indexName - Name of the index
 * @property vectors - Array of vectors to insert/upsert (1-500 items)
 */
export interface PutVectorsOptions {
  vectorBucketName: string
  indexName: string
  vectors: VectorObject[]
}

/**
 * Options for batch deleting vectors
 * @property vectorBucketName - Name of the vector bucket
 * @property indexName - Name of the index
 * @property keys - Array of vector keys to delete (1-500 items)
 */
export interface DeleteVectorsOptions {
  vectorBucketName: string
  indexName: string
  keys: string[]
}

/**
 * Options for listing/scanning vectors in an index
 * Supports parallel scanning via segment configuration
 * @property vectorBucketName - Name of the vector bucket
 * @property indexName - Name of the index
 * @property maxResults - Maximum number of results to return (default: 500, max: 1000)
 * @property nextToken - Token for pagination from previous response
 * @property returnData - Whether to include vector data in response
 * @property returnMetadata - Whether to include metadata in response
 * @property segmentCount - Total number of parallel segments (1-16)
 * @property segmentIndex - Zero-based index of this segment (0 to segmentCount-1)
 */
export interface ListVectorsOptions {
  vectorBucketName: string
  indexName: string
  maxResults?: number
  nextToken?: string
  returnData?: boolean
  returnMetadata?: boolean
  segmentCount?: number
  segmentIndex?: number
}

/**
 * Response from listing vectors
 * @property vectors - Array of vector objects
 * @property nextToken - Token for fetching next page (if more results exist)
 */
export interface ListVectorsResponse {
  vectors: VectorMatch[]
  nextToken?: string
}

/**
 * JSON filter expression for metadata filtering
 * Format and syntax depend on the S3 Vectors service implementation
 */
export type VectorFilter = Record<string, any>

/**
 * Options for querying similar vectors (ANN search)
 * @property vectorBucketName - Name of the vector bucket
 * @property indexName - Name of the index
 * @property queryVector - Query vector to find similar vectors
 * @property topK - Number of nearest neighbors to return (default: 10)
 * @property filter - Optional JSON filter for metadata
 * @property returnDistance - Whether to include distance scores
 * @property returnMetadata - Whether to include metadata in results
 */
export interface QueryVectorsOptions {
  vectorBucketName: string
  indexName: string
  queryVector: VectorData
  topK?: number
  filter?: VectorFilter
  returnDistance?: boolean
  returnMetadata?: boolean
}

/**
 * Response from vector similarity query
 * @property vectors - Array of similar vectors ordered by distance
 * @property distanceMetric - The distance metric used for the similarity search
 */
export interface QueryVectorsResponse {
  vectors: VectorMatch[]
  distanceMetric?: DistanceMetric
}

/**
 * Fetch-specific parameters like abort signals
 * @property signal - AbortSignal for cancelling requests
 */
export interface VectorFetchParameters {
  signal?: AbortSignal
}

/**
 * Standard response wrapper for successful operations
 * @property data - Response data of type T
 * @property error - Null on success
 */
export interface SuccessResponse<T> {
  data: T
  error: null
}

/**
 * Standard response wrapper for failed operations
 * @property data - Null on error
 * @property error - StorageError with details (named StorageVectorsError for vector operations)
 */
export interface ErrorResponse {
  data: null
  error: StorageError
}

/**
 * Union type for all API responses
 * Follows the pattern: { data: T, error: null } | { data: null, error: Error }
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse
