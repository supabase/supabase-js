import StorageFileApi from './packages/StorageFileApi'
import StorageBucketApi from './packages/StorageBucketApi'
import StorageAnalyticsClient from './packages/StorageAnalyticsClient'
import { Fetch } from './lib/common/fetch'
import { StorageVectorsClient } from './packages/StorageVectorsClient'

export interface StorageClientOptions {
  useNewHostname?: boolean
}

export class StorageClient extends StorageBucketApi {
  /**
   * Creates a client for Storage buckets, files, analytics, and vectors.
   *
   * @category Storage
   * @subcategory File Buckets
   *
   * @example Using supabase-js (recommended)
   * ```ts
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
   * const avatars = supabase.storage.from('avatars')
   * ```
   *
   * @example Standalone import for bundle-sensitive environments
   * ```ts
   * import { StorageClient } from '@supabase/storage-js'
   *
   * const storage = new StorageClient('https://xyzcompany.supabase.co/storage/v1', {
   *   apikey: 'your-publishable-key',
   * })
   * const avatars = storage.from('avatars')
   * ```
   */
  constructor(
    url: string,
    headers: { [key: string]: string } = {},
    fetch?: Fetch,
    opts?: StorageClientOptions
  ) {
    super(url, headers, fetch, opts)
  }

  /**
   * Perform file operation in a bucket.
   *
   * @category Storage
   * @subcategory File Buckets
   *
   * @param id The bucket id to operate on.
   *
   * @example Accessing a bucket
   * ```typescript
   * const avatars = supabase.storage.from('avatars')
   * ```
   */
  from(id: string): StorageFileApi {
    return new StorageFileApi(this.url, this.headers, id, this.fetch)
  }

  /**
   *
   * @alpha
   *
   * Access vector storage operations.
   *
   * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
   *
   * @category Storage
   * @subcategory Vector Buckets
   *
   * @returns A StorageVectorsClient instance configured with the current storage settings.
   */
  get vectors(): StorageVectorsClient {
    return new StorageVectorsClient(this.url + '/vector', {
      headers: this.headers,
      fetch: this.fetch,
    })
  }

  /**
   *
   * @alpha
   *
   * Access analytics storage operations using Iceberg tables.
   *
   * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
   *
   * @category Storage
   * @subcategory Analytics Buckets
   *
   * @returns A StorageAnalyticsClient instance configured with the current storage settings.
   */
  get analytics(): StorageAnalyticsClient {
    return new StorageAnalyticsClient(this.url + '/iceberg', this.headers, this.fetch)
  }
}
