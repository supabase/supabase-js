/**
 * Comparison operators accepted in a Postgres Changes `filter` string.
 *
 * These mirror the PostgREST operator surface and are evaluated server-side.
 * Any operator can be negated via {@link RealtimePostgresFilterBuilder.not}
 * (the `not.` prefix).
 *
 * This is the subset of PostgREST's `FilterOperator` (see `postgrest-js`) that
 * Realtime Postgres Changes supports. Containment, range and full-text search
 * operators (`cs`, `cd`, `ov`, range ops, `fts`, …) are intentionally not
 * included because the Realtime server does not evaluate them.
 *
 * - `eq`, `neq`, `lt`, `lte`, `gt`, `gte` — comparison
 * - `in` — membership: `status=in.(active,pending)`
 * - `like`, `ilike` — pattern match (case-sensitive / insensitive): `title=like.%foo%`
 * - `is` — `IS` check against `null` / `true` / `false` / `unknown`: `deleted_at=is.null`
 * - `match`, `imatch` — POSIX regex match (`~` / `~*`)
 * - `isdistinct` — NULL-safe inequality (`IS DISTINCT FROM`)
 */
export type RealtimePostgresChangesFilterOperator =
  | 'eq'
  | 'neq'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'in'
  | 'like'
  | 'ilike'
  | 'is'
  | 'match'
  | 'imatch'
  | 'isdistinct'

/** Scalar value accepted by a single filter operator. */
export type RealtimeFilterValue = string | number | boolean | null

/** Value accepted by the `is` operator. */
export type RealtimeIsFilterValue = null | boolean | 'null' | 'true' | 'false' | 'unknown'

