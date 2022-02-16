import { Fetch, FetchParameters, get, post, remove } from './fetch'
import { isBrowser } from './helpers'
import { FileObject, FileOptions, SearchOptions } from './types'
import fetch from 'cross-fetch'

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
  contentType: 'text/plain;charset=UTF-8',
  upsert: false,
}

export class StorageFileApi {
  protected url: string
  protected headers: { [key: string]: string }
  protected bucketId?: string
  protected fetch?: Fetch

  constructor(
    url: string,
    headers: { [key: string]: string } = {},
    bucketId?: string,
    fetch?: Fetch
  ) {
    this.url = url
    this.headers = headers
    this.bucketId = bucketId
    this.fetch = fetch
  }

  /**
   * Uploads a file to an existing bucket or replaces an existing file at the specified path with a new one.
   *
   * @param method HTTP method.
   * @param path The relative file path. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
   * @param fileBody The body of the file to be stored in the bucket.
   * @param fileOptions HTTP headers.
   * `cacheControl`: string, the `Cache-Control: max-age=<seconds>` seconds value.
   * `contentType`: string, the `Content-Type` header value. Should be specified if using a `fileBody` that is neither `Blob` nor `File` nor `FormData`, otherwise will default to `text/plain;charset=UTF-8`.
   * `upsert`: boolean, whether to perform an upsert.
   */
  private async uploadOrUpdate(
    method: 'POST' | 'PUT',
    path: string,
    fileBody:
      | ArrayBuffer
      | ArrayBufferView
      | Blob
      | Buffer
      | File
      | FormData
      | NodeJS.ReadableStream
      | ReadableStream<Uint8Array>
      | URLSearchParams
      | string,
    fileOptions?: FileOptions
  ): Promise<{ data: { Key: string } | null; error: Error | null }> {
    try {
      let body
      const options = { ...DEFAULT_FILE_OPTIONS, ...fileOptions }
      const headers: Record<string, string> = {
        ...this.headers,
        ...(method === 'POST' && { 'x-upsert': String(options.upsert as boolean) }),
      }

      if (typeof Blob !== 'undefined' && fileBody instanceof Blob) {
        body = new FormData()
        body.append('cacheControl', options.cacheControl as string)
        body.append('', fileBody)
      } else if (typeof FormData !== 'undefined' && fileBody instanceof FormData) {
        body = fileBody
        body.append('cacheControl', options.cacheControl as string)
      } else {
        body = fileBody
        headers['cache-control'] = `max-age=${options.cacheControl}`
        headers['content-type'] = options.contentType as string
      }

      const cleanPath = this._removeEmptyFolders(path)
      const _path = this._getFinalPath(cleanPath)
      const fetcher = this.fetch ?? fetch
      const res = await fetcher(`${this.url}/object/${_path}`, {
        method,
        body: body as BodyInit,
        headers,
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
   * Uploads a file to an existing bucket.
   *
   * @param path The relative file path. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
   * @param fileBody The body of the file to be stored in the bucket.
   * @param fileOptions HTTP headers.
   * `cacheControl`: string, the `Cache-Control: max-age=<seconds>` seconds value.
   * `contentType`: string, the `Content-Type` header value. Should be specified if using a `fileBody` that is neither `Blob` nor `File` nor `FormData`, otherwise will default to `text/plain;charset=UTF-8`.
   * `upsert`: boolean, whether to perform an upsert.
   */
  async upload(
    path: string,
    fileBody:
      | ArrayBuffer
      | ArrayBufferView
      | Blob
      | Buffer
      | File
      | FormData
      | NodeJS.ReadableStream
      | ReadableStream<Uint8Array>
      | URLSearchParams
      | string,
    fileOptions?: FileOptions
  ): Promise<{ data: { Key: string } | null; error: Error | null }> {
    return this.uploadOrUpdate('POST', path, fileBody, fileOptions)
  }

  /**
   * Replaces an existing file at the specified path with a new one.
   *
   * @param path The relative file path. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
   * @param fileBody The body of the file to be stored in the bucket.
   * @param fileOptions HTTP headers.
   * `cacheControl`: string, the `Cache-Control: max-age=<seconds>` seconds value.
   * `contentType`: string, the `Content-Type` header value. Should be specified if using a `fileBody` that is neither `Blob` nor `File` nor `FormData`, otherwise will default to `text/plain;charset=UTF-8`.
   * `upsert`: boolean, whether to perform an upsert.
   */
  async update(
    path: string,
    fileBody:
      | ArrayBuffer
      | ArrayBufferView
      | Blob
      | Buffer
      | File
      | FormData
      | NodeJS.ReadableStream
      | ReadableStream<Uint8Array>
      | URLSearchParams
      | string,
    fileOptions?: FileOptions
  ): Promise<{ data: { Key: string } | null; error: Error | null }> {
    return this.uploadOrUpdate('PUT', path, fileBody, fileOptions)
  }

  /**
   * Moves an existing file.
   *
   * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
   * @param toPath The new file path, including the new file name. For example `folder/image-new.png`.
   */
  async move(
    fromPath: string,
    toPath: string
  ): Promise<{ data: { message: string } | null; error: Error | null }> {
    try {
      const data = await post(
        this.fetch,
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
   * Copies an existing file.
   *
   * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
   * @param toPath The new file path, including the new file name. For example `folder/image-copy.png`.
   */
  async copy(
    fromPath: string,
    toPath: string
  ): Promise<{ data: { message: string } | null; error: Error | null }> {
    try {
      const data = await post(
        this.fetch,
        `${this.url}/object/copy`,
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
        this.fetch,
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
      const res = await get(this.fetch, `${this.url}/object/${_path}`, {
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
   * Retrieve URLs for assets in public buckets
   *
   * @param path The file path to be downloaded, including the path and file name. For example `folder/image.png`.
   */
  getPublicUrl(
    path: string
  ): {
    data: { publicURL: string } | null
    error: Error | null
    publicURL: string | null
  } {
    try {
      const _path = this._getFinalPath(path)
      const publicURL = `${this.url}/object/public/${_path}`
      const data = { publicURL }
      return { data, error: null, publicURL }
    } catch (error) {
      return { data: null, error, publicURL: null }
    }
  }

  /**
   * Deletes files within the same bucket
   *
   * @param paths An array of files to be deleted, including the path and file name. For example [`folder/image.png`].
   */
  async remove(paths: string[]): Promise<{ data: FileObject[] | null; error: Error | null }> {
    try {
      const data = await remove(
        this.fetch,
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
        this.fetch,
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

  _removeEmptyFolders(path: string) {
    return path.replace(/^\/|\/$/g, '').replace(/\/+/g, '/')
  }
}
