import type { PlanFilter, PlanForm, ResultShape, RpcInfo } from '@supabase/postgrest-planner'
import type { RpcMethod } from '../types'
import { functionRowsOf } from './function-rows'
import { quote, quoteDouble } from './literal'
import { columnTypeKey } from '../keys'
import { rememberDomain, tsTypeOf } from './pg-types'
import type { NormalizedType } from './pg-types'
import type { SelectsContext } from './selects-context'
import {
  EntryError,
  columnKeyOf,
  derivedType,
  orNull,
  printEmbeds,
  printResultShape,
  printSources,
  tuple,
} from './selects'
import type { RawEntry } from './selects'

// ---------------------------------------------------------------------------------------------------------------
// What the planner said about one call, and how it is stored
// ---------------------------------------------------------------------------------------------------------------

/** What an RPC returns, from the planner's `routine.returnType`: the only place a scalar's type is reported. */
export interface CallReturns {
  kind: 'scalar' | 'composite'
  multiplicity: 'single' | 'setof'
  /** Structured, so a name with a dot or parenthesis in it is not mistaken for a qualified one: `int4`, `public.status`, `text[]` */
  type: NormalizedType
}

/** The overload the planner chose, from `routine.params`: what tells it apart from the others of its name. */
export interface CallRoutine {
  params: { name: string; type: string }[]
}

/** The parts of a successful plan of an RPC call (or of an operand request) the printer reads. */
export interface CallPlan {
  form: PlanForm | null
  shape: ResultShape | null
  rpc: RpcInfo | null
  /** `null` for an operand request, and when the planner did not say */
  routine: CallRoutine | null
  returns: CallReturns | null
  filters: PlanFilter[]
  degraded: string[]
}

/** A plan, or the planner's rejection of the request. */
export type CallOutcome = { plan: CallPlan } | { error: string }

