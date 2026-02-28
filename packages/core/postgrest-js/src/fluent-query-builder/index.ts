/**
 * Fluent Query Builder
 *
 * A more ergonomic, type-safe query builder API for PostgREST.
 */

// Main builder
export { FluentQueryBuilder, q } from './FluentQueryBuilder'

// Types
export type {
  FieldRef,
  Condition,
  AndCondition,
  OrCondition,
  AnyCondition,
  IsNullCondition,
  IsNotNullCondition,
  ComparisonOperator,
  TableList,
  JoinedTable,
  QueryBuilderState,
  // Schema helper types
  TablesAndViews,
  TableRow,
  ValidTableName,
} from './types'

export { createInitialState } from './types'

// Proxy utilities
export { createFieldRef, createTableProxy, isFieldRef, isTableProxy } from './proxy'

export type { TableProxy, SchemaAwareTableProxy, SchemaAwareTableProxies } from './proxy'

// Operators
export {
  eq,
  neq,
  gt,
  gte,
  lt,
  lte,
  and,
  or,
  isNull,
  isNotNull,
  isCondition,
  isAndCondition,
  isOrCondition,
} from './operators'

// Query generator
export { generateQuery, toPostgrestQuery } from './query-generator'
export type { GeneratedQuery } from './query-generator'
