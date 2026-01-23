import { DEFAULT_HEADERS } from '../lib/constants'
import { StorageError } from '../lib/common/errors'
import { Fetch, post } from '../lib/common/fetch'
import BaseApiClient from '../lib/common/BaseApiClient'
import {
  ApiResponse,
  VectorIndex,
  ListIndexesOptions,
  ListIndexesResponse,
  VectorDataType,
  DistanceMetric,
  MetadataConfiguration,
} from '../lib/types'

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
export default class VectorIndexApi extends BaseApiClient<StorageError> {
  /** Creates a new VectorIndexApi instance */
  constructor(url: string, headers: { [key: string]: string } = {}, fetch?: Fetch) {
    const finalUrl = url.replace(/\/$/, '')
    const finalHeaders = { ...DEFAULT_HEADERS, 'Content-Type': 'application/json', ...headers }
    super(finalUrl, finalHeaders, fetch, 'vectors')
  }

  /** Creates a new vector index within a bucket */
  async createIndex(options: CreateIndexOptions): Promise<ApiResponse<undefined>> {
    return this.handleOperation(async () => {
      const data = await post(this.fetch, `${this.url}/CreateIndex`, options, {
        headers: this.headers,
      })
      return data || {}
    })
  }

  /** Retrieves metadata for a specific vector index */
  async getIndex(
    vectorBucketName: string,
    indexName: string
  ): Promise<ApiResponse<{ index: VectorIndex }>> {
    return this.handleOperation(async () => {
      return await post(
        this.fetch,
        `${this.url}/GetIndex`,
        { vectorBucketName, indexName },
        { headers: this.headers }
      )
    })
  }

  /** Lists vector indexes within a bucket with optional filtering and pagination */
  async listIndexes(options: ListIndexesOptions): Promise<ApiResponse<ListIndexesResponse>> {
    return this.handleOperation(async () => {
      return await post(this.fetch, `${this.url}/ListIndexes`, options, {
        headers: this.headers,
      })
    })
  }

  /** Deletes a vector index and all its data */
  async deleteIndex(vectorBucketName: string, indexName: string): Promise<ApiResponse<undefined>> {
    return this.handleOperation(async () => {
      const data = await post(
        this.fetch,
        `${this.url}/DeleteIndex`,
        { vectorBucketName, indexName },
        { headers: this.headers }
      )
      return data || {}
    })
  }
}
