import type { OperandRequest, PlanTarget, SelectRequest } from './types'

/**
 * The key a `SupabaseSelects` entry is stored under, for one concrete schema: `${kind}|${schema}|${relation}|${select}`,
 * with the function name as `relation` for kind `f` (`Key` in postgrest-js `src/types/planner/lookup.ts`). The select is
 * the raw cooked string. An rpc entry's key doesn't carry the key set or the method: they live in the entry's `calls`.
 */
export function selectKey(target: PlanTarget, schema: string, select: string): string {
  const name = target.kind === 'f' ? target.function : target.relation
  return `${target.kind}|${schema}|${name}|${select}`
}

/** The key of a `SupabaseOperands` entry: the select key plus `|operand` (`OKey` in `lookup.ts`). */
export function operandKey(
  target: PlanTarget,
  schema: string,
  select: string,
  operand: string
): string {
  return `${selectKey(target, schema, select)}|${operand}`
}

/**
 * The key of a `SupabaseOperands` entry for an `.order()` column: `order|` before the select key
 * (`OrdKey` in `lookup.ts`). A select key starts with its kind (`r`, `w` or `f`), so no filter operand key can be one
 * of these, whatever the column is called.
 */
export function orderKey(
  target: PlanTarget,
  schema: string,
  select: string,
  column: string
): string {
  return `order|${operandKey(target, schema, select, column)}`
}

/** Every concrete key of a request, one per schema (`'exposed'` has none until it is expanded). */
export function requestKeys(request: SelectRequest | OperandRequest): string[] {
  const { target, select } = request
  if (target.schemas === 'exposed') return []
  return target.schemas.map((schema) =>
    'operand' in request
      ? (request.via === 'order' ? orderKey : operandKey)(target, schema, select, request.operand)
      : selectKey(target, schema, select)
  )
}

/**
 * The key of a relation in the maps the generation shares between the planner step, the cache and the printers
 * (`plans`, `traces`): `schema.name`, with a dot or a backslash inside either part escaped, so `public."a.b"` and
 * `"public.a".b` are two keys. An ordinary name reads `public.users`. This is an internal identity, not an emitted
 * string: `SupabaseColumnType` keys and type names keep their own spelling.
 */
export function relationKey(schema: string, name: string): string {
  const escape = (part: string): string => part.replace(/[\\.]/g, '\\$&')
  return `${escape(schema)}.${escape(name)}`
}

/** A stored column: its relation and its name. */
export interface ColumnRef {
  schema: string
  relation: string
  column: string
}

/**
 * The key of a column in the maps the generation shares between the planner step, the cache and the printers
 * (`jsonSchemas`): the three parts as a JSON array, so no choice of names makes two columns one key. An internal
 * identity, not an emitted string: `columnTypeKey` is what a `SupabaseColumnType` is keyed by.
 */
export function columnKey(column: ColumnRef): string {
  return JSON.stringify([column.schema, column.relation, column.column])
}

/**
 * The key a `SupabaseColumnType<K, ...>` carries: `schema.relation.column`, the spelling `SupabaseColumnTypes`
 * augmentations are written against. It is a display spelling, so two columns can share it; never look anything up by it.
 */
export function columnTypeKey(column: ColumnRef): string {
  return `${column.schema}.${column.relation}.${column.column}`
}
