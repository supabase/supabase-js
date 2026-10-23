import type { PlanFilter, PlanForm, ResultShape, RpcInfo } from '@supabase/postgrest-planner'
import type { RpcMethod } from '../types'
import { quote, quoteDouble } from './literal'
import { tsTypeOf } from './pg-types'
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
  /** Normalised like a field's `pgType`: `int4`, `public.status`, `text[]` */
  type: string
}

/** The parts of a successful plan of an RPC call (or of an operand request) the printer reads. */
export interface CallPlan {
  form: PlanForm | null
  shape: ResultShape | null
  rpc: RpcInfo | null
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
  const qualified = schema === '' || schema === 'pg_catalog' ? name : `${schema}.${name}`
  return { kind, multiplicity, type: qualified + '[]'.repeat(dims) }
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
  if (returns.type === 'void') return 'null'
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
  const printed = printResultShape(context, plan.shape, plan.degraded)
  const members = [
    `form: ${plan.form === 'rowset' ? "'rows'" : "'single-row'"}`,
    `row: ${printed.row}`,
  ]
  // `source`: the unprojected row and the columns a filter fact on it reaches
  let starPrinted: ReturnType<typeof printResultShape> | undefined
  if (select === '*') starPrinted = printed
  else if (star && 'plan' in star && star.plan.shape) {
    starPrinted = printResultShape(context, star.plan.shape, star.plan.degraded)
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

/** An entry of `SupabaseOperands`: a relation's has one outcome, an RPC's one per call. */
export type OperandInput =
  | { key: string; operand: string; outcome: CallOutcome }
  | {
      key: string
      operand: string
      calls: readonly { keys: readonly string[]; method: RpcMethod; outcome: CallOutcome }[]
    }

type OperandType = { type: string; embed?: string[] } | { error: string }

/** The type a filter on `operand` compares against, from the planner's `filters` of the `is.null` request. */
function operandTypeOf(context: SelectsContext, plan: CallPlan, operand: string): OperandType {
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
    return { error: `unresolved filter \`${operand}\`: ${prov.reason}` }
  }
  if (filter.pgType && filter.baseType && filter.baseType !== filter.pgType) {
    context.domains.set(filter.pgType, filter.baseType)
  }
  if (prov.kind === 'plain') {
    const k = columnKeyOf(context, prov.source)
    const own = derivedType(
      context,
      k.key,
      filter.pgType ?? 'jsonb',
      filter.reason === 'function-rows'
    )
    const column = `SupabaseColumnType<${quote(k.key)}, ${own}>`
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
  outcome: CallOutcome
): OperandType {
  return 'error' in outcome
    ? { error: outcome.error }
    : operandTypeOf(context, outcome.plan, operand)
}

const operandMembers = (t: OperandType): string[] =>
  'error' in t
    ? [`error: ${quoteDouble(t.error)}`]
    : [`type: ${t.type}`, ...(t.embed ? [`embed: ${tuple(t.embed)}`] : [])]

/**
 * `interface SupabaseOperands { ... }`, indented for `declare global { ... }`, entries sorted by key (the first of a
 * key repeated wins). A relation's entry is `{ type, embed? }` or `{ error }`; an RPC's is `{ calls }` matched by the
 * same dispatch as the call. Empty without entries.
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
          ...operandMembers(operandOutcome(context, entry.operand, call.outcome)),
        ]
        return `        { ${members.join('; ')} },`
      })
      blocks.push(`    ${quote(entry.key)}: {\n      calls: [\n${lines.join('\n')}\n      ]\n    }`)
    } else {
      const members = operandMembers(operandOutcome(context, entry.operand, entry.outcome))
      blocks.push(`    ${quote(entry.key)}: { ${members.join('; ')} }`)
    }
  }
  if (blocks.length === 0) return ''
  return `  interface SupabaseOperands {\n${blocks.join('\n')}\n  }`
}
