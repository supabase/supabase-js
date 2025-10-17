import { DEFAULT_HEADERS } from './constants'
import { isStorageVectorsError } from './errors'
import { Fetch, post } from './fetch'
import { resolveFetch } from './helpers'
import {
  ApiResponse,
  VectorIndex,
  ListIndexesOptions,
  ListIndexesResponse,
  VectorDataType,
  DistanceMetric,
  MetadataConfiguration,
} from './types'

/**
 * Options for creating a vector index
 */
export interface CreateIndexOptions {
  vectorBucketName: string
  indexName: string
  dataType: VectorDataType
  dimension: number
  distanceMetric: DistanceMetric
  metadataConfiguration?: MetadataConfiguration
}

/**
 * API class for managing Vector Indexes within Vector Buckets
 * Provides methods for creating, reading, listing, and deleting vector indexes
 */
export default class VectorIndexApi {
  protected url: string
  protected headers: { [key: string]: string }
  protected fetch: Fetch
  protected shouldThrowOnError = false

  constructor(url: string, headers: { [key: string]: string } = {}, fetch?: Fetch) {
    this.url = url.replace(/\/$/, '')
    this.headers = { ...DEFAULT_HEADERS, ...headers }
    this.fetch = resolveFetch(fetch)
  }

  /**
   * Enable throwing errors instead of returning them in the response
   * When enabled, failed operations will throw instead of returning { data: null, error }
   *
   * @returns This instance for method chaining
   * @example
   * ```typescript
   * const client = new VectorIndexApi(url, headers)
   * client.throwOnError()
   * const { data } = await client.createIndex(options) // throws on error
   * ```
   */
  public throwOnError(): this {
    this.shouldThrowOnError = true
    return this
  }

  /**
   * Creates a new vector index within a bucket
   * Defines the schema for vectors including dimensionality, distance metric, and metadata config
   *
   * @param options - Index configuration
   * @param options.vectorBucketName - Name of the parent vector bucket
   * @param options.indexName - Unique name for the index within the bucket
   * @param options.dataType - Data type for vector components (currently only 'float32')
   * @param options.dimension - Dimensionality of vectors (e.g., 384, 768, 1536)
   * @param options.distanceMetric - Similarity metric ('cosine', 'euclidean', 'dotproduct')
   * @param options.metadataConfiguration - Optional config for non-filterable metadata keys
   * @returns Promise with empty response on success or error
   *
   * @throws {StorageVectorsApiError} With code:
   * - `S3VectorConflictException` if index already exists (HTTP 409)
   * - `S3VectorMaxIndexesExceeded` if quota exceeded (HTTP 400)
   * - `S3VectorNotFoundException` if bucket doesn't exist (HTTP 404)
   * - `InternalError` for server errors (HTTP 500)
   *
   * @example
   * ```typescript
   * const { data, error } = await client.createIndex({
   *   vectorBucketName: 'embeddings-prod',
   *   indexName: 'documents-openai-small',
   *   dataType: 'float32',
   *   dimension: 1536,
   *   distanceMetric: 'cosine',
   *   metadataConfiguration: {
   *     nonFilterableMetadataKeys: ['raw_text', 'internal_id']
   *   }
   * })
   * ```
   */
  async createIndex(options: CreateIndexOptions): Promise<ApiResponse<undefined>> {
    try {
      const data = await post(this.fetch, `${this.url}/CreateIndex`, options, {
        headers: this.headers,
      })
      return { data: data || {}, error: null }
    } catch (error) {
      if (this.shouldThrowOnError) {
        throw error
      }
      if (isStorageVectorsError(error)) {
        return { data: null, error }
      }
      throw error
    }
  }

