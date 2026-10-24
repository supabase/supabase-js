import { normalizeType, type NormalizedType } from '../printer/pg-types'
import type { AggregateOverloads } from './types'

/** Whether two type spellings name the same type: the planner's `sameTypeRef`, on the normalised spellings. */
function sameType(a: NormalizedType, b: NormalizedType): boolean {
  return a.schema === b.schema && a.name === b.name && a.dims === b.dims
}

/** A type and the base types of the domains it is a domain over, nearest first (the planner's `baseChain`). */
function baseChain(overloads: AggregateOverloads, type: string): NormalizedType[] {
  const chain: NormalizedType[] = []
  let current = normalizeType(type)
  for (let depth = 0; depth < 8; depth++) {
    chain.push(current)
    const at = current
    const domain =
      at.schema === undefined || at.dims > 0
        ? undefined
        : overloads.domains.find((d) => d.schema === at.schema && d.name === at.name)
    if (!domain) break
    current = normalizeType(domain.base)
  }
  return chain
}

/** `anyelement`, `anyarray`, `"any"`, `record`: an argument of a pseudo type takes whatever it is given. */
function polymorphic(type: string): boolean {
  const bare = type.replace(/"/g, '')
  return !bare.includes('.') && (bare.startsWith('any') || bare === 'record')
}

/**
 * Whether a function or aggregate named like the builtin aggregate may be called instead of it, for an operand of
 * type `operand` (`undefined` when it is not known, which every candidate then applies to). This is the planner's
 * `aggregateOverloaded` (`Planner/Supplementary.hs`): PostgreSQL prefers a candidate whose argument fits the operand
 * better than the builtin `count("any")`, so the builtin's type cannot be claimed. A candidate applies when its
 * argument is the operand's type or a domain base of it, a polymorphic or pseudo type, or a type the operand converts
 * to implicitly; an array argument may also be `VARIADIC`, which the catalog does not say, so its element counts too.
 * A schema of the path the catalog does not list may hold one as well.
 */
export function aggregateOverloaded(
  overloads: AggregateOverloads,
  operand: string | undefined
): boolean {
  if (overloads.unknownSchema) return true
  const operands = operand === undefined ? undefined : baseChain(overloads, operand)
  const implicit = (source: NormalizedType, target: NormalizedType): boolean =>
    overloads.implicitCasts.some(
      (c) => sameType(normalizeType(c.source), source) && sameType(normalizeType(c.target), target)
    )
  const accepts = (ops: readonly NormalizedType[], argument: string): boolean =>
    polymorphic(argument) ||
    ops.some((o) => baseChain(overloads, argument).some((t) => sameType(o, t) || implicit(o, t)))
  return overloads.candidates.some((argument) => {
    if (operands === undefined) return true
    return (
      accepts(operands, argument) ||
      (argument.endsWith('[]') && accepts(operands, argument.slice(0, -2)))
    )
  })
}
