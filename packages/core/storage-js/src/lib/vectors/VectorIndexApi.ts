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
 * @alpha
 *
 * Options for creating a vector index
 *
 * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
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
 * @hidden
 * Base implementation for vector index operations.
 * Use {@link VectorBucketScope} via `supabase.storage.vectors.from('bucket')` instead.
 */
export default class VectorIndexApi {
  protected url: string
  protected headers: { [key: string]: string }
  protected fetch: Fetch
  protected shouldThrowOnError = false

  /** Creates a new VectorIndexApi instance */
  constructor(url: string, headers: { [key: string]: string } = {}, fetch?: Fetch) {
    this.url = url.replace(/\/$/, '')
    this.headers = { ...DEFAULT_HEADERS, ...headers }
    this.fetch = resolveFetch(fetch)
  }

  /** Enable throwing errors instead of returning them in the response */
  public throwOnError(): this {
    this.shouldThrowOnError = true
    return this
  }

  /** Creates a new vector index within a bucket */
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

  /** Retrieves metadata for a specific vector index */
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

  /** Lists vector indexes within a bucket with optional filtering and pagination */
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

  /** Deletes a vector index and all its data */
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
