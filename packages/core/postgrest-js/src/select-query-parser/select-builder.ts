/**
 * Array-based select query builder types and serialization.
 *
 * This module provides type-safe building blocks for constructing PostgREST
 * select queries using arrays and objects instead of string templates.
 * This enables IDE autocomplete and compile-time validation.
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Aggregate functions supported by PostgREST.
 */
export type AggregateFunction = 'count' | 'sum' | 'avg' | 'min' | 'max'

/**
 * Field/column selection specification.
 *
 * @example
 * // Simple column
 * { column: 'id' }
 *
 * // With alias: display_name:username
 * { column: 'username', as: 'display_name' }
 *
 * // With cast: created_at::text
 * { column: 'created_at', cast: 'text' }
 *
 * // JSON path: data->settings->theme
 * { column: 'data', json: ['settings', 'theme'] }
 *
 * // JSON as text: data->>name
 * { column: 'data', jsonText: ['name'] }
 *
 * // Aggregate: id.sum()
 * { column: 'id', aggregate: 'sum' }
 */
export interface FieldSpec {
  /** Column name */
  column: string
  /** Alias for the result (alias:column) */
  as?: string
  /** Type cast (::type) */
  cast?: string
  /** JSON path using -> operator (returns JSON) */
  json?: string[]
  /** JSON path using ->> operator (returns text) */
  jsonText?: string[]
  /** Aggregate function to apply (.func()) */
  aggregate?: AggregateFunction
}

/**
 * Relation/join selection specification.
 *
 * @example
 * // Simple relation: posts(id, title)
 * { relation: 'posts', select: ['id', 'title'] }
 *
 * // With alias: author:users(id, name)
 * { relation: 'users', as: 'author', select: ['id', 'name'] }
 *
 * // Inner join: posts!inner(id)
 * { relation: 'posts', inner: true, select: ['id'] }
 *
 * // FK hint: users!author_id(id)
 * { relation: 'users', hint: 'author_id', select: ['id'] }
 *
 * // Hint + inner: users!author_id!inner(id)
 * { relation: 'users', hint: 'author_id', inner: true, select: ['id'] }
 */
export interface RelationSpec {
  /** Relation/table name */
  relation: string
  /** Alias for the result (alias:relation) */
  as?: string
  /** Foreign key hint for disambiguation (!hint) */
  hint?: string
  /** Inner join - filter parent if no match (!inner) */
  inner?: boolean
  /** Left join - explicit, currently no-op in PostgREST (!left) */
  left?: boolean
  /** Nested selection for the relation */
  select: SelectSpec
}

/**
 * Spread operation specification.
 *
 * @example
 * // Spread: ...profile(status, bio)
 * { spread: true, relation: 'profile', select: ['status', 'bio'] }
 *
 * // Spread with hint: ...users!author_id(name)
 * { spread: true, relation: 'users', hint: 'author_id', select: ['name'] }
 */
export interface SpreadSpec {
  /** Marks this as a spread operation */
  spread: true
  /** Relation to spread from */
  relation: string
  /** Foreign key hint for disambiguation */
  hint?: string
  /** Fields to select from the spread relation */
  select: SelectSpec
}

/**
 * Top-level count specification.
 *
 * @example
 * // Simple count: count()
 * { count: true }
 *
 * // With alias: total:count()
 * { count: true, as: 'total' }
 *
 * // With cast: count()::text
 * { count: true, cast: 'text' }
 */
export interface CountSpec {
  /** Marks this as a count operation */
  count: true
  /** Alias for the count result */
  as?: string
  /** Type cast for the count result */
  cast?: string
}

/**
 * Single item in a select array.
 *
 * Can be:
 * - A string (column name)
 * - A FieldSpec (column with options)
 * - A RelationSpec (embedded relation)
 * - A SpreadSpec (spread operation)
 * - A CountSpec (count operation)
 */
export type SelectItem = string | FieldSpec | RelationSpec | SpreadSpec | CountSpec

/**
 * Full select specification.
 *
 * Can be:
 * - A string (for backward compatibility with existing string queries)
 * - An array of SelectItem (the new typed API)
 */
export type SelectSpec = string | SelectItem[]

// ============================================================================
// Type Guards
// ============================================================================

function isFieldSpec(item: SelectItem): item is FieldSpec {
  return typeof item === 'object' && 'column' in item
}

function isRelationSpec(item: SelectItem): item is RelationSpec {
  return typeof item === 'object' && 'relation' in item && !('spread' in item)
}

function isSpreadSpec(item: SelectItem): item is SpreadSpec {
  return typeof item === 'object' && 'spread' in item && item.spread === true
}

