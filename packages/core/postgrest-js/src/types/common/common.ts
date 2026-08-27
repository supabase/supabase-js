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
 * Upper bound on a delay taken from a `Retry-After` header, in milliseconds.
 *
 * Matches the ceiling of {@link getRetryDelay} so a server — or an intermediary
 * such as a CDN — cannot stall a request for an arbitrary length of time.
 */
export const MAX_RETRY_AFTER_DELAY = 30000

/**
 * Parse a `Retry-After` header value into a delay in milliseconds.
 *
 * `Retry-After` is either `delay-seconds` or an `HTTP-date`:
 *
 * ```
 * Retry-After = HTTP-date / delay-seconds
 * delay-seconds = 1*DIGIT
 * ```
 *
 * Returns `null` when the value is absent, empty, or matches neither form, so
 * callers can fall back to their own backoff instead of retrying immediately.
 * `Date.parse` handles the preferred IMF-fixdate form (and, in V8, the obsolete
 * RFC 850 form), but its behaviour on non-ISO input is implementation-defined,
 * so engines that reject a given format simply take the `null` fallback.
 *
 * @param value - Raw header value, or null when the header is absent
 * @param now - Reference time used to turn an HTTP-date into a delay
 * @returns Delay in milliseconds, or null if the value cannot be interpreted
 *
 * @see https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after
 */
export const parseRetryAfter = (value: string | null, now: number = Date.now()): number | null => {
  if (value === null) {
    return null
  }

  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }

  // delay-seconds: digits only, so a malformed value like "30s" is not read as 30
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000
  }

  // HTTP-date: a timestamp already in the past means "retry now"
  const retryAt = Date.parse(trimmed)
  if (!Number.isNaN(retryAt)) {
    return Math.max(0, retryAt - now)
  }

  return null
}

/**
 * Status codes that are safe to retry.
 * 520 = Cloudflare timeout/connection errors (transient)
 * 503 = PostgREST schema cache not yet loaded (transient, signals retry via Retry-After header)
 */
export const RETRYABLE_STATUS_CODES = [520, 503] as const

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
