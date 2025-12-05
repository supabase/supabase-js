import { IcebergRestCatalog, IcebergError } from 'iceberg-js'
import { DEFAULT_HEADERS } from '../lib/constants'
import { isStorageError, StorageError } from '../lib/errors'
import { Fetch, get, post, remove } from '../lib/fetch'
import { isValidBucketName, resolveFetch } from '../lib/helpers'
import { AnalyticBucket } from '../lib/types'

type WrapAsyncMethod<T> = T extends (...args: infer A) => Promise<infer R>
  ? (...args: A) => Promise<{ data: R; error: null } | { data: null; error: IcebergError }>
  : T

export type WrappedIcebergRestCatalog = {
  [K in keyof IcebergRestCatalog]: WrapAsyncMethod<IcebergRestCatalog[K]>
}

/**
 * Client class for managing Analytics Buckets using Iceberg tables
 * Provides methods for creating, listing, and deleting analytics buckets
 */
export default class StorageAnalyticsClient {
  protected url: string
  protected headers: { [key: string]: string }
  protected fetch: Fetch
  protected shouldThrowOnError = false

  /**
   * @alpha
   *
   * Creates a new StorageAnalyticsClient instance
   *
   * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
   *
   * @category Analytics Buckets
   * @param url - The base URL for the storage API
   * @param headers - HTTP headers to include in requests
   * @param fetch - Optional custom fetch implementation
   *
   * @example
   * ```typescript
   * const client = new StorageAnalyticsClient(url, headers)
   * ```
   */
  constructor(url: string, headers: { [key: string]: string } = {}, fetch?: Fetch) {
    this.url = url.replace(/\/$/, '')
    this.headers = { ...DEFAULT_HEADERS, ...headers }
    this.fetch = resolveFetch(fetch)
  }

  /**
   * @alpha
   *
   * Enable throwing errors instead of returning them in the response
   * When enabled, failed operations will throw instead of returning { data: null, error }
   *
   * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
   *
   * @category Analytics Buckets
   * @returns This instance for method chaining
   */
  public throwOnError(): this {
    this.shouldThrowOnError = true
    return this
  }

