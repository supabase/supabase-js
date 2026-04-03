/**
 * Query Generator
 *
 * Converts FluentQueryBuilder state into PostgREST query format.
 */

import {
  QueryBuilderState,
  FieldRef,
  AnyCondition,
  Condition,
  AndCondition,
  OrCondition,
  IsNullCondition,
  IsNotNullCondition,
} from './types'
import { isFieldRef } from './proxy'
import { isCondition, isAndCondition, isOrCondition } from './operators'

/**
 * Result of query generation - contains all PostgREST query components
 */
export interface GeneratedQuery {
  /** The base table name (used as the endpoint) */
  table: string
  /** The select parameter value */
  select: string
  /** Filter conditions as PostgREST query params */
  filters: Record<string, string>
  /** Order parameter value */
  order?: string
  /** Limit parameter value */
  limit?: number
}

/**
 * Converts a GeneratedQuery to a PostgREST URL query string.
 *
 * @example
 * const query = generateQuery(state)
 * const url = toPostgrestQuery(query)
 * // "/users?select=name,posts(title)&status=eq.active&order=createdAt.desc&limit=10"
 */
export function toPostgrestQuery(query: GeneratedQuery): string {
  const params: string[] = []

  // Add select parameter
  if (query.select !== '*') {
    params.push(`select=${query.select}`)
  }

  // Add filter parameters
  for (const [key, value] of Object.entries(query.filters)) {
    params.push(`${key}=${value}`)
  }

  // Add order parameter
  if (query.order) {
    params.push(`order=${query.order}`)
  }

  // Add limit parameter
  if (query.limit !== undefined) {
    params.push(`limit=${query.limit}`)
  }

  const queryString = params.join('&')
  return `/${query.table}${queryString ? '?' + queryString : ''}`
}

/**
 * Generates a PostgREST query from the builder state.
 *
 * @example
 * const state = q()
 *   .from('users')
 *   .join('posts')
 *   .select((users, posts) => ({ userName: users.name, postTitle: posts.title }))
 *   .getState()
 *
 * const query = generateQuery(state)
 * // { table: 'users', select: 'name,posts(title)', filters: {} }
 */
export function generateQuery(state: QueryBuilderState): GeneratedQuery {
  if (!state.baseTable) {
    throw new Error('Query must have a base table. Call from() first.')
  }

  const table = state.baseTable
  const select = generateSelect(state)
  const filters = generateFilters(state)
  const order = generateOrder(state)

  return {
    table,
    select,
    filters,
    ...(order && { order }),
    ...(state.limit !== null && { limit: state.limit }),
  }
}

/**
 * Generate the select parameter for PostgREST.
 *
 * Maps the fluent select to PostgREST's embedded resource syntax:
 * - Base table fields: just the column name
 * - Joined table fields: tableName(column1,column2)
 */
function generateSelect(state: QueryBuilderState): string {
  if (!state.selectFields || !state.baseTable) {
    return '*'
  }

  const baseTableName = state.baseTable

  // Group fields by their table name
  const fieldsByTable = new Map<string, { outputAlias: string; column: string }[]>()

  for (const [outputAlias, fieldRef] of Object.entries(state.selectFields)) {
    const tableName = fieldRef.__tableAlias
    if (!fieldsByTable.has(tableName)) {
      fieldsByTable.set(tableName, [])
    }
    fieldsByTable.get(tableName)!.push({ outputAlias, column: fieldRef.__column })
  }

  const selectParts: string[] = []

  // Process base table fields first
  const baseFields = fieldsByTable.get(baseTableName)
  if (baseFields) {
    for (const field of baseFields) {
      // For now, just use the column name (aliasing can be added later)
      selectParts.push(field.column)
    }
    fieldsByTable.delete(baseTableName)
  }

  // Process joined tables - create embedded resources
  for (const join of state.joins) {
    const joinFields = fieldsByTable.get(join.tableName)
    if (joinFields) {
      const columns = joinFields.map((f) => f.column).join(',')
      // Use the actual table name for the embedded resource
      // If there's a disambiguation condition, we'd add the FK hint here
      const hint = generateJoinHint(join, state)
      selectParts.push(`${join.tableName}${hint}(${columns})`)
      fieldsByTable.delete(join.tableName)
    }
  }

  return selectParts.join(',')
}

/**
 * Generate FK hint for join disambiguation.
 * Returns empty string if no disambiguation needed.
 */
function generateJoinHint(
  join: { tableName: string; condition?: AnyCondition },
  state: QueryBuilderState
): string {
  if (!join.condition) {
    return ''
  }

  // Extract the column from the condition that belongs to the joined table
  // This is used as a hint for PostgREST to disambiguate multiple FKs
  const condition = join.condition
  if (isCondition(condition) && condition.operator === '=') {
    // Check which side of the condition references the joined table
    const leftRef = condition.left
    const rightRef = condition.right

    if (leftRef.__tableAlias === join.tableName) {
      // The joined table's column is on the left
      return `!${leftRef.__column}`
    } else if (isFieldRef(rightRef) && rightRef.__tableAlias === join.tableName) {
      // The joined table's column is on the right
      return `!${rightRef.__column}`
    }
  }

  return ''
}

