import { DEFAULT_HEADERS } from '../lib/constants'
import { StorageError } from '../lib/common/errors'
import { Fetch, post } from '../lib/common/fetch'
import BaseApiClient from '../lib/common/BaseApiClient'
import {
  ApiResponse,
  VectorBucket,
  ListVectorBucketsOptions,
  ListVectorBucketsResponse,
} from '../lib/types'

/**
 * @hidden
 * Base implementation for vector bucket operations.
 * Use {@link StorageVectorsClient} via `supabase.storage.vectors` instead.
 */
export default class VectorBucketApi extends BaseApiClient<StorageError> {
  /** Creates a new VectorBucketApi instance */
  constructor(url: string, headers: { [key: string]: string } = {}, fetch?: Fetch) {
    const finalUrl = url.replace(/\/$/, '')
    const finalHeaders = { ...DEFAULT_HEADERS, 'Content-Type': 'application/json', ...headers }
    super(finalUrl, finalHeaders, fetch, 'vectors')
  }

  /** Creates a new vector bucket */
  async createBucket(vectorBucketName: string): Promise<ApiResponse<undefined>> {
    return this.handleOperation(async () => {
      const data = await post(
        this.fetch,
        `${this.url}/CreateVectorBucket`,
        { vectorBucketName },
        { headers: this.headers }
      )
      return data || {}
    })
  }

  /** Retrieves metadata for a specific vector bucket */
  async getBucket(vectorBucketName: string): Promise<ApiResponse<{ vectorBucket: VectorBucket }>> {
    return this.handleOperation(async () => {
      return await post(
        this.fetch,
        `${this.url}/GetVectorBucket`,
        { vectorBucketName },
        { headers: this.headers }
      )
    })
  }

  /** Lists vector buckets with optional filtering and pagination */
  async listBuckets(
    options: ListVectorBucketsOptions = {}
  ): Promise<ApiResponse<ListVectorBucketsResponse>> {
    return this.handleOperation(async () => {
      return await post(this.fetch, `${this.url}/ListVectorBuckets`, options, {
        headers: this.headers,
      })
    })
  }

  /** Deletes a vector bucket (must be empty first) */
  async deleteBucket(vectorBucketName: string): Promise<ApiResponse<undefined>> {
    return this.handleOperation(async () => {
      const data = await post(
        this.fetch,
        `${this.url}/DeleteVectorBucket`,
        { vectorBucketName },
        { headers: this.headers }
      )
      return data || {}
    })
  }
}
