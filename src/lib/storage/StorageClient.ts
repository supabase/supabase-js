import { get, post, put, remove } from './fetch'
import { isBrowser } from './helpers'
import { Bucket, FileObject, SearchOptions } from './types'

const DEFAULT_SEARCH_OPTIONS = {
  prefix: '',
  limit: 0,
  offset: 0,
  sortBy: {
    column: 'name',
    order: 'asc',
  },
}

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
  ): Promise<{ data: { Key: string } | null; error: Error | null }> {
    try {
      if (!isBrowser()) throw new Error('No browser detected.')

      const body = new FormData()
      body.append('cacheControl', '3600')
      body.append('', file, file.name)
      const data = await post(`${this.url}/object/${path}`, body, { headers: this.headers })
      return { data, error: null }
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

      const body = new FormData()
      body.append('cacheControl', '3600')
      body.append('', file, file.name)
      const data = await put(`${this.url}/object/${path}`, body, { headers: this.headers })
      return { data, error: null }
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
      const headers = {
        ...this.headers,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }
      const data = await get(`${this.url}/object/${path}`, { headers })
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

  async search(
    folderName: string,
    options?: SearchOptions
  ): Promise<{ data: FileObject[] | null; error: Error | null }> {
    try {
      const body = { ...DEFAULT_SEARCH_OPTIONS, ...options }
      const data = await post(`${this.url}/search/${folderName}`, body, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }
}
