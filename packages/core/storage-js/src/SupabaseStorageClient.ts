import { StorageBucketApi, StorageFileApi } from './lib'

export class SupabaseStorageClient extends StorageBucketApi {
  constructor(url: string, headers: { [key: string]: string } = {}) {
    super(url, headers)
  }

  /**
   * Perform file operation in a bucket.
   *
   * @param id The bucket id to operate on.
   */
  from(id: string): StorageFileApi {
    return new StorageFileApi(this.url, this.headers, id)
  }
}