  /**
   * @alpha
   *
   * Creates a new analytics bucket using Iceberg tables
   * Analytics buckets are optimized for analytical queries and data processing
   *
   * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
   *
   * @category Analytics Buckets
   * @param name A unique name for the bucket you are creating
   * @returns Promise with response containing newly created analytics bucket or error
   *
   * @example Create analytics bucket
   * ```js
   * const { data, error } = await supabase
   *   .storage
   *   .analytics
   *   .createBucket('analytics-data')
   * ```
   *
   * Response:
   * ```json
   * {
   *   "data": {
   *     "name": "analytics-data",
   *     "type": "ANALYTICS",
   *     "format": "iceberg",
   *     "created_at": "2024-05-22T22:26:05.100Z",
   *     "updated_at": "2024-05-22T22:26:05.100Z"
   *   },
   *   "error": null
   * }
   * ```
   */
  async createBucket(name: string): Promise<
    | {
        data: AnalyticBucket
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const data = await post(this.fetch, `${this.url}/bucket`, { name }, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      if (this.shouldThrowOnError) {
        throw error
      }
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * @alpha
   *
   * Retrieves the details of all Analytics Storage buckets within an existing project
   * Only returns buckets of type 'ANALYTICS'
   *
   * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
   *
   * @category Analytics Buckets
   * @param options Query parameters for listing buckets
   * @param options.limit Maximum number of buckets to return
   * @param options.offset Number of buckets to skip
   * @param options.sortColumn Column to sort by ('name', 'created_at', 'updated_at')
   * @param options.sortOrder Sort order ('asc' or 'desc')
   * @param options.search Search term to filter bucket names
   * @returns Promise with response containing array of analytics buckets or error
   *
   * @example List analytics buckets
   * ```js
   * const { data, error } = await supabase
   *   .storage
   *   .analytics
   *   .listBuckets({
   *     limit: 10,
   *     offset: 0,
   *     sortColumn: 'created_at',
   *     sortOrder: 'desc'
   *   })
   * ```
   *
   * Response:
   * ```json
   * {
   *   "data": [
   *     {
   *       "name": "analytics-data",
   *       "type": "ANALYTICS",
   *       "format": "iceberg",
   *       "created_at": "2024-05-22T22:26:05.100Z",
   *       "updated_at": "2024-05-22T22:26:05.100Z"
   *     }
   *   ],
   *   "error": null
   * }
   * ```
   */
  async listBuckets(options?: {
    limit?: number
    offset?: number
    sortColumn?: 'name' | 'created_at' | 'updated_at'
    sortOrder?: 'asc' | 'desc'
    search?: string
  }): Promise<
    | {
        data: AnalyticBucket[]
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      // Build query string from options
      const queryParams = new URLSearchParams()
      if (options?.limit !== undefined) queryParams.set('limit', options.limit.toString())
      if (options?.offset !== undefined) queryParams.set('offset', options.offset.toString())
      if (options?.sortColumn) queryParams.set('sortColumn', options.sortColumn)
      if (options?.sortOrder) queryParams.set('sortOrder', options.sortOrder)
      if (options?.search) queryParams.set('search', options.search)

      const queryString = queryParams.toString()
      const url = queryString ? `${this.url}/bucket?${queryString}` : `${this.url}/bucket`

      const data = await get(this.fetch, url, { headers: this.headers })

      return { data: data, error: null }
    } catch (error) {
      if (this.shouldThrowOnError) {
        throw error
      }
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * @alpha
   *
   * Deletes an existing analytics bucket
   * A bucket can't be deleted with existing objects inside it
   * You must first empty the bucket before deletion
   *
   * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
   *
   * @category Analytics Buckets
   * @param bucketName The unique identifier of the bucket you would like to delete
   * @returns Promise with response containing success message or error
   *
   * @example Delete analytics bucket
   * ```js
   * const { data, error } = await supabase
   *   .storage
   *   .analytics
   *   .deleteBucket('analytics-data')
   * ```
   *
   * Response:
   * ```json
   * {
   *   "data": {
   *     "message": "Successfully deleted"
   *   },
   *   "error": null
   * }
   * ```
   */
  async deleteBucket(bucketName: string): Promise<
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
        `${this.url}/bucket/${bucketName}`,
        {},
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      if (this.shouldThrowOnError) {
        throw error
      }
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * @alpha
   *
   * Get an Iceberg REST Catalog client configured for a specific analytics bucket
   * Use this to perform advanced table and namespace operations within the bucket
   * The returned client provides full access to the Apache Iceberg REST Catalog API
   * with the Supabase `{ data, error }` pattern for consistent error handling on all operations.
   *
   * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
   *
   * @category Analytics Buckets
   * @param bucketName - The name of the analytics bucket (warehouse) to connect to
   * @returns The wrapped Iceberg catalog client
   * @throws {StorageError} If the bucket name is invalid
   *
   * @example Get catalog and create table
   * ```js
   * // First, create an analytics bucket
   * const { data: bucket, error: bucketError } = await supabase
   *   .storage
   *   .analytics
   *   .createBucket('analytics-data')
   *
   * // Get the Iceberg catalog for that bucket
   * const catalog = supabase.storage.analytics.from('analytics-data')
   *
   * // Create a namespace
   * const { error: nsError } = await catalog.createNamespace({ namespace: ['default'] })
   *
   * // Create a table with schema
   * const { data: tableMetadata, error: tableError } = await catalog.createTable(
   *   { namespace: ['default'] },
   *   {
   *     name: 'events',
   *     schema: {
   *       type: 'struct',
   *       fields: [
   *         { id: 1, name: 'id', type: 'long', required: true },
   *         { id: 2, name: 'timestamp', type: 'timestamp', required: true },
   *         { id: 3, name: 'user_id', type: 'string', required: false }
   *       ],
   *       'schema-id': 0,
   *       'identifier-field-ids': [1]
   *     },
   *     'partition-spec': {
   *       'spec-id': 0,
   *       fields: []
   *     },
   *     'write-order': {
   *       'order-id': 0,
   *       fields: []
   *     },
   *     properties: {
   *       'write.format.default': 'parquet'
   *     }
   *   }
   * )
   * ```
   *
   * @example List tables in namespace
   * ```js
   * const catalog = supabase.storage.analytics.from('analytics-data')
   *
   * // List all tables in the default namespace
   * const { data: tables, error: listError } = await catalog.listTables({ namespace: ['default'] })
   * if (listError) {
   *   if (listError.isNotFound()) {
   *     console.log('Namespace not found')
   *   }
   *   return
   * }
   * console.log(tables) // [{ namespace: ['default'], name: 'events' }]
   * ```
   *
   * @example Working with namespaces
   * ```js
   * const catalog = supabase.storage.analytics.from('analytics-data')
   *
   * // List all namespaces
   * const { data: namespaces } = await catalog.listNamespaces()
   *
   * // Create namespace with properties
   * await catalog.createNamespace(
   *   { namespace: ['production'] },
   *   { properties: { owner: 'data-team', env: 'prod' } }
   * )
   * ```
   *
   * @example Cleanup operations
   * ```js
   * const catalog = supabase.storage.analytics.from('analytics-data')
   *
   * // Drop table with purge option (removes all data)
   * const { error: dropError } = await catalog.dropTable(
   *   { namespace: ['default'], name: 'events' },
   *   { purge: true }
   * )
   *
   * if (dropError?.isNotFound()) {
   *   console.log('Table does not exist')
   * }
   *
   * // Drop namespace (must be empty)
   * await catalog.dropNamespace({ namespace: ['default'] })
   * ```
   *
   * @remarks
   * This method provides a bridge between Supabase's bucket management and the standard
   * Apache Iceberg REST Catalog API. The bucket name maps to the Iceberg warehouse parameter.
   * All authentication and configuration is handled automatically using your Supabase credentials.
   *
   * **Error Handling**: Invalid bucket names throw immediately. All catalog
   * operations return `{ data, error }` where errors are `IcebergError` instances from iceberg-js.
   * Use helper methods like `error.isNotFound()` or check `error.status` for specific error handling.
   * Use `.throwOnError()` on the analytics client if you prefer exceptions for catalog operations.
   *
   * **Cleanup Operations**: When using `dropTable`, the `purge: true` option permanently
   * deletes all table data. Without it, the table is marked as deleted but data remains.
   *
   * **Library Dependency**: The returned catalog wraps `IcebergRestCatalog` from iceberg-js.
   * For complete API documentation and advanced usage, refer to the
   * [iceberg-js documentation](https://supabase.github.io/iceberg-js/).
   */
  from(bucketName: string): WrappedIcebergRestCatalog {
    // Validate bucket name using same rules as Supabase Storage API backend
    if (!isValidBucketName(bucketName)) {
      throw new StorageError(
        'Invalid bucket name: File, folder, and bucket names must follow AWS object key naming guidelines ' +
          'and should avoid the use of any other characters.'
      )
    }

    // Construct the Iceberg REST Catalog URL
    // The base URL is /storage/v1/iceberg
    // Note: IcebergRestCatalog from iceberg-js automatically adds /v1/ prefix to API paths
    // so we should NOT append /v1 here (it would cause double /v1/v1/ in the URL)
    const catalog = new IcebergRestCatalog({
      baseUrl: this.url,
      catalogName: bucketName, // Maps to the warehouse parameter in Supabase's implementation
      auth: {
        type: 'custom',
        getHeaders: async () => this.headers,
      },
      fetch: this.fetch,
    })

    const shouldThrowOnError = this.shouldThrowOnError

    const wrappedCatalog = new Proxy(catalog, {
      get(target, prop: keyof IcebergRestCatalog) {
        const value = target[prop]
        if (typeof value !== 'function') {
          return value
        }

        return async (...args: unknown[]) => {
          try {
            const data = await (value as Function).apply(target, args)
            return { data, error: null }
          } catch (error) {
            if (shouldThrowOnError) {
              throw error
            }
            return { data: null, error: error as IcebergError }
          }
        }
      },
    }) as unknown as WrappedIcebergRestCatalog

    return wrappedCatalog
  }
}
