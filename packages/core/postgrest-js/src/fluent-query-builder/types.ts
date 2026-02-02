/**
 * Fluent Query Builder Types
 *
 * Core type definitions for the fluent query builder API.
 */

/**
 * A reference to a specific column in a table.
 * Created by the proxy system when accessing table.column
 */
export interface FieldRef<
  TableAlias extends string = string,
  ColumnName extends string = string,
> {
  readonly __type: 'FieldRef'
  readonly __tableAlias: TableAlias
  readonly __column: ColumnName
}

/**
 * Supported comparison operators
 */
export type ComparisonOperator = '=' | '!=' | '>' | '>=' | '<' | '<='

/**
 * A condition comparing two values (used in join disambiguation and where clauses)
 */
export interface Condition {
  readonly __type: 'Condition'
  readonly left: FieldRef
  readonly operator: ComparisonOperator
  readonly right: FieldRef | unknown
}

/**
 * Logical operators for combining conditions
 */
export interface AndCondition {
  readonly __type: 'And'
  readonly conditions: readonly (Condition | AndCondition | OrCondition)[]
}

export interface OrCondition {
  readonly __type: 'Or'
  readonly conditions: readonly (Condition | AndCondition | OrCondition)[]
}

export type AnyCondition = Condition | AndCondition | OrCondition

/**
 * Null check conditions
 */
export interface IsNullCondition {
  readonly __type: 'IsNull'
  readonly field: FieldRef
}

export interface IsNotNullCondition {
  readonly __type: 'IsNotNull'
  readonly field: FieldRef
}

/**
 * List of table names in the query (base table + joins in order).
 * e.g., ['users', 'posts', 'comments']
 */
export type TableList = readonly string[]

/**
 * Represents a joined table in the query
 */
export interface JoinedTable {
  readonly tableName: string
  readonly condition?: AnyCondition
}

/**
 * Internal state of the query builder
 */
export interface QueryBuilderState {
  readonly baseTable: string | null
  readonly joins: readonly JoinedTable[]
  readonly selectFields: Record<string, FieldRef> | null
  readonly whereConditions: readonly AnyCondition[]
  readonly orderBy: readonly { field: FieldRef; ascending: boolean }[]
  readonly limit: number | null
}

/**
 * Creates an empty initial state for the query builder
 */
export function createInitialState(): QueryBuilderState {
  return {
    baseTable: null,
    joins: [],
    selectFields: null,
    whereConditions: [],
    orderBy: [],
    limit: null,
  }
}
