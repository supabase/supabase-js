import { get, post, put, remove } from './fetch'
import { isBrowser } from './helpers'
import { Bucket, FileObject, Metadata, SearchOptions } from './types'

const DEFAULT_SEARCH_OPTIONS = {
  limit: 0,
  offset: 0,
  sortBy: {
    column: 'name',
    order: 'asc',
  },
}

export class StorageApi {
  url: string
  headers: { [key: string]: string }

  constructor(url: string, headers: { [key: string]: string } = {}) {
    this.url = url
    this.headers = headers
  }

  /**
   * Gets all buckets details
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
   * Empty a bucket
   * @param id the bucket id to empty
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
   * Delete a bucket
   * @param id the bucket id to be deleted
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

  /**
   * Upload a file
   * @param path the relative file path
   * @param file the File content
   */
  async uploadFile(
    path: string,
    file: File
  ): Promise<{ data: { message: string } | null; error: Error | null }> {
    try {
      if (!isBrowser()) throw new Error('No browser detected.')

      const formData = new FormData()
      formData.append('cacheControl', '3600')
      formData.append('', file, file.name)

      const res = await fetch(`${this.url}/object/${path}`, {
        method: 'POST',
        body: formData,
        headers: { ...this.headers },
      })

      if (res.ok) {
        const data = await res.json()
        return { data, error: null }
      } else {
        const error = await res.json()
        return { data: null, error }
      }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Update a file
   * @param path the relative file path
   * @param file the File content
   */
  async updateFile(
    path: string,
    file: File
  ): Promise<{ data: { Key: string } | null; error: Error | null }> {
    try {
      if (!isBrowser()) throw new Error('No browser detected.')

      const formData = new FormData()
      formData.append('cacheControl', '3600')
      formData.append('', file, file.name)

      const res = await fetch(`${this.url}/object/${path}`, {
        method: 'PUT',
        body: formData,
        headers: { ...this.headers },
      })

      if (res.ok) {
        const data = await res.json()
        return { data, error: null }
      } else {
        const error = await res.json()
        return { data: null, error }
      }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Rename a file
   * @param bucketName
   * @param fromPath original relative file path
   * @param toPath the new relative file path
   */
  async renameFile(
    bucketName: string,
    fromPath: string,
    toPath: string
  ): Promise<{ data: { message: string } | null; error: Error | null }> {
    try {
      const data = await post(
        `${this.url}/object/rename`,
        { bucketName, sourceKey: fromPath, destinationKey: toPath },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Create signed url to download file
   * @param path the relative file path to be downloaded
   * @param expiresIn seconds until the signed URL expires
   */
  async createSignedUrl(
    path: string,
    expiresIn: number
  ): Promise<{ data: { signedURL: string } | null; error: Error | null }> {
    try {
      const data = await post(
        `${this.url}/object/sign/${path}`,
        { expiresIn },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Download a file
   * @param path the relative file path to be downloaded
   */
  async downloadFile(path: string): Promise<{ data: Blob | null; error: Error | null }> {
    try {
      const res = await get(`${this.url}/object/${path}`, {
        headers: this.headers,
        noResolveJson: true,
      })
      const data = await res.blob()
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Delete a file
   * @param path the relative file path to be deleted
   */
  async deleteFile(
    path: string
  ): Promise<{ data: { message: string } | null; error: Error | null }> {
    try {
      const data = await remove(`${this.url}/object/${path}`, {}, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Delete multiple files on the same bucket
   * @param bucketName
   * @param paths the relative file paths to be deleted excluded the bucket name
   */
  async deleteFiles(
    bucketName: string,
    paths: string[]
  ): Promise<{ data: FileObject[] | null; error: Error | null }> {
    try {
      const data = await remove(
        `${this.url}/object/${bucketName}`,
        { prefixes: paths },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * TODO: need more test. get 404 error with staging
   * Get file metadata
   * @param id the file id to retrieve metadata
   */
  async getMetadata(id: string): Promise<{ data: Metadata | null; error: Error | null }> {
    try {
      const data = await get(`${this.url}/metadata/${id}`, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * TODO: need test.
   * Update file metadata
   * @param id the file id to update metadata
   * @param meta the new file metadata
   */
  async updateMetadata(
    id: string,
    meta: Metadata
  ): Promise<{ data: Metadata | null; error: Error | null }> {
    try {
      const data = await post(`${this.url}/metadata/${id}`, { ...meta }, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Use to fetch folder contents
   * @param bucketName
   * @param path the relative folder path excluded the bucket name
   * @param options
   */
  async search(
    bucketName: string,
    path?: string,
    options?: SearchOptions
  ): Promise<{ data: FileObject[] | null; error: Error | null }> {
    try {
      const body = { ...DEFAULT_SEARCH_OPTIONS, ...options, prefix: path || '' }
      const data = await post(`${this.url}/search/${bucketName}`, body, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }
}