/**
 * Generate filter parameters for PostgREST.
 */
function generateFilters(state: QueryBuilderState): Record<string, string> {
  const filters: Record<string, string> = {}

  for (const condition of state.whereConditions) {
    const filterEntries = conditionToFilter(condition, state)
    Object.assign(filters, filterEntries)
  }

  return filters
}

/**
 * Convert a condition to PostgREST filter format.
 */
function conditionToFilter(
  condition: AnyCondition | IsNullCondition | IsNotNullCondition,
  state: QueryBuilderState
): Record<string, string> {
  if (isCondition(condition)) {
    return simpleConditionToFilter(condition, state)
  }

  if (isAndCondition(condition)) {
    // For AND, we can just add multiple filters (PostgREST ANDs them by default)
    const result: Record<string, string> = {}
    for (const c of condition.conditions) {
      Object.assign(result, conditionToFilter(c, state))
    }
    return result
  }

  if (isOrCondition(condition)) {
    // For OR, we need to use PostgREST's or syntax
    const orParts = condition.conditions.map((c) => conditionToFilterString(c, state))
    return { or: `(${orParts.join(',')})` }
  }

  // IsNull / IsNotNull conditions
  if ('__type' in condition) {
    if (condition.__type === 'IsNull') {
      const col = resolveColumnName(condition.field, state)
      return { [col]: 'is.null' }
    }
    if (condition.__type === 'IsNotNull') {
      const col = resolveColumnName(condition.field, state)
      return { [col]: 'not.is.null' }
    }
  }

  return {}
}

/**
 * Convert a simple condition to PostgREST filter format.
 */
function simpleConditionToFilter(
  condition: Condition,
  state: QueryBuilderState
): Record<string, string> {
  const column = resolveColumnName(condition.left, state)
  const operator = operatorToPostgrest(condition.operator)
  const value = isFieldRef(condition.right)
    ? resolveColumnName(condition.right, state)
    : String(condition.right)

  return { [column]: `${operator}.${value}` }
}

/**
 * Convert a condition to a filter string (for use in or() expressions).
 */
function conditionToFilterString(
  condition: AnyCondition | IsNullCondition | IsNotNullCondition,
  state: QueryBuilderState
): string {
  if (isCondition(condition)) {
    const column = resolveColumnName(condition.left, state)
    const operator = operatorToPostgrest(condition.operator)
    const value = isFieldRef(condition.right)
      ? resolveColumnName(condition.right, state)
      : String(condition.right)
    return `${column}.${operator}.${value}`
  }

  if (isAndCondition(condition)) {
    const andParts = condition.conditions.map((c) => conditionToFilterString(c, state))
    return `and(${andParts.join(',')})`
  }

  if (isOrCondition(condition)) {
    const orParts = condition.conditions.map((c) => conditionToFilterString(c, state))
    return `or(${orParts.join(',')})`
  }

  // IsNull / IsNotNull
  if ('__type' in condition) {
    if (condition.__type === 'IsNull') {
      const col = resolveColumnName(condition.field, state)
      return `${col}.is.null`
    }
    if (condition.__type === 'IsNotNull') {
      const col = resolveColumnName(condition.field, state)
      return `${col}.not.is.null`
    }
  }

  return ''
}

/**
 * Resolve a FieldRef to a column name, potentially with table prefix for joined tables.
 */
function resolveColumnName(field: FieldRef, state: QueryBuilderState): string {
  // For the base table, just use the column name
  if (state.baseTable && field.__tableAlias === state.baseTable) {
    return field.__column
  }

  // For joined tables, we might need to prefix with the table name
  // For now, just use the column name (PostgREST handles this via the select)
  return field.__column
}

/**
 * Convert our operator to PostgREST operator.
 */
function operatorToPostgrest(operator: string): string {
  switch (operator) {
    case '=':
      return 'eq'
    case '!=':
      return 'neq'
    case '>':
      return 'gt'
    case '>=':
      return 'gte'
    case '<':
      return 'lt'
    case '<=':
      return 'lte'
    default:
      return 'eq'
  }
}

/**
 * Generate the order parameter for PostgREST.
 */
function generateOrder(state: QueryBuilderState): string | undefined {
  if (state.orderBy.length === 0) {
    return undefined
  }

  return state.orderBy
    .map((o) => {
      const column = resolveColumnName(o.field, state)
      return o.ascending ? column : `${column}.desc`
    })
    .join(',')
}
