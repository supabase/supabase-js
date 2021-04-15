import { FetchParameters, get, post, remove } from './fetch'
import { isBrowser } from './helpers'
import { FileObject, FileOptions, SearchOptions } from './types'

const DEFAULT_SEARCH_OPTIONS = {
  limit: 100,
  offset: 0,
  sortBy: {
    column: 'name',
    order: 'asc',
  },
}

const DEFAULT_FILE_OPTIONS: FileOptions = {
  cacheControl: '3600',
}

export class StorageFileApi {
  protected url: string
  protected headers: { [key: string]: string }
  protected bucketId?: string

  constructor(url: string, headers: { [key: string]: string } = {}, bucketId?: string) {
    this.url = url
    this.headers = headers
    this.bucketId = bucketId
  }

  /**
   * Uploads a file to an existing bucket.
   *
   * @param path The relative file path including the bucket ID. Should be of the format `bucket/folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
   * @param file The File object to be stored in the bucket.
   * @param fileOptions HTTP headers. For example `cacheControl`
   */
  async upload(
    path: string,
    file: File,
    fileOptions?: FileOptions
  ): Promise<{ data: { Key: string } | null; error: Error | null }> {
    try {
      if (!isBrowser()) throw new Error('No browser detected.')

      const formData = new FormData()
      formData.append('', file, file.name)

      const options = { ...DEFAULT_FILE_OPTIONS, ...fileOptions }
      formData.append('cacheControl', options.cacheControl)

      const _path = this._getFinalPath(path)
      const res = await fetch(`${this.url}/object/${_path}`, {
        method: 'POST',
        body: formData,
        headers: { ...this.headers },
      })

      if (res.ok) {
        // const data = await res.json()
        // temporary fix till backend is updated to the latest storage-api version
        return { data: { Key: _path }, error: null }
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
   * @param fileOptions HTTP headers. For example `cacheControl`
   */
  async update(
    path: string,
    file: File,
    fileOptions?: FileOptions
  ): Promise<{ data: { Key: string } | null; error: Error | null }> {
    try {
      if (!isBrowser()) throw new Error('No browser detected.')

      const formData = new FormData()
      formData.append('', file, file.name)

      const options = { ...DEFAULT_FILE_OPTIONS, ...fileOptions }
      formData.append('cacheControl', options.cacheControl)

      const _path = this._getFinalPath(path)
      const res = await fetch(`${this.url}/object/${_path}`, {
        method: 'PUT',
        body: formData,
        headers: { ...this.headers },
      })

      if (res.ok) {
        // const data = await res.json()
        // temporary fix till backend is updated to the latest storage-api version
        return { data: { Key: _path }, error: null }
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
   * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
   * @param toPath The new file path, including the new file name. For example `folder/image-copy.png`.
   */
  async move(
    fromPath: string,
    toPath: string
  ): Promise<{ data: { message: string } | null; error: Error | null }> {
    try {
      const data = await post(
        `${this.url}/object/move`,
        { bucketId: this.bucketId, sourceKey: fromPath, destinationKey: toPath },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Create signed url to download file without requiring permissions. This URL can be valid for a set number of seconds.
   *
   * @param path The file path to be downloaded, including the current file name. For example `folder/image.png`.
   * @param expiresIn The number of seconds until the signed URL expires. For example, `60` for a URL which is valid for one minute.
   */
  async createSignedUrl(
    path: string,
    expiresIn: number
  ): Promise<{
    data: { signedURL: string } | null
    error: Error | null
    signedURL: string | null
  }> {
    try {
      const _path = this._getFinalPath(path)
      let data = await post(
        `${this.url}/object/sign/${_path}`,
        { expiresIn },
        { headers: this.headers }
      )
      const signedURL = `${this.url}${data.signedURL}`
      data = { signedURL }
      return { data, error: null, signedURL }
    } catch (error) {
      return { data: null, error, signedURL: null }
    }
  }

  /**
   * Downloads a file.
   *
   * @param path The file path to be downloaded, including the path and file name. For example `folder/image.png`.
   */
  async download(path: string): Promise<{ data: Blob | null; error: Error | null }> {
    try {
      const _path = this._getFinalPath(path)
      const res = await get(`${this.url}/object/${_path}`, {
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
   * Deletes files within the same bucket
   *
   * @param paths An array of files to be deletes, including the path and file name. For example [`folder/image.png`].
   */
  async remove(paths: string[]): Promise<{ data: FileObject[] | null; error: Error | null }> {
    try {
      const data = await remove(
        `${this.url}/object/${this.bucketId}`,
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
   * @param path The folder path.
   * @param options Search options, including `limit`, `offset`, and `sortBy`.
   * @param parameters Fetch parameters, currently only supports `signal`, which is an AbortController's signal
   */
  async list(
    path?: string,
    options?: SearchOptions,
    parameters?: FetchParameters
  ): Promise<{ data: FileObject[] | null; error: Error | null }> {
    try {
      const body = { ...DEFAULT_SEARCH_OPTIONS, ...options, prefix: path || '' }
      const data = await post(
        `${this.url}/object/list/${this.bucketId}`,
        body,
        { headers: this.headers },
        parameters
      )
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  _getFinalPath(path: string) {
    return `${this.bucketId}/${path}`
  }
}
