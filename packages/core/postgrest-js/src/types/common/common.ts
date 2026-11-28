// Types that are shared between supabase-js and postgrest-js

export type Fetch = typeof fetch

/**
 * Default number of retry attempts.
 */
export const DEFAULT_MAX_RETRIES = 3

/**
 * Maximum delay between retries, in milliseconds.
 */
export const MAX_RETRY_DELAY = 30000

/**
 * Default exponential backoff delay function with full jitter.
 * Each call returns a new random delay in [0, min(30s, 1s * 2^attemptIndex)],
 * so the upper bounds are 1s, 2s, 4s, 8s, ... (max 30s)
 *
 * @param attemptIndex - Zero-based index of the retry attempt
 * @returns Delay in milliseconds before the next retry
 */
export const getRetryDelay = (attemptIndex: number): number =>
  Math.random() * Math.min(1000 * 2 ** attemptIndex, MAX_RETRY_DELAY)

/**
 * Status codes that are safe to retry.
 * 520 = Cloudflare timeout/connection errors (transient)
 * 503 = PostgREST schema cache not yet loaded (transient, signals retry via Retry-After header)
 */
export const RETRYABLE_STATUS_CODES = [520, 503] as const

/**
 * HTTP methods that are safe to retry (idempotent operations).
 */
export const RETRYABLE_METHODS = ['GET', 'HEAD'] as const

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
  /**
   * Names of the `Row` keys that are computed fields (functions taking the row), which
   * PostgREST leaves out of `select('*')`. Generated types declare it; when absent, the
   * computed fields are inferred from `Functions`.
   */
  ComputedFields?: string
}

export type GenericUpdatableView = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
  Relationships: GenericRelationship[]
  ComputedFields?: string
}

export type GenericNonUpdatableView = {
  Row: Record<string, unknown>
  Relationships: GenericRelationship[]
  ComputedFields?: string
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
