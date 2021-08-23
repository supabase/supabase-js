import { get, post, put, remove } from './fetch'
import { Bucket } from './types'
import { DEFAULT_HEADERS } from './constants'

export class StorageBucketApi {
  protected url: string
  protected headers: { [key: string]: string }

  constructor(url: string, headers: { [key: string]: string } = {}) {
    this.url = url
    this.headers = { ...DEFAULT_HEADERS, ...headers }
  }

  /**
   * Retrieves the details of all Storage buckets within an existing product.
   */
  async listBuckets(): Promise<{ data: Bucket[] | null; error: Error | null }> {
    try {
      const data = await get(`${this.url}/bucket`, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Retrieves the details of an existing Storage bucket.
   *
   * @param id The unique identifier of the bucket you would like to retrieve.
   */
  async getBucket(id: string): Promise<{ data: Bucket | null; error: Error | null }> {
    try {
      const data = await get(`${this.url}/bucket/${id}`, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Creates a new Storage bucket
   *
   * @param id A unique identifier for the bucket you are creating.
   * @returns newly created bucket id
   */
  async createBucket(
    id: string,
    options: { public: boolean } = { public: false }
  ): Promise<{ data: string | null; error: Error | null }> {
    try {
      const data = await post(
        `${this.url}/bucket`,
        { id, name: id, public: options.public },
        { headers: this.headers }
      )
      return { data: data.name, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Updates a new Storage bucket
   *
   * @param id A unique identifier for the bucket you are creating.
   */
  async updateBucket(
    id: string,
    options: { public: boolean }
  ): Promise<{ data: { message: string } | null; error: Error | null }> {
    try {
      const data = await put(
        `${this.url}/bucket/${id}`,
        { id, name: id, public: options.public },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Removes all objects inside a single bucket.
   *
   * @param id The unique identifier of the bucket you would like to empty.
   */
  async emptyBucket(
    id: string
  ): Promise<{ data: { message: string } | null; error: Error | null }> {
    try {
      const data = await post(`${this.url}/bucket/${id}/empty`, {}, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Deletes an existing bucket. A bucket can't be deleted with existing objects inside it.
   * You must first `empty()` the bucket.
   *
   * @param id The unique identifier of the bucket you would like to delete.
   */
  async deleteBucket(
    id: string
  ): Promise<{ data: { message: string } | null; error: Error | null }> {
    try {
      const data = await remove(`${this.url}/bucket/${id}`, {}, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }
}
