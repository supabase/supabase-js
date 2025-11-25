import { DEFAULT_HEADERS } from './constants'
import { isStorageVectorsError } from './errors'
import { Fetch, post } from './fetch'
import { resolveFetch } from './helpers'
import {
  ApiResponse,
  VectorBucket,
  ListVectorBucketsOptions,
  ListVectorBucketsResponse,
} from './types'

/**
 * @hidden
 * Base implementation for vector bucket operations.
 * Use {@link StorageVectorsClient} via `supabase.storage.vectors` instead.
 */
export default class VectorBucketApi {
  protected url: string
  protected headers: { [key: string]: string }
  protected fetch: Fetch
  protected shouldThrowOnError = false

  /** Creates a new VectorBucketApi instance */
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

  /** Creates a new vector bucket */
  async createBucket(vectorBucketName: string): Promise<ApiResponse<undefined>> {
    try {
      const data = await post(
        this.fetch,
        `${this.url}/CreateVectorBucket`,
        { vectorBucketName },
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

  /** Retrieves metadata for a specific vector bucket */
  async getBucket(vectorBucketName: string): Promise<ApiResponse<{ vectorBucket: VectorBucket }>> {
    try {
      const data = await post(
        this.fetch,
        `${this.url}/GetVectorBucket`,
        { vectorBucketName },
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

  /** Lists vector buckets with optional filtering and pagination */
  async listBuckets(
    options: ListVectorBucketsOptions = {}
  ): Promise<ApiResponse<ListVectorBucketsResponse>> {
    try {
      const data = await post(this.fetch, `${this.url}/ListVectorBuckets`, options, {
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

  /** Deletes a vector bucket (must be empty first) */
  async deleteBucket(vectorBucketName: string): Promise<ApiResponse<undefined>> {
    try {
      const data = await post(
        this.fetch,
        `${this.url}/DeleteVectorBucket`,
        { vectorBucketName },
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