/** One (key set, method) of an entry: what the consumer's dispatch picks by. */
export interface RpcCall {
  keys: readonly string[]
  method: RpcMethod
  outcome: CallOutcome
  /** The plan of the same call with select `*`, where `source` comes from. Not needed for a `*` entry */
  star?: CallOutcome | undefined
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * `PlanSuccess.routine` (untyped in the planner) as the return type of the function. `null` when the planner did
 * not say, which only matters for a scalar: the rows of a composite come from the plan's `shape`.
 */
export function callReturnsOf(routine: unknown): CallReturns | null {
  if (!isRecord(routine) || !isRecord(routine['returnType'])) return null
  const { kind, multiplicity, type } = routine['returnType']
  if (kind !== 'scalar' && kind !== 'composite') return null
  if (multiplicity !== 'single' && multiplicity !== 'setof') return null
  if (!isRecord(type) || typeof type['name'] !== 'string') return null
  const schema = typeof type['schema'] === 'string' ? type['schema'] : ''
  let name = type['name']
  let dims = 0
  if (schema === 'pg_catalog' && name.startsWith('_')) {
    name = name.slice(1) // an array type is `_int4`
    dims = 1
  }
  const builtin = schema === '' || schema === 'pg_catalog'
  return { kind, multiplicity, type: builtin ? { name, dims } : { schema, name, dims } }
}

/** `PlanSuccess.routine` (untyped in the planner) as the parameters of the overload. `null` when it does not say. */
export function callRoutineOf(routine: unknown): CallRoutine | null {
  if (!isRecord(routine) || !Array.isArray(routine['params'])) return null
  const params: CallRoutine['params'] = []
  for (const p of routine['params']) {
    if (!isRecord(p) || typeof p['name'] !== 'string' || typeof p['type'] !== 'string') return null
    params.push({ name: p['name'], type: p['type'] })
  }
  return { params }
}

// ---------------------------------------------------------------------------------------------------------------
// `calls`
// ---------------------------------------------------------------------------------------------------------------

/** A call the printer cannot type; the message is the call's `error`. */
class CallError extends Error {}

const keysType = (keys: readonly string[]): string =>
  keys.length === 0 ? 'never' : keys.map(quote).join(' | ')

const byCall = (a: { keys: readonly string[]; method: string }, b: typeof a): number => {
  const x = a.keys.join('\0')
  const y = b.keys.join('\0')
  return x < y ? -1 : x > y ? 1 : a.method < b.method ? -1 : a.method > b.method ? 1 : 0
}

/** The row of a scalar return: `T | null`, for one value and for each element of a set (nothing proves it is not null). */
function scalarRow(context: SelectsContext, returns: CallReturns): string {
  // `void` is sent as `null`
  if (
    returns.type.schema === undefined &&
    returns.type.name === 'void' &&
    returns.type.dims === 0
  ) {
    return 'null'
  }
  return orNull(tsTypeOf(returns.type, context.types))
}

const CALL_INDENT = '          '

/** The planner's own reasons for a degraded call (` (media-handler:public.f)`), to say why there is no result. */
const degradedNotes = (plan: CallPlan): string =>
  plan.degraded.length ? ` (${plan.degraded.join(', ')})` : ''

function callMembers(
  context: SelectsContext,
  select: string,
  plan: CallPlan,
  star: CallOutcome | undefined
): string[] {
  if (plan.form === 'single-scalar' || plan.form === 'setof-scalar') {
    if (!plan.returns) throw new CallError('the planner did not report what the function returns')
    return [
      `form: ${plan.form === 'single-scalar' ? "'single-scalar'" : "'rows'"}`,
      `row: ${scalarRow(context, plan.returns)}`,
      'source: never',
    ]
  }
  if (plan.form !== 'rowset' && plan.form !== 'single-composite') {
    throw new CallError(`the planner returned no result form for this call${degradedNotes(plan)}`)
  }
  if (!plan.shape)
    throw new CallError(`the planner returned no result shape for this call${degradedNotes(plan)}`)
  const rows = functionRowsOf(context, plan)
  const printed = printResultShape(context, plan.shape, plan.degraded, rows)
  const members = [
    `form: ${plan.form === 'rowset' ? "'rows'" : "'single-row'"}`,
    `row: ${printed.row}`,
  ]
  // `source`: the unprojected row and the columns a filter fact on it reaches
  let starPrinted: ReturnType<typeof printResultShape> | undefined
  if (select === '*') starPrinted = printed
  else if (star && 'plan' in star && star.plan.shape) {
    starPrinted = printResultShape(
      context,
      star.plan.shape,
      star.plan.degraded,
      functionRowsOf(context, star.plan)
    )
  }
  members.push(
    starPrinted
      ? `source: { row: ${starPrinted.row}; sources: ${printSources(starPrinted.sources)} }`
      : 'source: never'
  )
  if (select !== '*') {
    if (printed.sources.length > 0) members.push(`sources: ${printSources(printed.sources)}`)
    if (printed.embeds.length > 0) {
      members.push(`embeds: ${printEmbeds(printed.embeds, CALL_INDENT)}`)
    }
  }
  return members
}

function printBlock(call: { keys: readonly string[]; method: RpcMethod }, tail: string[]): string {
  const members = [`keys: ${keysType(call.keys)}`, `method: ${quote(call.method)}`, ...tail]
  return `        {\n${members.map((m) => `${CALL_INDENT}${m}`).join('\n')}\n        },`
}

function printCall(context: SelectsContext, select: string, call: RpcCall): string {
  if ('error' in call.outcome) {
    return printBlock(call, [`error: ${quoteDouble(call.outcome.error)}`])
  }
  try {
    return printBlock(call, callMembers(context, select, call.outcome.plan, call.star))
  } catch (error) {
    if (error instanceof EntryError) {
      return printBlock(call, [`error: ${quoteDouble(`unresolved select item ${error.message}`)}`])
    }
    if (error instanceof CallError) {
      return printBlock(call, [`error: ${quoteDouble(error.message)}`])
    }
    throw error
  }
}

/**
 * The `SupabaseSelects` entry of an RPC chain with select `select` (`{ calls }`, design v5 §5.2): one call per
 * (key set, method) the project sends, in a stable order. For a `*` select the call carries `source`; for a projected
 * one also its own `sources` and `embeds`. `undefined` without calls.
 */
export function printRpcEntry(
  context: SelectsContext,
  key: string,
  select: string,
  calls: readonly RpcCall[]
): RawEntry | undefined {
  if (calls.length === 0) return undefined
  const blocks = [...calls].sort(byCall).map((call) => printCall(context, select, call))
  return { key, body: `      calls: [\n${blocks.join('\n')}\n      ]` }
}

// ---------------------------------------------------------------------------------------------------------------
// `SupabaseOperands`
// ---------------------------------------------------------------------------------------------------------------

/**
 * An entry of `SupabaseOperands`: a relation's has one outcome, an RPC's one per call. `order` marks the entry of an
 * `.order()` column, which only says whether the column is accepted.
 */
export type OperandInput =
  | { key: string; operand: string; outcome: CallOutcome; order?: true }
  | {
      key: string
      operand: string
      calls: readonly { keys: readonly string[]; method: RpcMethod; outcome: CallOutcome }[]
      order?: true
    }

type OperandType = { type: string; embed?: string[] } | { ok: true } | { error: string }

/**
 * The type a filter on `operand` compares against, from the planner's `filters` of the `is.null` request. `what` names
 * the use of the column in a failure.
 */
function operandTypeOf(
  context: SelectsContext,
  plan: CallPlan,
  operand: string,
  what: 'filter' | 'order column' = 'filter'
): OperandType {
  const filter = plan.filters[0]
  if (!filter) return { type: 'unknown' }
  if (filter.kind === 'embed') return { type: 'unknown', embed: filter.tested }
  const embed = filter.embed.length > 0 ? { embed: filter.embed } : {}
  const prov = filter.provenance
  if (prov.kind === 'unresolved') {
    // without a catalog (or for a scalar function) the planner cannot tell a missing column from a computed one
    const unknowable =
      plan.degraded.some((d) => d.startsWith('computed-field:') || d.startsWith('rpc-columns:')) ||
      prov.reason === 'the function returns a scalar'
    if (unknowable) return { type: 'unknown', ...embed }
    return { error: `unresolved ${what} \`${operand}\`: ${prov.reason}` }
  }
  if (filter.pgType && filter.baseType && filter.baseType !== filter.pgType) {
    rememberDomain(context.domains, filter.pgType, filter.baseType)
  }
  if (prov.kind === 'plain') {
    const k = columnKeyOf(context, prov.source)
    const own = derivedType(
      context,
      k.column,
      filter.pgType ?? 'jsonb',
      filter.reason === 'function-rows'
    )
    const column = `SupabaseColumnType<${quote(columnTypeKey(k.column))}, ${own}>`
    if (filter.jsonPath.length === 0) return { type: column, ...embed }
    const steps = filter.jsonPath.map((s) => ('key' in s ? s.key : String(s.index)))
    const helper =
      filter.jsonPath[filter.jsonPath.length - 1]!.op === '->>' ? 'PgrstJsonText' : 'PgrstJson'
    return {
      type: `import(${quote(context.importFrom)}).${helper}<${column}, ${tuple(steps)}>`,
      ...embed,
    }
  }
  if (filter.jsonPath.length > 0 || filter.pgType === null) return { type: 'unknown', ...embed }
  return { type: tsTypeOf(filter.pgType, context.types), ...embed }
}

function operandOutcome(
  context: SelectsContext,
  operand: string,
  outcome: CallOutcome,
  order: boolean
): OperandType {
  if ('error' in outcome) return { error: outcome.error }
  const typed = operandTypeOf(context, outcome.plan, operand, order ? 'order column' : 'filter')
  // an order column is accepted or not: the planner validated it as an order, the filter on it resolved the column
  return order && !('error' in typed) ? { ok: true } : typed
}

const operandMembers = (t: OperandType): string[] =>
  'error' in t
    ? [`error: ${quoteDouble(t.error)}`]
    : 'ok' in t
      ? ['ok: true']
      : [`type: ${t.type}`, ...(t.embed ? [`embed: ${tuple(t.embed)}`] : [])]

/**
 * `interface SupabaseOperands { ... }`, indented for `declare global { ... }`, entries sorted by key (the first of a
 * key repeated wins). A relation's entry is `{ type, embed? }` or `{ error }`, `{ ok: true }` or `{ error }` for an
 * `.order()` column (the key starts with `order|`); an RPC's is `{ calls }` matched by the same dispatch as the call.
 * Empty without entries.
 */
export function printOperands(context: SelectsContext, entries: readonly OperandInput[]): string {
  const sorted = [...entries].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  const seen = new Set<string>()
  const blocks: string[] = []
  for (const entry of sorted) {
    if (seen.has(entry.key)) continue
    seen.add(entry.key)
    if ('calls' in entry) {
      if (entry.calls.length === 0) continue
      const lines = [...entry.calls].sort(byCall).map((call) => {
        const members = [
          `keys: ${keysType(call.keys)}`,
          `method: ${quote(call.method)}`,
          ...operandMembers(
            operandOutcome(context, entry.operand, call.outcome, entry.order === true)
          ),
        ]
        return `        { ${members.join('; ')} },`
      })
      blocks.push(`    ${quote(entry.key)}: {\n      calls: [\n${lines.join('\n')}\n      ]\n    }`)
    } else {
      const members = operandMembers(
        operandOutcome(context, entry.operand, entry.outcome, entry.order === true)
      )
      blocks.push(`    ${quote(entry.key)}: { ${members.join('; ')} }`)
    }
  }
  if (blocks.length === 0) return ''
  return `  interface SupabaseOperands {\n${blocks.join('\n')}\n  }`
}