  /**
   * Retrieves metadata for a specific vector index
   * Returns index configuration including dimension, distance metric, and metadata settings
   *
   * @param vectorBucketName - Name of the parent vector bucket
   * @param indexName - Name of the index to retrieve
   * @returns Promise with index metadata or error
   *
   * @throws {StorageVectorsApiError} With code:
   * - `S3VectorNotFoundException` if index or bucket doesn't exist (HTTP 404)
   * - `InternalError` for server errors (HTTP 500)
   *
   * @example
   * ```typescript
   * const { data, error } = await client.getIndex('embeddings-prod', 'documents-openai-small')
   * if (data) {
   *   console.log('Index dimension:', data.index.dimension)
   *   console.log('Distance metric:', data.index.distanceMetric)
   * }
   * ```
   */
  async getIndex(
    vectorBucketName: string,
    indexName: string
  ): Promise<ApiResponse<{ index: VectorIndex }>> {
    try {
      const data = await post(
        this.fetch,
        `${this.url}/GetIndex`,
        { vectorBucketName, indexName },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      if (this.shouldThrowOnError) {
        throw error
      }
      if (isStorageVectorsError(error)) {
        return { data: null, error }
      }
      throw error
    }
  }

  /**
   * Lists vector indexes within a bucket with optional filtering and pagination
   * Supports prefix-based filtering and paginated results
   *
   * @param options - Listing options
   * @param options.vectorBucketName - Name of the parent vector bucket
   * @param options.prefix - Filter indexes by name prefix
   * @param options.maxResults - Maximum results per page (default: 100)
   * @param options.nextToken - Pagination token from previous response
   * @returns Promise with list of indexes and pagination token
   *
   * @throws {StorageVectorsApiError} With code:
   * - `S3VectorNotFoundException` if bucket doesn't exist (HTTP 404)
   * - `InternalError` for server errors (HTTP 500)
   *
   * @example
   * ```typescript
   * // List all indexes in a bucket
   * const { data, error } = await client.listIndexes({
   *   vectorBucketName: 'embeddings-prod',
   *   prefix: 'documents-'
   * })
   * if (data) {
   *   console.log('Found indexes:', data.indexes.map(i => i.indexName))
   *   // Fetch next page if available
   *   if (data.nextToken) {
   *     const next = await client.listIndexes({
   *       vectorBucketName: 'embeddings-prod',
   *       nextToken: data.nextToken
   *     })
   *   }
   * }
   * ```
   */
  async listIndexes(options: ListIndexesOptions): Promise<ApiResponse<ListIndexesResponse>> {
    try {
      const data = await post(this.fetch, `${this.url}/ListIndexes`, options, {
        headers: this.headers,
      })
      return { data, error: null }
    } catch (error) {
      if (this.shouldThrowOnError) {
        throw error
      }
      if (isStorageVectorsError(error)) {
        return { data: null, error }
      }
      throw error
    }
  }

  /**
   * Deletes a vector index and all its data
   * This operation removes the index schema and all vectors stored in the index
   *
   * @param vectorBucketName - Name of the parent vector bucket
   * @param indexName - Name of the index to delete
   * @returns Promise with empty response on success or error
   *
   * @throws {StorageVectorsApiError} With code:
   * - `S3VectorNotFoundException` if index or bucket doesn't exist (HTTP 404)
   * - `InternalError` for server errors (HTTP 500)
   *
   * @example
   * ```typescript
   * // Delete an index and all its vectors
   * const { error } = await client.deleteIndex('embeddings-prod', 'old-index')
   * if (!error) {
   *   console.log('Index deleted successfully')
   * }
   * ```
   */
  async deleteIndex(vectorBucketName: string, indexName: string): Promise<ApiResponse<undefined>> {
    try {
      const data = await post(
        this.fetch,
        `${this.url}/DeleteIndex`,
        { vectorBucketName, indexName },
        { headers: this.headers }
      )
      return { data: data || {}, error: null }
    } catch (error) {
      if (this.shouldThrowOnError) {
        throw error
      }
      if (isStorageVectorsError(error)) {
        return { data: null, error }
      }
      throw error
    }
  }
}
