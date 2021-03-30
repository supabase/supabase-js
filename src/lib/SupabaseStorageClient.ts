import { FileOptions, StorageApi } from './storage'

export class SupabaseStorageClient {
  protected url: string
  protected headers: { [key: string]: string }
  protected api: StorageApi

  constructor(url: string, headers: { [key: string]: string } = {}) {
    this.url = url
    this.headers = headers

    this.api = new StorageApi(url, headers)
  }

  /**
   * Perform file operation in a bucket.
   *
   * @param id The bucket id to operate on.
   */
  from(id: string): SupabaseStorageClient {
    this.api = new StorageApi(this.url, this.headers, id)
    return this
  }

  /**
   * Uploads a file to an existing bucket.
   *
   * @param path The file path including the path and file name. For example `folder/image.png`.
   * @param file The File object to be stored in the bucket.
   * @param fileOptions HTTP headers. For example `cacheControl`
   */
  uploadFile(path: string, file: File, fileOptions?: FileOptions) {
    return this.api.uploadFile(path, file, fileOptions)
  }

  /**
   * Replaces an existing file at the specified path with a new one.
   *
   * @param path The file path including the path and file name. For example `folder/image.png`.
   * @param file The file object to be stored in the bucket.
   * @param fileOptions HTTP headers. For example `cacheControl`
   */
  updateFile(path: string, file: File, fileOptions?: FileOptions) {
    return this.api.updateFile(path, file, fileOptions)
  }

  /**
   * Moves an existing file, optionally renaming it at the same time.
   *
   * @param bucketId The bucket which contains the file.
   * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
   * @param toPath The new file path, including the new file name. For example `folder/image-copy.png`.
   */
  moveFile(fromPath: string, toPath: string) {
    return this.api.moveFile(fromPath, toPath)
  }

  /**
   * Downloads a file.
   *
   * @param path The file path to be downloaded, including the path and file name. For example `folder/image.png`.
   */
  downloadFile(path: string) {
    return this.api.downloadFile(path)
  }
}
