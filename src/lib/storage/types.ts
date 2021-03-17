export interface Bucket {
  id: string
  name: string
  owner: string
  created_at: string
  updated_at: string
}

export interface File {
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
  prefix?: string
  limit?: number
  offset?: number
  sortBy?: SortBy
}
