import { get, post, remove } from './fetch'
import { Bucket } from './types'

export class StorageClient {
  url: string
  headers: { [key: string]: string }

  constructor(url: string, headers: { [key: string]: string } = {}) {
    this.url = url
    this.headers = headers
  }

  /**
   * Gets all buckets
   */
  async getAllBuckets(): Promise<{ data: Bucket[] | null; error: Error | null }> {
    try {
      const data = await get(`${this.url}/bucket`, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Get details of a bucket
   * @param id the bucket id to retrieve
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
   * Create a bucket
   * @param name the new bucket name
   */
  async createBucket(name: string): Promise<{ data: Bucket | null; error: Error | null }> {
    try {
      const data = await post(`${this.url}/bucket`, { name }, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Delete a bucket
   * @param id the bucket id to delete
   */
  async deleteBucket(id: string): Promise<{ data: Bucket | null; error: Error | null }> {
    try {
      const data = await remove(`${this.url}/bucket/${id}`, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }
}
