import type { PlanRequest } from '@supabase/postgrest-planner'
import { selectKey } from '../keys'
import type { ScanResult, SourceLocation } from '../types'

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
 * Every key the scan asks for, sorted and deduplicated. A bare `*` select has no entry (the consumer derives it
 * from `SupabaseDatabase`). RPC chains and operands are not planned yet: their keys are left out and the consumer
 * falls back to its `unplanned` behaviour.
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
