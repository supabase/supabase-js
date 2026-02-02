/**
 * Proxy-based field reference tracking
 *
 * Creates proxy objects that track field access on tables,
 * producing FieldRef objects that can be used in conditions and selects.
 */

import { FieldRef } from './types'

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
 * Type for a proxy that creates FieldRefs when properties are accessed
 */
export type TableProxy<Alias extends string> = {
  readonly [column: string]: FieldRef<Alias, string>
} & {
  readonly [PROXY_MARKER]: true
  readonly __alias: Alias
}

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
