/**
 * FluentQueryBuilder
 *
 * A fluent, type-safe query builder for PostgREST with join support.
 */

import {
  QueryBuilderState,
  createInitialState,
  FieldRef,
  AnyCondition,
  JoinedTable,
  ValidTableName,
} from './types'
import { createTableProxy, TableProxy, SchemaAwareTableProxies } from './proxy'
import { GenericSchema } from '../types/common/common'

/**
 * The main fluent query builder class.
 *
 * @typeParam Schema - Database schema type for type-safe column access (optional)
 * @typeParam Tables - Tuple of table names currently in the query
 *
 * @example
 * // Typed usage with schema
 * const query = q<Database>()
 *   .from('users')
 *   .select((users) => ({ name: users.name }))
 *
 * // Untyped usage (backward compatible)
 * const query = q()
 *   .from('users')
 *   .join('posts')
 *   .select((users, posts) => ({
 *     userName: users.name,
 *     postTitle: posts.title,
 *   }))
 */
export class FluentQueryBuilder<Schema = unknown, Tables extends readonly string[] = readonly []> {
  private readonly state: QueryBuilderState

  constructor(state: QueryBuilderState = createInitialState()) {
    this.state = state
  }

  /**
   * Start a query from a base table.
   * When Schema is provided, tableName is constrained to valid table/view names.
   *
   * @example
   * q<Database>().from('users')  // Validates 'users' exists in schema
   * q().from('any_table')        // Allows any table name (untyped)
   */
  from<TableName extends ValidTableName<Schema>>(
    tableName: TableName
  ): FluentQueryBuilder<Schema, readonly [TableName]> {
    const newState: QueryBuilderState = {
      ...this.state,
      baseTable: tableName,
    }

    return new FluentQueryBuilder(newState)
  }

  /**
   * Join another table to the query.
   * The condition is optional - only needed when disambiguating multiple FKs.
   * Column access in the condition callback is type-checked against the schema.
   *
   * @example
   * // Simple join (FK auto-resolved)
   * q<Database>().from('users').join('posts')
   *
   * // With disambiguation
   * q<Database>().from('users').join('messages', (users, messages) =>
   *   eq(users.id, messages.senderId)
   * )
   */
  join<TableName extends ValidTableName<Schema>>(
    tableName: TableName,
    condition?: (
      ...tables: SchemaAwareTableProxies<Schema, readonly [...Tables, TableName]>
    ) => AnyCondition
  ): FluentQueryBuilder<Schema, readonly [...Tables, TableName]> {
    // Evaluate the condition if provided
    let resolvedCondition: AnyCondition | undefined
    if (condition) {
      const proxies = this.createProxiesArray(tableName)
      resolvedCondition = condition(
        ...(proxies as unknown as SchemaAwareTableProxies<Schema, readonly [...Tables, TableName]>)
      )
    }

    const joinedTable: JoinedTable = {
      tableName,
      condition: resolvedCondition,
    }

    const newState: QueryBuilderState = {
      ...this.state,
      joins: [...this.state.joins, joinedTable],
    }

    return new FluentQueryBuilder(newState)
  }

  /**
   * Define the fields to select from the query.
   * Column access is validated against schema types.
   *
   * @example
   * q<Database>()
   *   .from('users')
   *   .join('posts')
   *   .select((users, posts) => ({
   *     userName: users.name,
   *     postTitle: posts.title,
   *   }))
   */
  select<Selection extends Record<string, FieldRef>>(
    selector: (...tables: SchemaAwareTableProxies<Schema, Tables>) => Selection
  ): FluentQueryBuilder<Schema, Tables> {
    const proxies = this.createProxiesArray()
    const selection = selector(...(proxies as unknown as SchemaAwareTableProxies<Schema, Tables>))

    const newState: QueryBuilderState = {
      ...this.state,
      selectFields: selection,
    }

    return new FluentQueryBuilder(newState)
  }

  /**
   * Add a where condition to filter results.
   *
   * @example
   * q<Database>()
   *   .from('users')
   *   .where((users) => eq(users.status, 'active'))
   */
  where(
    condition: (...tables: SchemaAwareTableProxies<Schema, Tables>) => AnyCondition
  ): FluentQueryBuilder<Schema, Tables> {
    const proxies = this.createProxiesArray()
    const resolvedCondition = condition(
      ...(proxies as unknown as SchemaAwareTableProxies<Schema, Tables>)
    )

    const newState: QueryBuilderState = {
      ...this.state,
      whereConditions: [...this.state.whereConditions, resolvedCondition],
    }

    return new FluentQueryBuilder(newState)
  }

  /**
   * Add ordering to the query.
   *
   * @example
   * q<Database>()
   *   .from('users')
   *   .orderBy((users) => users.createdAt, { ascending: false })
   */
  orderBy(
    field: (...tables: SchemaAwareTableProxies<Schema, Tables>) => FieldRef,
    options: { ascending?: boolean } = {}
  ): FluentQueryBuilder<Schema, Tables> {
    const proxies = this.createProxiesArray()
    const resolvedField = field(...(proxies as unknown as SchemaAwareTableProxies<Schema, Tables>))

    const newState: QueryBuilderState = {
      ...this.state,
      orderBy: [
        ...this.state.orderBy,
        { field: resolvedField, ascending: options.ascending ?? true },
      ],
    }

    return new FluentQueryBuilder(newState)
  }

  /**
   * Limit the number of results.
   *
   * @example
   * q().from('users').limit(10)
   */
  limit(count: number): FluentQueryBuilder<Schema, Tables> {
    const newState: QueryBuilderState = {
      ...this.state,
      limit: count,
    }

    return new FluentQueryBuilder(newState)
  }

  /**
   * Get the current query state (for debugging or query generation).
   */
  getState(): QueryBuilderState {
    return this.state
  }

  /**
   * Get the list of table names in order (base table + joins).
   */
  private getTableList(additionalTable?: string): string[] {
    const tables: string[] = []

    if (this.state.baseTable) {
      tables.push(this.state.baseTable)
    }

    for (const join of this.state.joins) {
      tables.push(join.tableName)
    }

    if (additionalTable) {
      tables.push(additionalTable)
    }

    return tables
  }

  /**
   * Create an array of table proxies in order.
   */
  private createProxiesArray(additionalTable?: string): TableProxy<string>[] {
    const tables = this.getTableList(additionalTable)
    return tables.map((tableName) => createTableProxy(tableName))
  }
}

/**
 * Create a new fluent query builder.
 *
 * @typeParam Schema - Optional database schema type for type-safe column access
 *
 * @example
 * // With schema type (recommended) - provides autocomplete and type errors
 * import { q, eq } from './fluent-query-builder'
 *
 * const query = q<Database>()
 *   .from('users')  // Validates 'users' exists
 *   .select((users) => ({
 *     name: users.name,  // Validates 'name' column exists
 *   }))
 *
 * @example
 * // Without schema (backward compatible) - allows any table/column
 * const query = q()
 *   .from('users')
 *   .join('posts')
 *   .select((users, posts) => ({
 *     userName: users.name,
 *     postTitle: posts.title,
 *   }))
 */
export function q<Schema extends GenericSchema>(): FluentQueryBuilder<Schema, readonly []>
export function q(): FluentQueryBuilder<unknown, readonly []>
export function q<Schema = unknown>(): FluentQueryBuilder<Schema, readonly []> {
  return new FluentQueryBuilder()
}
