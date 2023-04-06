import { DEFAULT_HEADERS } from '../lib/constants'
import { isStorageError, StorageError } from '../lib/errors'
import { Fetch, get, post, put, remove } from '../lib/fetch'
import { resolveFetch } from '../lib/helpers'
import { Bucket } from '../lib/types'

export default class StorageBucketApi {
  protected url: string
  protected headers: { [key: string]: string }
  protected fetch: Fetch

  constructor(url: string, headers: { [key: string]: string } = {}, fetch?: Fetch) {
    this.url = url
    this.headers = { ...DEFAULT_HEADERS, ...headers }
    this.fetch = resolveFetch(fetch)
  }

  /**
   * Retrieves the details of all Storage buckets within an existing project.
   */
  async listBuckets(): Promise<
    | {
        data: Bucket[]
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const data = await get(this.fetch, `${this.url}/bucket`, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Retrieves the details of an existing Storage bucket.
   *
   * @param id The unique identifier of the bucket you would like to retrieve.
   */
  async getBucket(
    id: string
  ): Promise<
    | {
        data: Bucket
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const data = await get(this.fetch, `${this.url}/bucket/${id}`, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Creates a new Storage bucket
   *
   * @param id A unique identifier for the bucket you are creating.
   * @param options.public The visibility of the bucket. Public buckets don't require an authorization token to download objects, but still require a valid token for all other operations. By default, buckets are private.
   * @param options.fileSizeLimit specifies the file size limit that this bucket can accept during upload
   * @param options.allowedMimeTypes specifies the allowed mime types that this bucket can accept during upload
   * @returns newly created bucket id
   */
  async createBucket(
    id: string,
    options: { public: boolean; fileSizeLimit?: number | string; allowedMimeTypes?: string[] } = {
      public: false,
    }
  ): Promise<
    | {
        data: Pick<Bucket, 'name'>
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const data = await post(
        this.fetch,
        `${this.url}/bucket`,
        {
          id,
          name: id,
          public: options.public,
          file_size_limit: options.fileSizeLimit,
          allowed_mime_types: options.allowedMimeTypes,
        },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Updates a Storage bucket
   *
   * @param id A unique identifier for the bucket you are updating.
   * @param options.public The visibility of the bucket. Public buckets don't require an authorization token to download objects, but still require a valid token for all other operations.
   * @param options.fileSizeLimit specifies the file size limit that this bucket can accept during upload
   * @param options.allowedMimeTypes specifies the allowed mime types that this bucket can accept during upload
   */
  async updateBucket(
    id: string,
    options: { public: boolean; fileSizeLimit?: number | string; allowedMimeTypes?: string[] }
  ): Promise<
    | {
        data: { message: string }
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const data = await put(
        this.fetch,
        `${this.url}/bucket/${id}`,
        {
          id,
          name: id,
          public: options.public,
          file_size_limit: options.fileSizeLimit,
          allowed_mime_types: options.allowedMimeTypes,
        },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Removes all objects inside a single bucket.
   *
   * @param id The unique identifier of the bucket you would like to empty.
   */
  async emptyBucket(
    id: string
  ): Promise<
    | {
        data: { message: string }
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const data = await post(
        this.fetch,
        `${this.url}/bucket/${id}/empty`,
        {},
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
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
  ): Promise<
    | {
        data: { message: string }
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const data = await remove(
        this.fetch,
        `${this.url}/bucket/${id}`,
        {},
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }
}
