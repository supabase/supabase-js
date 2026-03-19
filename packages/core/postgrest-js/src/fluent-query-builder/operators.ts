/**
 * Condition operators for the fluent query builder
 *
 * These operators create condition objects that can be used in
 * join disambiguation and where clauses.
 */

import {
  FieldRef,
  Condition,
  AndCondition,
  OrCondition,
  AnyCondition,
  IsNullCondition,
  IsNotNullCondition,
} from './types'
import { isFieldRef } from './proxy'

/**
 * Creates an equality condition (=)
 *
 * @example
 * eq(user.id, post.userId)  // user.id = post.userId
 * eq(user.status, 'active') // user.status = 'active'
 */
export function eq(left: FieldRef, right: FieldRef | unknown): Condition {
  return {
    __type: 'Condition',
    left,
    operator: '=',
    right,
  }
}

/**
 * Creates a not-equal condition (!=)
 *
 * @example
 * neq(user.status, 'deleted')
 */
export function neq(left: FieldRef, right: FieldRef | unknown): Condition {
  return {
    __type: 'Condition',
    left,
    operator: '!=',
    right,
  }
}

/**
 * Creates a greater-than condition (>)
 *
 * @example
 * gt(user.age, 18)
 */
export function gt(left: FieldRef, right: FieldRef | unknown): Condition {
  return {
    __type: 'Condition',
    left,
    operator: '>',
    right,
  }
}

/**
 * Creates a greater-than-or-equal condition (>=)
 *
 * @example
 * gte(user.age, 18)
 */
export function gte(left: FieldRef, right: FieldRef | unknown): Condition {
  return {
    __type: 'Condition',
    left,
    operator: '>=',
    right,
  }
}

/**
 * Creates a less-than condition (<)
 *
 * @example
 * lt(user.age, 65)
 */
export function lt(left: FieldRef, right: FieldRef | unknown): Condition {
  return {
    __type: 'Condition',
    left,
    operator: '<',
    right,
  }
}

/**
 * Creates a less-than-or-equal condition (<=)
 *
 * @example
 * lte(user.age, 65)
 */
export function lte(left: FieldRef, right: FieldRef | unknown): Condition {
  return {
    __type: 'Condition',
    left,
    operator: '<=',
    right,
  }
}

/**
 * Creates an AND condition combining multiple conditions
 *
 * @example
 * and(eq(user.status, 'active'), gt(user.age, 18))
 */
export function and(...conditions: AnyCondition[]): AndCondition {
  return {
    __type: 'And',
    conditions,
  }
}

/**
 * Creates an OR condition combining multiple conditions
 *
 * @example
 * or(eq(user.role, 'admin'), eq(user.role, 'moderator'))
 */
export function or(...conditions: AnyCondition[]): OrCondition {
  return {
    __type: 'Or',
    conditions,
  }
}

/**
 * Creates an IS NULL condition
 *
 * @example
 * isNull(user.deletedAt)
 */
export function isNull(field: FieldRef): IsNullCondition {
  return {
    __type: 'IsNull',
    field,
  }
}

/**
 * Creates an IS NOT NULL condition
 *
 * @example
 * isNotNull(user.email)
 */
export function isNotNull(field: FieldRef): IsNotNullCondition {
  return {
    __type: 'IsNotNull',
    field,
  }
}

/**
 * Type guard to check if a condition is a comparison condition
 */
export function isCondition(value: unknown): value is Condition {
  return typeof value === 'object' && value !== null && (value as Condition).__type === 'Condition'
}

/**
 * Type guard for AND conditions
 */
export function isAndCondition(value: unknown): value is AndCondition {
  return typeof value === 'object' && value !== null && (value as AndCondition).__type === 'And'
}

/**
 * Type guard for OR conditions
 */
export function isOrCondition(value: unknown): value is OrCondition {
  return typeof value === 'object' && value !== null && (value as OrCondition).__type === 'Or'
}
