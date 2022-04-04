export interface Bucket {
  id: string
  name: string
  owner: string
  created_at: string
  updated_at: string
  public: boolean
}

export interface FileObject {
  name: string
  bucket_id: string
  owner: string
  id: string
  updated_at: string
  created_at: string
  last_accessed_at: string
  metadata: {}
  buckets: Bucket
}

export interface SortBy {
  column?: string
  order?: string
}

export interface FileOptions {
  cacheControl?: string
  contentType?: string
  upsert?: boolean
}

export interface SearchOptions {
  /** The number of files you want to be returned. */
  limit?: number

  /** The starting position. */
  offset?: number

  /** The column to sort by. Can be any column inside a FileObject. */
  sortBy?: SortBy

  /** The search string to filter files by. */
  search?: string
}

// TODO: need to check for metadata props. The api swagger doesnt have.
export interface Metadata {
  name: string
}
