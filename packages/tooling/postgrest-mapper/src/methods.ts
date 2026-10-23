/**
 * The scanner works on calls by method name, whatever the receiver is. These lists name the builder methods it
 * understands. A type test (`test/method-drift.test.ts`) checks them against postgrest-js's builders, so a new filter
 * method can't ship without scanner coverage.
 */

/** Builder methods whose first argument is a column (`const C extends string`). */
export const COLUMN_METHODS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'likeAllOf',
  'likeAnyOf',
  'ilike',
  'ilikeAllOf',
  'ilikeAnyOf',
  'regexMatch',
  'regexIMatch',
  'is',
  'isDistinct',
  'in',
  'notIn',
  'contains',
  'containedBy',
  'rangeGt',
  'rangeGte',
  'rangeLt',
  'rangeLte',
  'rangeAdjacent',
  'overlaps',
  'textSearch',
  'not',
  'filter',
  'order',
] as const

/** The method whose argument is an object whose keys are columns. */
export const MATCH_METHODS = ['match'] as const

/**
 * Methods with a `{ referencedTable }` option naming an embed. `order` and `filter` are in `COLUMN_METHODS` too; with
 * the option, the column belongs to the embed and `@t` is recorded instead.
 */
export const REFERENCED_TABLE_METHODS = ['order', 'filter', 'or', 'limit', 'range'] as const

/** Position of the options argument in each `REFERENCED_TABLE_METHODS` call. */
export const OPTIONS_ARG_INDEX: Record<(typeof REFERENCED_TABLE_METHODS)[number], number> = {
  order: 1,
  filter: 3,
  or: 1,
  limit: 1,
  range: 2,
}

export type ColumnMethod = (typeof COLUMN_METHODS)[number]
export type ReferencedTableMethod = (typeof REFERENCED_TABLE_METHODS)[number]

export const MUTATION_METHODS = {
  insert: 'POST',
  upsert: 'POST',
  update: 'PATCH',
  delete: 'DELETE',
} as const

export const COLUMN_METHOD_SET: ReadonlySet<string> = new Set(COLUMN_METHODS)
export const MATCH_METHOD_SET: ReadonlySet<string> = new Set(MATCH_METHODS)
export const REFERENCED_TABLE_METHOD_SET: ReadonlySet<string> = new Set(REFERENCED_TABLE_METHODS)

/** Receivers whose `.from()` is never a builder (`Array.from('x')`): not a chain root. */
export const NOT_A_CLIENT = new Set([
  'Array',
  'Buffer',
  'Observable',
  'Object',
  'Map',
  'Set',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
])

/** Past this many alternatives (nested conditionals) a value counts as unresolved. */
export const MAX_RESOLVED_VALUES = 256

/** Fallback pairs planned per file (v5 §4.2). */
export const FALLBACK_PAIR_LIMIT = 64
