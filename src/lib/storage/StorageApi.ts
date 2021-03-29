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
   * Retrieves the details of an existing Storage bucket.
   *
   * @param name A name of the bucket you are creating.
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

  /**
   * Uploads a file to an existing bucket.
   *
   * @param path The relative file path including the bucket ID. Should be of the format `bucket/folder/subfolder`. The bucket already exist before attempting to upload.
   * @param file The File object to be stored in the bucket.
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
   * Replaces an existing file at the specified path with a new one.
   *
   * @param path The relative file path including the bucket ID. Should be of the format `bucket/folder/subfolder`. The bucket already exist before attempting to upload.
   * @param file The file object to be stored in the bucket.
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
   * Moves an existing file, optionally renaming it at the same time.
   *
   * @param bucketId The bucket which contains the file.
   * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
   * @param toPath The new file path, including the new file name. For example `folder/image-copy.png`.
   */
  async moveFile(
    bucketId: string,
    fromPath: string,
    toPath: string
  ): Promise<{ data: { message: string } | null; error: Error | null }> {
    try {
      const data = await post(
        `${this.url}/object/move`,
        { bucketId, sourceKey: fromPath, destinationKey: toPath },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Create signed url to download file.
   *
   * @param path The file path to be downloaded, including the current file name. For example `folder/image.png`.
   * @param expiresIn The number of seconds until the signed URL expires. For example, `60` for a URL which is valid for one minute.
   */
  async createSignedUrl(
    path: string,
    expiresIn: number
  ): Promise<{ data: { signedURL: string } | null; error: Error | null }> {
    try {
      let data = await post(
        `${this.url}/object/sign/${path}`,
        { expiresIn },
        { headers: this.headers }
      )
      const signedURL = `${this.url}${data.signedURL}`
      data = { ...data, signedURL }
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Downloads a file.
   *
   * @param path The file path to be downloaded, including the path and file name. For example `folder/image.png`.
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
   * Deletes a file.
   *
   * @param path The file path to be deleted, including the path and file name. For example `folder/image.png`.
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
   * Deletes multiple files within the same bucket
   *
   * @param bucketId The bucket which contains the files.
   * @param paths An array of files to be deletes, including the path and file name. For example [`folder/image.png`].
   */
  async deleteFiles(
    bucketId: string,
    paths: string[]
  ): Promise<{ data: FileObject[] | null; error: Error | null }> {
    try {
      const data = await remove(
        `${this.url}/object/${bucketId}`,
        { prefixes: paths },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Get file metadata
   * @param id the file id to retrieve metadata
   */
  // async getMetadata(id: string): Promise<{ data: Metadata | null; error: Error | null }> {
  //   try {
  //     const data = await get(`${this.url}/metadata/${id}`, { headers: this.headers })
  //     return { data, error: null }
  //   } catch (error) {
  //     return { data: null, error }
  //   }
  // }

  /**
   * Update file metadata
   * @param id the file id to update metadata
   * @param meta the new file metadata
   */
  // async updateMetadata(
  //   id: string,
  //   meta: Metadata
  // ): Promise<{ data: Metadata | null; error: Error | null }> {
  //   try {
  //     const data = await post(`${this.url}/metadata/${id}`, { ...meta }, { headers: this.headers })
  //     return { data, error: null }
  //   } catch (error) {
  //     return { data: null, error }
  //   }
  // }

  /**
   * Lists all the files within a bucket.
   * @param bucketId The bucket which contains the files.
   * @param path The folder path.
   * @param options Search options, including `limit`, `offset`, and `sortBy`.
   */
  async listFiles(
    bucketId: string,
    path?: string,
    options?: SearchOptions
  ): Promise<{ data: FileObject[] | null; error: Error | null }> {
    try {
      const body = { ...DEFAULT_SEARCH_OPTIONS, ...options, prefix: path || '' }
      const data = await post(`${this.url}/object/list/${bucketId}`, body, {
        headers: this.headers,
      })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }
}
