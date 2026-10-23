import type { PlanRequest } from '@supabase/postgrest-planner'
import { operandKey, selectKey } from '../keys'
import type { RoutineSignature } from '../printer'
import type { RpcMethod, ScanResult, SourceLocation } from '../types'

/**
 * The `select` query parameter postgrest-js sends for a select string: whitespace is removed except inside double
 * quotes. A copy of postgrest-js `src/normalizeSelect.ts` (the mapper does not depend on the client); the drift
 * test in `test/generate-requests.test.ts` runs both over the same inputs.
 */
export function normalizeSelect(select: string): string {
  let quoted = false
  let out = ''
  for (const c of select) {
    if (/\s/.test(c) && !quoted) continue
    if (c === '"') quoted = !quoted
    out += c
  }
  return out
}

/** One entry of `SupabaseSelects` to plan: the key the consumer looks up and the request that produces it. */
export interface PlanKey {
  /** `${kind}|${schema}|${relation}|${select}`, the select as written (not normalised) */
  key: string
  kind: 'r' | 'w'
  schema: string
  relation: string
  /** The raw cooked select string */
  select: string
  /** How many schemas the chain could be in: a relation missing from one of several is not an error */
  schemaCount: number
  /**
   * The scanner could not connect the select to this relation: it was paired with a relation the file names. A
   * failed plan of such a pair is dropped, not reported.
   */
  speculative: boolean
  locations: SourceLocation[]
}

/**
 * Every select key of a relation the scan asks for, sorted and deduplicated. A bare `*` select has no entry (the
 * consumer derives it from `SupabaseDatabase`). RPC chains and operands have their own keys (`planRpcOf`,
 * `planOperandsOf`).
 */
