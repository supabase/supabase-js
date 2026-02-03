/**
 * Proxy-based field reference tracking
 *
 * Creates proxy objects that track field access on tables,
 * producing FieldRef objects that can be used in conditions and selects.
 */

import { FieldRef, TablesAndViews } from './types'
import { GenericSchema } from '../types/common/common'

/**
 * Symbol to identify proxy objects
 */
const PROXY_MARKER = Symbol('TableProxy')

/**
 * Creates a FieldRef for a specific table and column
 */
export function createFieldRef<T extends string, C extends string>(
  tableAlias: T,
  column: C
): FieldRef<T, C> {
  return {
    __type: 'FieldRef',
    __tableAlias: tableAlias,
    __column: column,
  }
}

/**
 * Checks if a value is a FieldRef
 */
export function isFieldRef(value: unknown): value is FieldRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__type' in value &&
    (value as FieldRef).__type === 'FieldRef'
  )
}

/**
 * Type for a proxy that creates FieldRefs when properties are accessed (untyped).
 * Allows any column name - used for backward compatibility.
 */
export type TableProxy<Alias extends string> = {
  readonly [column: string]: FieldRef<Alias, string>
} & {
  readonly [PROXY_MARKER]: true
  readonly __alias: Alias
}

/**
 * Schema-aware table proxy that constrains property access to actual columns.
 * When a table exists in the schema, only its columns are accessible.
 * Falls back to TableProxy for unknown tables.
 */
export type SchemaAwareTableProxy<
  Schema extends GenericSchema,
  TableName extends string,
  Alias extends string = TableName
> = TableName extends keyof TablesAndViews<Schema>
  ? {
      readonly [Col in keyof TablesAndViews<Schema>[TableName]['Row'] & string]: FieldRef<
        Alias,
        Col
      >
    } & {
      readonly [PROXY_MARKER]: true
      readonly __alias: Alias
    }
  : TableProxy<Alias>

/**
 * Helper type that creates a tuple of schema-aware proxies from a tuple of table names.
 */
export type SchemaAwareTableProxies<
  Schema,
  Tables extends readonly string[]
> = Schema extends GenericSchema
  ? { [K in keyof Tables]: Tables[K] extends string ? SchemaAwareTableProxy<Schema, Tables[K]> : never }
  : { [K in keyof Tables]: Tables[K] extends string ? TableProxy<Tables[K]> : never }

/**
 * Creates a proxy for a table that generates FieldRefs when columns are accessed.
 *
 * @example
 * const user = createTableProxy('user')
 * user.id    // Returns: FieldRef { __tableAlias: 'user', __column: 'id' }
 * user.name  // Returns: FieldRef { __tableAlias: 'user', __column: 'name' }
 */
export function createTableProxy<Alias extends string>(alias: Alias): TableProxy<Alias> {
  return new Proxy({} as TableProxy<Alias>, {
    get(_target, prop) {
      if (prop === PROXY_MARKER) return true
      if (prop === '__alias') return alias

      // For any property access, return a FieldRef
      if (typeof prop === 'string') {
        return createFieldRef(alias, prop)
      }

      return undefined
    },
  })
}

/**
 * Checks if a value is a TableProxy
 */
export function isTableProxy(value: unknown): value is TableProxy<string> {
  return typeof value === 'object' && value !== null && PROXY_MARKER in value
}
