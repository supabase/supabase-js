import type { CallPlan } from './rpc'
import { relationKey } from '../keys'
import type { TracedColumn, TracedFunction } from '../tracer'
import { canonicalType } from './pg-types'
import type { SelectsContext } from './selects-context'

/** What the tracer proved about the rows of the function a call invokes (design v5 §4.3). */
export interface FunctionRows {
  /** `SETOF` / `RETURNS TABLE`: false for one row, which can be a null composite expanded to a row of nulls */
  setof: boolean
  /** `STABLE` or `IMMUTABLE`: the function runs on the snapshot of the calling statement */
  snapshot: boolean
  /** The verdict per output column name */
  columns: ReadonlyMap<string, TracedColumn>
  /** The table the rows are those of (`SETOF table`), where the planner hangs the embeds of the rows from */
  table: { schema: string; name: string } | null
}

/**
 * The traced function behind a call: the overload the planner chose (`routine.params`), found among the traced
 * functions of its name by argument names, then by types as `SupabaseDatabase` matches the dump's overloads. `undefined`
 * when the body was not traced or the overload cannot be told.
 */
export function functionRowsOf(
  context: SelectsContext,
  plan: Pick<CallPlan, 'rpc' | 'routine'>
): FunctionRows | undefined {
  const { rpc, routine } = plan
  if (!rpc || !routine) return undefined
  const overloads = context.functions.get(relationKey(rpc.function.schema, rpc.function.name)) ?? []
  const named = overloads.filter(
    (f) =>
      f.argNames.length === routine.params.length &&
      f.argNames.every((n, i) => n === routine.params[i]!.name)
  )
  const typed =
    named.length > 1
      ? named.filter((f) =>
          f.argTypes.every((t, i) => canonicalType(t) === canonicalType(routine.params[i]!.type))
        )
      : named
  const found: TracedFunction | undefined = typed.length === 1 ? typed[0] : undefined
  if (!found) return undefined
  const source = rpc.source
  return {
    setof: found.setof,
    snapshot: found.snapshot,
    columns: new Map(found.columns),
    table:
      source?.kind === 'relation' && !source.view
        ? { schema: source.schema, name: source.name }
        : null,
  }
}