// Reserved characters that force PostgREST-style quoting: `[,()]` (which the
// server reads as condition/list delimiters) plus `"`/`\` (escaped inside quotes).
const PostgrestReservedCharsRegexp = /[,()"\\]/

const needsQuoting = (value: string): boolean =>
  PostgrestReservedCharsRegexp.test(value) || value !== value.trim()

const quote = (value: string): string => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

const serializeScalar = (value: RealtimeFilterValue): string => {
  const serialized = value === null ? 'null' : String(value)
  return needsQuoting(serialized) ? quote(serialized) : serialized
}

const serializeIsValue = (value: RealtimeIsFilterValue): string =>
  value === null ? 'null' : String(value)

// Builds the `operator.value` portion of a filter (everything after `column=`).
const serialize = (operator: RealtimePostgresChangesFilterOperator, value: unknown): string => {
  if (operator === 'in') {
    const values = Array.isArray(value) ? value : [value]
    if (values.length === 0) {
      throw new Error('Realtime `in` filter requires at least one value.')
    }
    const items = Array.from(new Set(values))
      .map((v) => serializeScalar(v as RealtimeFilterValue))
      .join(',')
    return `in.(${items})`
  }

  if (operator === 'is') {
    return `is.${serializeIsValue(value as RealtimeIsFilterValue)}`
  }

  return `${operator}.${serializeScalar(value as RealtimeFilterValue)}`
}

/**
 * Fluent builder for Postgres Changes `filter` strings.
 *
 * Each method appends a single `column=operator.value` condition. Multiple
 * conditions are combined with commas, which the Realtime server applies as an
 * `AND`. Pass an instance straight to `channel.on('postgres_changes', …)` — the
 * SDK serializes it to a string automatically — or call {@link build} to obtain
 * the string yourself.
 *
 * The builder mirrors the `postgrest-js` filter API (`eq`, `neq`, `in`, `like`,
 * `not`, …) for the operators that Realtime supports. Values containing reserved
 * characters (`,`, `(`, `)`, `"`, `\`) — or surrounding whitespace — are
 * automatically double-quoted and escaped the same way PostgREST does, so they
 * survive the server's filter parser; all other values are sent verbatim.
 *
 * The filter is snapshotted when passed to `channel.on(...)`; mutating the
 * builder afterwards does not affect an existing subscription. An empty builder
 * serializes to `''`, which the server treats as "no filter".
 *
 * @example
 * channel.on('postgres_changes', {
 *   event: '*',
 *   schema: 'public',
 *   table: 'users',
 *   filter: postgresChangesFilter().eq('id', 1).lt('age', 30), // → 'id=eq.1,age=lt.30'
 * }, (payload) => { ... })
 */
export class RealtimePostgresFilterBuilder {
  private readonly filters: string[] = []

  private add(
    column: string,
    operator: RealtimePostgresChangesFilterOperator,
    value: unknown,
    negate = false
  ): this {
    const prefix = negate ? 'not.' : ''
    this.filters.push(`${column}=${prefix}${serialize(operator, value)}`)
    return this
  }

  /** Match rows where `column` equals `value` (`column=eq.value`). */
  eq(column: string, value: RealtimeFilterValue): this {
    return this.add(column, 'eq', value)
  }

  /** Match rows where `column` does not equal `value` (`column=neq.value`). */
  neq(column: string, value: RealtimeFilterValue): this {
    return this.add(column, 'neq', value)
  }

  /** Match rows where `column` is greater than `value` (`column=gt.value`). */
  gt(column: string, value: RealtimeFilterValue): this {
    return this.add(column, 'gt', value)
  }

  /** Match rows where `column` is greater than or equal to `value` (`column=gte.value`). */
  gte(column: string, value: RealtimeFilterValue): this {
    return this.add(column, 'gte', value)
  }

  /** Match rows where `column` is less than `value` (`column=lt.value`). */
  lt(column: string, value: RealtimeFilterValue): this {
    return this.add(column, 'lt', value)
  }

  /** Match rows where `column` is less than or equal to `value` (`column=lte.value`). */
  lte(column: string, value: RealtimeFilterValue): this {
    return this.add(column, 'lte', value)
  }

  /**
   * Match rows where `column` is one of `values` (`column=in.(a,b,c)`).
   * Requires at least one value; duplicates are removed. An element containing a
   * reserved character is double-quoted (`in.("a,b",c)`), so commas inside an
   * element are preserved. `null` is intentionally not accepted (`IN (null)`
   * never matches in SQL) — use `is`/`not('col','is',null)` for null checks.
   */
  in(column: string, values: ReadonlyArray<string | number | boolean>): this {
    return this.add(column, 'in', values)
  }

  /** Match rows where `column` matches the case-sensitive `pattern` (`column=like.pattern`). */
  like(column: string, pattern: string): this {
    return this.add(column, 'like', pattern)
  }

  /** Match rows where `column` matches the case-insensitive `pattern` (`column=ilike.pattern`). */
  ilike(column: string, pattern: string): this {
    return this.add(column, 'ilike', pattern)
  }

  /** Match rows where `column` matches the POSIX regex `pattern` (`column=match.pattern`). */
  match(column: string, pattern: string): this {
    return this.add(column, 'match', pattern)
  }

  /** Match rows where `column` matches the case-insensitive POSIX regex `pattern` (`column=imatch.pattern`). */
  imatch(column: string, pattern: string): this {
    return this.add(column, 'imatch', pattern)
  }

  /**
   * Match rows where `column` `IS` the given value (`column=is.null`).
   * Accepts `null`, a boolean, or the keywords `'null' | 'true' | 'false' | 'unknown'`.
   */
  is(column: string, value: RealtimeIsFilterValue): this {
    return this.add(column, 'is', value)
  }

  /** Match rows where `column` is distinct from `value` (`column=isdistinct.value`). NULL-safe inequality. */
  isDistinct(column: string, value: RealtimeFilterValue): this {
    return this.add(column, 'isdistinct', value)
  }

  /**
   * Negate any operator with the `not.` prefix (`column=not.operator.value`).
   * `in` takes an array, `is` takes an `IS` keyword/boolean/null, and every
   * other operator takes a scalar value.
   *
   * @example
   * postgresChangesFilter().not('status', 'in', ['draft', 'archived'])
   * // → status=not.in.(draft,archived)
   * postgresChangesFilter().not('deleted_at', 'is', null)
   * // → deleted_at=not.is.null
   */
  not(column: string, operator: 'in', value: ReadonlyArray<string | number | boolean>): this
  not(column: string, operator: 'is', value: RealtimeIsFilterValue): this
  not(
    column: string,
    operator: Exclude<RealtimePostgresChangesFilterOperator, 'in' | 'is'>,
    value: RealtimeFilterValue
  ): this
  not(
    column: string,
    operator: RealtimePostgresChangesFilterOperator,
    value: RealtimeFilterValue | ReadonlyArray<string | number | boolean>
  ): this {
    return this.add(column, operator, value, true)
  }

  /**
   * Serialize all conditions into the comma-separated (AND) filter string.
   *
   * Conditions are joined by commas, which the server applies as `AND`. A scalar
   * value (or single `in` element) that contains a reserved character — `,`,
   * `(`, `)`, `"`, `\` — or surrounding whitespace is double-quoted and escaped
   * the way PostgREST does, so commas inside a value are preserved rather than
   * read as a condition boundary.
   */
  build(): string {
    return this.filters.join(',')
  }

  /** Alias for {@link build}; lets the builder be used wherever a string is expected. */
  toString(): string {
    return this.build()
  }
}

/**
 * Create a {@link RealtimePostgresFilterBuilder} for composing a Postgres
 * Changes `filter`. Conditions are combined with `AND`.
 *
 * @example
 * import { postgresChangesFilter } from '@supabase/realtime-js'
 *
 * channel.on('postgres_changes', {
 *   event: 'UPDATE',
 *   schema: 'public',
 *   table: 'orders',
 *   filter: postgresChangesFilter().gt('amount', 100).eq('status', 'open'),
 * }, (payload) => { ... })
 */
export const postgresChangesFilter = (): RealtimePostgresFilterBuilder =>
  new RealtimePostgresFilterBuilder()