function isCountSpec(item: SelectItem): item is CountSpec {
  return typeof item === 'object' && 'count' in item && item.count === true
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serializes a FieldSpec to PostgREST query string format.
 */
function serializeFieldSpec(spec: FieldSpec): string {
  let result = ''

  // Handle alias prefix: alias:column
  if (spec.as) {
    result += `${spec.as}:`
  }

  // Add column name
  result += spec.column

  // Handle JSON path
  if (spec.json && spec.json.length > 0) {
    result += '->' + spec.json.join('->')
  } else if (spec.jsonText && spec.jsonText.length > 0) {
    // For jsonText, all but the last use ->, the last uses ->>
    if (spec.jsonText.length === 1) {
      result += '->>' + spec.jsonText[0]
    } else {
      const allButLast = spec.jsonText.slice(0, -1)
      const last = spec.jsonText[spec.jsonText.length - 1]
      result += '->' + allButLast.join('->') + '->>' + last
    }
  }

  // Handle aggregate: .func()
  if (spec.aggregate) {
    result += `.${spec.aggregate}()`
  }

  // Handle type cast: ::type (comes after aggregate if present)
  if (spec.cast) {
    result += `::${spec.cast}`
  }

  return result
}

/**
 * Serializes a CountSpec to PostgREST query string format.
 */
function serializeCountSpec(spec: CountSpec): string {
  let result = ''

  // Handle alias prefix: alias:count()
  if (spec.as) {
    result += `${spec.as}:`
  }

  result += 'count()'

  // Handle type cast: ::type
  if (spec.cast) {
    result += `::${spec.cast}`
  }

  return result
}

/**
 * Serializes a RelationSpec to PostgREST query string format.
 */
function serializeRelationSpec(spec: RelationSpec): string {
  let result = ''

  // Handle alias prefix: alias:relation
  if (spec.as) {
    result += `${spec.as}:`
  }

  // Add relation name
  result += spec.relation

  // Handle hint: !hint
  if (spec.hint) {
    result += `!${spec.hint}`
  }

  // Handle inner join: !inner
  if (spec.inner) {
    result += '!inner'
  }

  // Handle left join: !left
  if (spec.left) {
    result += '!left'
  }

  // Add nested select: (fields)
  result += `(${serializeSelectSpec(spec.select)})`

  return result
}

/**
 * Serializes a SpreadSpec to PostgREST query string format.
 */
function serializeSpreadSpec(spec: SpreadSpec): string {
  let result = '...'

  // Add relation name
  result += spec.relation

  // Handle hint: !hint
  if (spec.hint) {
    result += `!${spec.hint}`
  }

  // Add nested select: (fields)
  result += `(${serializeSelectSpec(spec.select)})`

  return result
}

/**
 * Serializes a single SelectItem to PostgREST query string format.
 */
function serializeSelectItem(item: SelectItem): string {
  // String items are just column names
  if (typeof item === 'string') {
    return item
  }

  // Handle different spec types
  if (isCountSpec(item)) {
    return serializeCountSpec(item)
  }

  if (isSpreadSpec(item)) {
    return serializeSpreadSpec(item)
  }

  if (isRelationSpec(item)) {
    return serializeRelationSpec(item)
  }

  if (isFieldSpec(item)) {
    return serializeFieldSpec(item)
  }

  // Fallback (should never happen with proper types)
  return ''
}

/**
 * Serializes a SelectSpec to PostgREST query string format.
 *
 * @param spec - The select specification (string or array of SelectItem)
 * @returns The serialized query string
 *
 * @example
 * // String passthrough
 * serializeSelectSpec('id, name') // 'id, name'
 *
 * // Simple columns
 * serializeSelectSpec(['id', 'name', 'email']) // 'id,name,email'
 *
 * // With alias
 * serializeSelectSpec([{ column: 'username', as: 'display_name' }])
 * // 'display_name:username'
 *
 * // With relation
 * serializeSelectSpec(['id', { relation: 'posts', select: ['id', 'title'] }])
 * // 'id,posts(id,title)'
 *
 * // Complex
 * serializeSelectSpec([
 *   'id',
 *   { column: 'name', as: 'display_name' },
 *   { relation: 'posts', inner: true, select: ['id'] }
 * ])
 * // 'id,display_name:name,posts!inner(id)'
 */
export function serializeSelectSpec(spec: SelectSpec): string {
  // String specs pass through unchanged
  if (typeof spec === 'string') {
    return spec
  }

  // Serialize each item and join with commas
  return spec.map(serializeSelectItem).join(',')
}

/**
 * Checks if a SelectSpec is an array-based spec (vs string).
 */
export function isArraySelectSpec(spec: SelectSpec): spec is SelectItem[] {
  return Array.isArray(spec)
}
