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
} from './types'
import { createTableProxy, TableProxy } from './proxy'

/**
 * Helper type to create a tuple of TableProxy types from a tuple of table names
 */
type TableProxies<T extends readonly string[]> = {
  [K in keyof T]: T[K] extends string ? TableProxy<T[K]> : never
}

/**
 * The main fluent query builder class.
 *
 * @example
 * const query = q()
 *   .from('users')
 *   .join('posts')
 *   .select((users, posts) => ({
 *     userName: users.name,
 *     postTitle: posts.title,
 *   }))
 */
export class FluentQueryBuilder<Tables extends readonly string[] = readonly []> {
  private readonly state: QueryBuilderState

  constructor(state: QueryBuilderState = createInitialState()) {
    this.state = state
  }

  /**
   * Start a query from a base table.
   *
   * @example
   * q().from('users')
   */
  from<TableName extends string>(tableName: TableName): FluentQueryBuilder<readonly [TableName]> {
    const newState: QueryBuilderState = {
      ...this.state,
      baseTable: tableName,
    }

    return new FluentQueryBuilder(newState)
  }

  /**
   * Join another table to the query.
   * The condition is optional - only needed when disambiguating multiple FKs.
   *
   * @example
   * // Simple join (FK auto-resolved)
   * q().from('users').join('posts')
   *
   * // With disambiguation
   * q().from('users').join('messages', (users, messages) =>
   *   eq(users.id, messages.senderId)
   * )
   */
  join<TableName extends string>(
    tableName: TableName,
    condition?: (...tables: TableProxies<readonly [...Tables, TableName]>) => AnyCondition
  ): FluentQueryBuilder<readonly [...Tables, TableName]> {
    // Evaluate the condition if provided
    let resolvedCondition: AnyCondition | undefined
    if (condition) {
      const proxies = this.createProxiesArray(tableName)
      resolvedCondition = condition(
        ...(proxies as unknown as TableProxies<readonly [...Tables, TableName]>)
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
   *
   * @example
   * q()
   *   .from('users')
   *   .join('posts')
   *   .select((users, posts) => ({
   *     userName: users.name,
   *     postTitle: posts.title,
   *   }))
   */
  select<Selection extends Record<string, FieldRef>>(
    selector: (...tables: TableProxies<Tables>) => Selection
  ): FluentQueryBuilder<Tables> {
    const proxies = this.createProxiesArray()
    const selection = selector(...(proxies as unknown as TableProxies<Tables>))

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
   * q()
   *   .from('users')
   *   .where((users) => eq(users.status, 'active'))
   */
  where(
    condition: (...tables: TableProxies<Tables>) => AnyCondition
  ): FluentQueryBuilder<Tables> {
    const proxies = this.createProxiesArray()
    const resolvedCondition = condition(...(proxies as unknown as TableProxies<Tables>))

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
   * q()
   *   .from('users')
   *   .orderBy((users) => users.createdAt, { ascending: false })
   */
  orderBy(
    field: (...tables: TableProxies<Tables>) => FieldRef,
    options: { ascending?: boolean } = {}
  ): FluentQueryBuilder<Tables> {
    const proxies = this.createProxiesArray()
    const resolvedField = field(...(proxies as unknown as TableProxies<Tables>))

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
  limit(count: number): FluentQueryBuilder<Tables> {
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
 * @example
 * import { q, eq } from './fluent-query-builder'
 *
 * const query = q()
 *   .from('users')
 *   .join('posts')
 *   .select((users, posts) => ({
 *     userName: users.name,
 *     postTitle: posts.title,
 *   }))
 */
export function q(): FluentQueryBuilder<readonly []> {
  return new FluentQueryBuilder()
}
