import { StorageError } from './errors'

/**
 * Type of storage bucket
 * - STANDARD: Regular file storage buckets
 * - ANALYTICS: Iceberg table-based buckets for analytical workloads
 */
export type BucketType = 'STANDARD' | 'ANALYTICS'

export interface Bucket {
  id: string
  type?: BucketType
  name: string
  owner: string
  file_size_limit?: number
  allowed_mime_types?: string[]
  created_at: string
  updated_at: string
  public: boolean
}

/**
 * Represents an Analytics Bucket using Apache Iceberg table format.
 * Analytics buckets are optimized for analytical queries and data processing.
 */
export interface AnalyticBucket {
  /** Unique identifier for the bucket */
  id: string
  /** Bucket type - always 'ANALYTICS' for analytics buckets */
  type: 'ANALYTICS'
  /** Storage format used (e.g., 'iceberg') */
  format: string
  /** ISO 8601 timestamp of bucket creation */
  created_at: string
  /** ISO 8601 timestamp of last update */
  updated_at: string
}

export interface FileObject {
  name: string
  bucket_id: string
  owner: string
  id: string
  updated_at: string
  created_at: string
  last_accessed_at: string
  metadata: Record<string, any>
  buckets: Bucket
}

export interface FileObjectV2 {
  id: string
  version: string
  name: string
  bucket_id: string
  updated_at: string
  created_at: string
  last_accessed_at: string
  size?: number
  cache_control?: string
  content_type?: string
  etag?: string
  last_modified?: string
  metadata?: Record<string, any>
}

export interface SortBy {
  column?: string
  order?: string
}

export interface FileOptions {
  /**
   * The number of seconds the asset is cached in the browser and in the Supabase CDN. This is set in the `Cache-Control: max-age=<seconds>` header. Defaults to 3600 seconds.
   */
  cacheControl?: string
  /**
   * the `Content-Type` header value. Should be specified if using a `fileBody` that is neither `Blob` nor `File` nor `FormData`, otherwise will default to `text/plain;charset=UTF-8`.
   */
  contentType?: string
  /**
   * When upsert is set to true, the file is overwritten if it exists. When set to false, an error is thrown if the object already exists. Defaults to false.
   */
  upsert?: boolean
  /**
   * The duplex option is a string parameter that enables or disables duplex streaming, allowing for both reading and writing data in the same stream. It can be passed as an option to the fetch() method.
   */
  duplex?: string

  /**
   * The metadata option is an object that allows you to store additional information about the file. This information can be used to filter and search for files. The metadata object can contain any key-value pairs you want to store.
   */
  metadata?: Record<string, any>

  /**
   * Optionally add extra headers
   */
  headers?: Record<string, string>
}

export interface DestinationOptions {
  destinationBucket?: string
}

export interface SearchOptions {
  /**
   * The number of files you want to be returned.
   * @default 100
   */
  limit?: number

  /**
   * The starting position.
   */
  offset?: number

  /**
   * The column to sort by. Can be any column inside a FileObject.
   */
  sortBy?: SortBy

  /**
   * The search string to filter files by.
   */
  search?: string
}

export interface SortByV2 {
  column: 'name' | 'updated_at' | 'created_at'
  order?: 'asc' | 'desc'
}

export interface SearchV2Options {
  /**
   * The number of files you want to be returned.
   * @default 1000
   */
  limit?: number

  /**
   * The prefix search string to filter files by.
   */
  prefix?: string

  /**
   * The cursor used for pagination. Pass the value received from nextCursor of the previous request.
   */
  cursor?: string

  /**
   * Whether to emulate a hierarchical listing of objects using delimiters.
   *
   * - When `false` (default), all objects are listed as flat key/value pairs.
   * - When `true`, the response groups objects by delimiter, making it appear
   *   like a file/folder hierarchy.
   *
   * @default false
   */
  with_delimiter?: boolean

  /**
   * The column and order to sort by
   * @default 'name asc'
   */
  sortBy?: SortByV2
}

export interface SearchV2Object {
  id: string
  key: string
  name: string
  updated_at: string
  created_at: string
  metadata: Record<string, any>
  /**
   * @deprecated
   */
  last_accessed_at: string
}

export type SearchV2Folder = Omit<SearchV2Object, 'id' | 'metadata' | 'last_accessed_at'>

export interface SearchV2Result {
  hasNext: boolean
  folders: SearchV2Folder[]
  objects: SearchV2Object[]
  nextCursor?: string
}

export interface FetchParameters {
  /**
   * Pass in an AbortController's signal to cancel the request.
   */
  signal?: AbortSignal
}

// TODO: need to check for metadata props. The api swagger doesnt have.
export interface Metadata {
  name: string
}

export interface TransformOptions {
  /**
   * The width of the image in pixels.
   */
  width?: number
  /**
   * The height of the image in pixels.
   */
  height?: number
  /**
   * The resize mode can be cover, contain or fill. Defaults to cover.
   * Cover resizes the image to maintain it's aspect ratio while filling the entire width and height.
   * Contain resizes the image to maintain it's aspect ratio while fitting the entire image within the width and height.
   * Fill resizes the image to fill the entire width and height. If the object's aspect ratio does not match the width and height, the image will be stretched to fit.
   */
  resize?: 'cover' | 'contain' | 'fill'
  /**
   * Set the quality of the returned image.
   * A number from 20 to 100, with 100 being the highest quality.
   * Defaults to 80
   */
  quality?: number
  /**
   * Specify the format of the image requested.
   *
   * When using 'origin' we force the format to be the same as the original image.
   * When this option is not passed in, images are optimized to modern image formats like Webp.
   */
  format?: 'origin'
}

type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
  : S

export type Camelize<T> = {
  [K in keyof T as CamelCase<Extract<K, string>>]: T[K]
}

export type DownloadResult<T> =
  | {
      data: T
      error: null
    }
  | {
      data: null
      error: StorageError
    }
