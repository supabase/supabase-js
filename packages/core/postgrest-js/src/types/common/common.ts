// Types that are shared between supabase-js and postgrest-js

export type Fetch = typeof fetch

/**
 * Default number of retry attempts.
 */
export const DEFAULT_MAX_RETRIES = 3

/**
 * Default exponential backoff delay function.
 * Delays: 1s, 2s, 4s, 8s, ... (max 30s)
 *
 * @param attemptIndex - Zero-based index of the retry attempt
 * @returns Delay in milliseconds before the next retry
 */
export const getRetryDelay = (attemptIndex: number): number =>
  Math.min(1000 * 2 ** attemptIndex, 30000)

/**
 * Status codes that are safe to retry.
 * 520 = Cloudflare timeout/connection errors (transient)
 */
export const RETRYABLE_STATUS_CODES = [520] as const

/**
 * HTTP methods that are safe to retry (idempotent operations).
 */
export const RETRYABLE_METHODS = ['GET', 'HEAD', 'OPTIONS'] as const

export type GenericRelationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne?: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export type GenericTable = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
  Relationships: GenericRelationship[]
}

export type GenericUpdatableView = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
  Relationships: GenericRelationship[]
}

export type GenericNonUpdatableView = {
  Row: Record<string, unknown>
  Relationships: GenericRelationship[]
}

export type GenericView = GenericUpdatableView | GenericNonUpdatableView

export type GenericSetofOption = {
  isSetofReturn?: boolean | undefined
  isOneToOne?: boolean | undefined
  isNotNullable?: boolean | undefined
  to: string
  from: string
}

export type GenericFunction = {
  Args: Record<string, unknown> | never
  Returns: unknown
  SetofOptions?: GenericSetofOption
}

export type GenericSchema = {
  Tables: Record<string, GenericTable>
  Views: Record<string, GenericView>
  Functions: Record<string, GenericFunction>
}

export type ClientServerOptions = {
  PostgrestVersion?: string
}