export function planKeysOf(scan: ScanResult): PlanKey[] {
  const keys = new Map<string, PlanKey>()
  const add = (entry: PlanKey): void => {
    const known = keys.get(entry.key)
    if (!known) {
      keys.set(entry.key, entry)
      return
    }
    known.locations.push(...entry.locations)
    known.schemaCount = Math.max(known.schemaCount, entry.schemaCount)
    known.speculative = known.speculative && entry.speculative
  }
  for (const request of scan.selects) {
    const { target, select } = request
    if (target.kind === 'f' || target.schemas === 'exposed' || select === '*') continue
    for (const schema of target.schemas) {
      add({
        key: selectKey(target, schema, select),
        kind: target.kind,
        schema,
        relation: target.relation,
        select,
        schemaCount: target.schemas.length,
        speculative: false,
        locations: [...request.locations],
      })
    }
  }
  for (const pair of scan.fallbacks) {
    if (pair.target.kind !== 'relation' || pair.schemas === 'exposed' || pair.select === '*')
      continue
    for (const kind of pair.target.kinds) {
      for (const schema of pair.schemas) {
        const target = { kind, schemas: pair.schemas, relation: pair.target.name }
        add({
          key: selectKey(target, schema, pair.select),
          kind,
          schema,
          relation: pair.target.name,
          select: pair.select,
          schemaCount: pair.schemas.length,
          speculative: true,
          locations: [...pair.locations],
        })
      }
    }
  }
  return [...keys.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

/**
 * The request the runtime would send for the key, as the planner takes it: `GET` for a read, a `POST` asking for the
 * representation for a mutation (the body is not part of the shape; the planner needs one to see an insert).
 */
export function planRequestOf(
  key: Pick<PlanKey, 'kind' | 'schema' | 'relation' | 'select'>
): PlanRequest {
  const url = `/${encodeURIComponent(key.relation)}?select=${encodeURIComponent(normalizeSelect(key.select))}`
  if (key.kind === 'r') return { method: 'GET', url, headers: { 'Accept-Profile': key.schema } }
  return {
    method: 'POST',
    url,
    headers: {
      'Content-Profile': key.schema,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: '{}',
  }
}

const byId = (a: { id: string }, b: { id: string }): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0

// ---------------------------------------------------------------------------------------------------------------
// RPC calls
// ---------------------------------------------------------------------------------------------------------------

/** The overloads of every function, by `schema.function` (`routineSignatures`). */
export type Signatures = ReadonlyMap<string, readonly RoutineSignature[]>

/** At most this many optional keys are enumerated: the consumer treats more as dynamic (`KeyMethods`). */
const MAX_MAYBE_KEYS = 6

/** The sorted key sets of every subset of `optional` added to `required`. */
function subsetsOf(required: readonly string[], optional: readonly string[]): string[][] {
  const out: string[][] = []
  for (let mask = 0; mask < 1 << optional.length; mask++) {
    const keys = [...required, ...optional.filter((_, i) => mask & (1 << i))]
    out.push(keys.sort())
  }
  return out
}

/** One key set a call is planned with. A non-exact one is a guess: failing to plan it is not reported. */
export interface CallVariant {
  keys: string[]
  exact: boolean
}

/**
 * The key sets to plan for an rpc target. A literal key set is planned as written, and, because the consumer also
 * looks up the key sets of its optional (or `undefined`-able) keys left out, with every strict subset that drops only
 * keys some overload takes as optional. An unknown key set is planned per overload: its required keys plus every
 * subset of its optional ones.
 */
export function variantsOf(
  keys: readonly string[] | null,
  signatures: readonly RoutineSignature[]
): CallVariant[] {
  const seen = new Map<string, CallVariant>()
  const add = (variant: CallVariant): void => {
    const id = JSON.stringify(variant.keys)
    const known = seen.get(id)
    if (!known) seen.set(id, variant)
    else known.exact ||= variant.exact
  }
  if (keys === null) {
    for (const signature of signatures) {
      if (signature.optional.length > MAX_MAYBE_KEYS) continue
      for (const set of subsetsOf(signature.required, signature.optional)) {
        add({ keys: set, exact: true })
      }
    }
  } else {
    const literal = [...keys].sort()
    add({ keys: literal, exact: true })
    const optional = [...new Set(signatures.flatMap((s) => s.optional))]
      .filter((k) => literal.includes(k))
      .slice(0, MAX_MAYBE_KEYS)
    const rest = literal.filter((k) => !optional.includes(k))
    for (const set of subsetsOf(rest, optional)) add({ keys: set, exact: false })
  }
  return [...seen.values()].sort((a, b) => {
    const x = JSON.stringify(a.keys)
    const y = JSON.stringify(b.keys)
    return x < y ? -1 : x > y ? 1 : 0
  })
}

/** One (key set, method) of an rpc `SupabaseSelects` entry to plan. */
export interface RpcPlanKey {
  /** Unique among every planned item; the cache key */
  id: string
  /** The `SupabaseSelects` key: `f|${schema}|${function}|${select}` */
  entry: string
  schema: string
  function: string
  select: string
  keys: string[]
  method: RpcMethod
  exact: boolean
  /** How many schemas the chain could be in */
  schemaCount: number
  locations: SourceLocation[]
}

/** The id of an rpc call (`RpcPlanKey.id`); with select `*` it is the call whose `source` a projected call takes. */
export const callIdOf = (
  key: Pick<RpcPlanKey, 'schema' | 'function' | 'keys' | 'method'>,
  select: string
): string =>
  `call|${key.schema}|${key.function}|${select}|${JSON.stringify(key.keys)}|${key.method}`

/**
 * Every rpc call the scan asks for: the function's schema (a function no schema of the chain defines gets no entry, the
 * consumer reports it itself), the select, the key set and the method. Sorted by id.
 */
export function planRpcOf(scan: ScanResult, signatures: Signatures): RpcPlanKey[] {
  const out = new Map<string, RpcPlanKey>()
  for (const request of scan.selects) {
    const { target, select } = request
    if (target.kind !== 'f' || target.schemas === 'exposed') continue
    for (const schema of target.schemas) {
      const overloads = signatures.get(`${schema}.${target.function}`)
      if (!overloads) continue
      for (const variant of variantsOf(target.keys, overloads)) {
        const id = callIdOf(
          { schema, function: target.function, keys: variant.keys, method: target.method },
          select
        )
        const known = out.get(id)
        if (known) {
          known.locations.push(...request.locations)
          known.exact ||= variant.exact
          continue
        }
        out.set(id, {
          id,
          entry: selectKey(target, schema, select),
          schema,
          function: target.function,
          select,
          keys: variant.keys,
          method: target.method,
          exact: variant.exact,
          schemaCount: target.schemas.length,
          locations: [...request.locations],
        })
      }
    }
  }
  return [...out.values()].sort(byId)
}

// ---------------------------------------------------------------------------------------------------------------
// Operands
// ---------------------------------------------------------------------------------------------------------------

/** One `SupabaseOperands` entry (relation) or one call of one (rpc) to plan. */
export type OperandPlanKey = {
  /** Unique among every planned item; the cache key */
  id: string
  /** The `SupabaseOperands` key (`OKey`) */
  entry: string
  /** The `SupabaseSelects` key of the chain's select */
  selectEntry: string
  schema: string
  select: string
  operand: string
  schemaCount: number
  locations: SourceLocation[]
} & (
  | { kind: 'r' | 'w'; relation: string }
  | { kind: 'f'; function: string; keys: string[]; method: RpcMethod; exact: boolean }
)

/**
 * The operands the scan reports, expanded per schema (and per call for an rpc). An operand through
 * `referencedTable` is not planned: its key (`@table`) is never looked up, the consumer reads the options.
 */
export function planOperandsOf(scan: ScanResult, signatures: Signatures): OperandPlanKey[] {
  const out = new Map<string, OperandPlanKey>()
  for (const request of scan.operands) {
    const { target, select, operand } = request
    if (request.via !== 'column' || target.schemas === 'exposed') continue
    for (const schema of target.schemas) {
      const entry = operandKey(target, schema, select, operand)
      const base = {
        entry,
        selectEntry: selectKey(target, schema, select),
        schema,
        select,
        operand,
        schemaCount: target.schemas.length,
      }
      if (target.kind !== 'f') {
        const id = `op|${entry}`
        const known = out.get(id)
        if (known) known.locations.push(...request.locations)
        else {
          out.set(id, {
            ...base,
            id,
            kind: target.kind,
            relation: target.relation,
            locations: [...request.locations],
          })
        }
        continue
      }
      const overloads = signatures.get(`${schema}.${target.function}`)
      if (!overloads) continue
      for (const variant of variantsOf(target.keys, overloads)) {
        const id = `rpcop|${entry}|${JSON.stringify(variant.keys)}|${target.method}`
        const known = out.get(id)
        if (known) {
          known.locations.push(...request.locations)
          if (known.kind === 'f') known.exact ||= variant.exact
          continue
        }
        out.set(id, {
          ...base,
          id,
          kind: 'f',
          function: target.function,
          keys: variant.keys,
          method: target.method,
          exact: variant.exact,
          locations: [...request.locations],
        })
      }
    }
  }
  return [...out.values()].sort(byId)
}

// ---------------------------------------------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------------------------------------------

const q = encodeURIComponent

/**
 * The request the runtime sends for an rpc call: `POST` carries the arguments as a JSON body, `GET` and `HEAD` as query
 * parameters (the planner reads the names, never the values). `operand` adds the `is.null` filter an operand entry is
 * typed from.
 */
export function rpcRequestOf(
  call: Pick<RpcPlanKey, 'schema' | 'function' | 'select' | 'keys' | 'method'>,
  operand?: string
): PlanRequest {
  const params: string[] = []
  if (call.method !== 'POST') for (const k of call.keys) params.push(`${q(k)}=1`)
  if (call.select !== '*') params.push(`select=${q(normalizeSelect(call.select))}`)
  if (operand !== undefined) params.push(`${q(operand)}=is.null`)
  const url = `/rpc/${q(call.function)}${params.length > 0 ? `?${params.join('&')}` : ''}`
  if (call.method !== 'POST') {
    return { method: call.method, url, headers: { 'Accept-Profile': call.schema } }
  }
  return {
    method: 'POST',
    url,
    headers: { 'Content-Profile': call.schema, 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(call.keys.map((k) => [k, null]))),
  }
}

/** The request of an operand: the chain's select with `operand=is.null` (design v5 section 4.2). */
export function operandRequestOf(key: OperandPlanKey): PlanRequest {
  if (key.kind === 'f') return rpcRequestOf(key, key.operand)
  const url = `/${q(key.relation)}?select=${q(normalizeSelect(key.select))}&${q(key.operand)}=is.null`
  if (key.kind === 'r') return { method: 'GET', url, headers: { 'Accept-Profile': key.schema } }
  return {
    method: 'PATCH',
    url,
    headers: {
      'Content-Profile': key.schema,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: '{}',
  }
}
