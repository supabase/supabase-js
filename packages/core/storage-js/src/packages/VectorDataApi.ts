import { DEFAULT_HEADERS } from '../lib/constants'
import { StorageError } from '../lib/common/errors'
import { Fetch, post } from '../lib/common/fetch'
import BaseApiClient from '../lib/common/BaseApiClient'
import {
  ApiResponse,
  PutVectorsOptions,
  GetVectorsOptions,
  GetVectorsResponse,
  DeleteVectorsOptions,
  ListVectorsOptions,
  ListVectorsResponse,
  QueryVectorsOptions,
  QueryVectorsResponse,
} from '../lib/types'

/**
 * @hidden
 * Base implementation for vector data operations.
 * Use {@link VectorIndexScope} via `supabase.storage.vectors.from('bucket').index('idx')` instead.
 */
export default class VectorDataApi extends BaseApiClient<StorageError> {
  /** Creates a new VectorDataApi instance */
  constructor(url: string, headers: { [key: string]: string } = {}, fetch?: Fetch) {
    const finalUrl = url.replace(/\/$/, '')
    const finalHeaders = { ...DEFAULT_HEADERS, 'Content-Type': 'application/json', ...headers }
    super(finalUrl, finalHeaders, fetch, 'vectors')
  }

  /** Inserts or updates vectors in batch (1-500 per request) */
  async putVectors(options: PutVectorsOptions): Promise<ApiResponse<undefined>> {
    // Validate batch size
    if (options.vectors.length < 1 || options.vectors.length > 500) {
      throw new Error('Vector batch size must be between 1 and 500 items')
    }

    return this.handleOperation(async () => {
      const data = await post(this.fetch, `${this.url}/PutVectors`, options, {
        headers: this.headers,
      })
      return data || {}
    })
  }

  /** Retrieves vectors by their keys in batch */
  async getVectors(options: GetVectorsOptions): Promise<ApiResponse<GetVectorsResponse>> {
    return this.handleOperation(async () => {
      return await post(this.fetch, `${this.url}/GetVectors`, options, {
        headers: this.headers,
      })
    })
  }

  /** Lists vectors in an index with pagination */
  async listVectors(options: ListVectorsOptions): Promise<ApiResponse<ListVectorsResponse>> {
    // Validate segment configuration
    if (options.segmentCount !== undefined) {
      if (options.segmentCount < 1 || options.segmentCount > 16) {
        throw new Error('segmentCount must be between 1 and 16')
      }
      if (options.segmentIndex !== undefined) {
        if (options.segmentIndex < 0 || options.segmentIndex >= options.segmentCount) {
          throw new Error(`segmentIndex must be between 0 and ${options.segmentCount - 1}`)
        }
      }
    }

    return this.handleOperation(async () => {
      return await post(this.fetch, `${this.url}/ListVectors`, options, {
        headers: this.headers,
      })
    })
  }

  /** Queries for similar vectors using approximate nearest neighbor search */
  async queryVectors(options: QueryVectorsOptions): Promise<ApiResponse<QueryVectorsResponse>> {
    return this.handleOperation(async () => {
      return await post(this.fetch, `${this.url}/QueryVectors`, options, {
        headers: this.headers,
      })
    })
  }

  /** Deletes vectors by their keys in batch (1-500 per request) */
  async deleteVectors(options: DeleteVectorsOptions): Promise<ApiResponse<undefined>> {
    // Validate batch size
    if (options.keys.length < 1 || options.keys.length > 500) {
      throw new Error('Keys batch size must be between 1 and 500 items')
    }

    return this.handleOperation(async () => {
      const data = await post(this.fetch, `${this.url}/DeleteVectors`, options, {
        headers: this.headers,
      })
      return data || {}
    })
  }
}
