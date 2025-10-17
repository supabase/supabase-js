import StorageFileApi from './packages/StorageFileApi'
import StorageBucketApi from './packages/StorageBucketApi'
import { Fetch } from './lib/fetch'
import { StorageVectorsClient } from '@supabase/storage-vectors-js'

export interface StorageClientOptions {
  useNewHostname?: boolean
}

export class StorageClient extends StorageBucketApi {
  constructor(
    url: string,
    headers: { [key: string]: string } = {},
    fetch?: Fetch,
    opts?: StorageClientOptions
  ) {
    super(url, headers, fetch, opts)
    console.log(new StorageVectorsClient('https://api.example.com'))
  }

  /**
   * Perform file operation in a bucket.
   *
   * @param id The bucket id to operate on.
   */
  from(id: string): StorageFileApi {
    return new StorageFileApi(this.url, this.headers, id, this.fetch)
  }
}
