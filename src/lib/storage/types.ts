export interface Bucket {
  id: string
  name: string
  owner: string
  created_at: string
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
  metadata: {}
  buckets: Bucket
}

export interface SortBy {
  column?: string
  order?: string
}

export interface SearchOptions {
  limit?: number
  offset?: number
  sortBy?: SortBy
}

// TODO: need to check with inian.
export interface Metadata {
  name: string
}
