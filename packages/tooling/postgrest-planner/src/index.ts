import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { WASI } from 'node:wasi'

export interface PlannerInfo {
  ok: true
  abi: number
  ghc: string
  postgrest: { version: string; tag: string; commit: string }
}

/** Failure value produced by the reactor (upstream PostgREST error or ABI-level error). */
export interface PlannerError {
  ok: false
  status?: number
  error: {
    code?: string
    message?: string
    details?: unknown
    hint?: unknown
    [k: string]: unknown
  }
  [k: string]: unknown
}

export interface LoadSuccess {
  ok: true
  handle: number
  schemas: string[]
  summary: string
  ignoredConfigKeys: string[]
  /**
   * What plans of this handle will have to guess: `no-supplementary-catalog`, or one
   * `column-order:<schema>.<relation>` per relation whose `attnum` order the catalog lacks.
   */
  degraded: string[]
  /** `true` when `*` expands in `attnum` order for every relation of the schema cache. */
  columnOrderKnown: boolean
}

/**
 * Facts the `--dump-schema` document does not carry (`format: 1`). The planner reads the keys below and
 * ignores any other key, at any level, so producers may add their own (view definitions, function bodies,
 * CHECK constraints...) to the same document. A missing section is an empty one.
 *
 * Regenerate the test fixture with the command in the README.
 */
export interface Supplementary {
  format: 1
  /** Tables, views, materialized views, partitioned and foreign tables. */
  relations?: SupplementaryRelation[]
  /** Composite types, attributes in `attnum` order. */
  composites?: SupplementaryComposite[]
  foreignKeys?: SupplementaryForeignKey[]
  functions?: SupplementaryFunction[]
  [k: string]: unknown
}

export interface SupplementaryRelation {
  schema: string
  name: string
  columns: { name: string; attnum: number; [k: string]: unknown }[]
  [k: string]: unknown
}

export interface SupplementaryComposite {
  schema: string
  name: string
  attributes: { name: string; type: string; attnum: number; [k: string]: unknown }[]
  [k: string]: unknown
}

export interface SupplementaryForeignKey {
  /** Owning table. */
  schema: string
  table: string
  constraint: string
  /** `pg_constraint.convalidated`. */
  validated: boolean
  [k: string]: unknown
}

export interface SupplementaryFunction {
  schema: string
  name: string
  /** Input argument types as `format_type` spells them (schema-qualified outside `pg_catalog`). */
  argTypes?: string[]
  /** `pg_proc.provolatile`: `i`, `s` or `v`. */
  volatility?: string
  returns: { kind: 'scalar' | 'composite'; setof?: boolean; type: string }
  /** OUT / `RETURNS TABLE` columns. */
  outColumns?: { name: string; type: string }[]
  [k: string]: unknown
}

export interface LoadInput {
  /** PostgREST config as a JSON object of config keys (see `postgrest --dump-config`). */
  config: Record<string, unknown>
  /** Output of `postgrest --dump-schema`. */
  schema: string
  /**
   * Supplementary catalog, as a JSON document (a string) or an object. Optional: without it plans are
   * still produced but `degraded` says what they had to guess (column order of `*`, computed fields).
   * A document that is not valid JSON or has another `format` makes `load` fail with
   * `PLANNER_BAD_SUPPLEMENTARY`.
   */
  supplementary?: Supplementary | string
}

export interface PlanRequest {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
}

export interface QualifiedName {
  name: string
  schema: string
}

export interface SelectItem {
  aggregate: string | null
  aggregateCast: string | null
  alias: string | null
  cast: string | null
  jsonPath: unknown
  name: string
  outputName: string
  type: string
}

export interface EmbedPlan {
  alias: string | null
  embeds: EmbedPlan[]
  hint: string | null
  joinType: string | null
  jsonMode: 'array' | 'object' | string
  name: string
  outputName: string
  relationship: unknown
  select: SelectItem[]
  spread: boolean
  target: QualifiedName
  toOne: boolean
}

/**
 * What the response body of a plan looks like. `rowset` is a list of rows (or one object under
 * `Accept: application/vnd.pgrst.object+json`); the RPC forms are produced for `/rpc/*` plans, whose
 * `shape` is not resolved yet (`degraded` carries `rpc-shape`). `none` is a mutation without
 * `Prefer: return=representation`. `null` is any plan that returns no rows of a relation (OpenAPI,
 * relation/routine info).
 */
export type PlanForm = 'rowset' | 'single-composite' | 'single-scalar' | 'setof-scalar' | 'none'

export type JsonPathStep = { op: '->' | '->>'; key: string } | { op: '->' | '->>'; index: number }

/** Where the value of an output column comes from. Nested kinds carry the provenance they wrap in `of`. */
export type FieldProvenance =
  | { kind: 'plain'; source: { schema: string; relation: string; column: string } }
  | { kind: 'computed'; function: { schema: string; name: string }; relation: QualifiedName }
  | { kind: 'jsonPath'; of: FieldProvenance; path: JsonPathStep[] }
  | { kind: 'representation'; of: FieldProvenance; function: string }
  | { kind: 'cast'; of: FieldProvenance; to: string }
  | { kind: 'aggregate'; function: string; of: FieldProvenance }
  | { kind: 'unresolved'; reason: string }

export interface ShapeField {
  /** Output name: alias, else the aggregate's name, else the last JSON key, else the column name. */
  name: string
  /**
   * Normalised type: internal names (`int4`, `timestamptz`), no type modifiers, `schema.name` outside
   * `pg_catalog`, `[]` suffix for arrays. `null` when `provenance.kind` is `unresolved`.
   */
  pgType: string | null
  nullable: boolean
  /** The base type of a domain, only when it differs from `pgType`. */
  baseType?: string
  provenance: FieldProvenance
}

/** The relation a node of the result reads and its output: columns first, then embeds. */
export interface ResultShape {
  relation: QualifiedName
  /** Output columns in the order PostgREST emits them (`*` expanded in `attnum` order). */
  fields: ShapeField[]
  /** The embeds of this relation, in the order PostgREST emits them (after `fields`). */
  embeds: ShapeEmbed[]
}

/** The relationship an embed follows, as the schema cache has it. */
export interface ShapeEmbedRelationship {
  /** `m2o`: the origin holds the key; `o2o`: one to one; `o2m`: the target holds the key; `m2m`: through a junction. */
  kind: 'm2o' | 'o2o' | 'o2m' | 'm2m' | 'computed'
  /** Which side holds the foreign key (`o2o`: `target` is the inverse side). `null` for `m2m` and `computed`. */
  fkSide: 'origin' | 'target' | null
  /** The foreign key constraint. `null` for `m2m` and `computed`. */
  constraint: string | null
  /** Key columns, `from` on the origin (parent) relation and `to` on the target. Empty for `m2m` and `computed`. */
  columns: { from: string; to: string }[]
  junction: { schema: string; name: string; constraints: string[] } | null
  /** The computed relationship's function. */
  function: QualifiedName | null
}

/**
 * Why an embed's `nullable` is what it is. `nullable: false`: `array` (to-many), `inner-join` (`!inner`),
 * `fk-proven`. `nullable: true`: `write` (a to-one of a mutation plan), `filtered` (a filter, an offset or a
 * limit of 0 can drop its row), `nested-inner` (a `!inner` child drops it), `spread-parent` (it is merged
 * by a nullable to-one spread) and what `fkProven: false` stands for: `computed`, `inverse-o2o`,
 * `view-origin`, `view-target`, `nullable-fk-column`, `fk-not-validated`, `fk-unknown` (the catalog does not
 * say whether the key is validated), `unknown-relationship`.
 */
export type ShapeEmbedReason =
  | 'array'
  | 'inner-join'
  | 'fk-proven'
  | 'write'
  | 'filtered'
  | 'nested-inner'
  | 'spread-parent'
  | 'computed'
  | 'inverse-o2o'
  | 'view-origin'
  | 'view-target'
  | 'nullable-fk-column'
  | 'fk-not-validated'
  | 'fk-unknown'
  | 'unknown-relationship'

/** One embedded relation (`name(...)`, `alias:name(...)`, `...name(...)`) of a {@link ResultShape}. */
export interface ShapeEmbed {
  /** The embedded relation as written. */
  name: string
  alias: string | null
  /**
   * The JSON key of the embedded value in the parent row: the alias, else `name`. `null` for a spread (its
   * fields are merged into the parent) and for an empty embed (`rel()`), which has no key.
   */
  key: string | null
  spread: boolean
  /** `rel()`: used to filter or order, absent from the output. Its `shape` is still given. */
  empty: boolean
  /** Identity of the embed: the keys of the embeds from the root down to it (spreads included). */
  path: string[]
  /**
   * The JSON keys this embed adds to the result, each a path from the root row: `[key]` for a plain embed,
   * the merged field keys (and those of what the spread embeds) for a spread, none for an empty embed.
   */
  outputs: string[][]
  /** `inner`: `!inner`, the parent row goes away without a match. */
  join: 'inner' | 'left'
  /**
   * `one`: an object (a to-one spread merges its fields into the parent); `many`: an array, never null (a
   * to-many spread gives each of its `fields` as an array).
   */
  cardinality: 'one' | 'many'
  /** `null` when upstream gave none. */
  relationship: ShapeEmbedRelationship | null
  /**
   * The relation the embed reads. `kind` is `function` when it is reached through a computed relationship
   * (`relationship.function` is the function; `name` is still the table or view it returns).
   */
  target: QualifiedName & { kind: 'table' | 'view' | 'function' }
  /**
   * Whether the value can be null. For a to-many it is the array, which is never null; for a spread, the
   * merged fields are nullable when this is.
   */
  nullable: boolean
  reason: ShapeEmbedReason
  /**
   * The foreign key proves a to-one row exists: a many-to-one (or the owning side of a one-to-one) between two
   * tables, with NOT NULL key columns and a validated constraint. Independent of `join`, filters and the
   * plan being a mutation.
   */
  fkProven: boolean
  /** The embed's own columns (`*` expanded in `attnum` order) and nested embeds. */
  shape: ResultShape
}

export interface PlanSuccess {
  ok: true
  action: 'read' | 'insert' | 'update' | 'delete' | 'upsert' | 'rpc' | string
  media: string
  txMode: string
  explain: boolean
  target: QualifiedName
  select: SelectItem[]
  embeds: EmbedPlan[]
  warnings: unknown[]
  /** `null` for plans that return no rows of a relation. */
  form: PlanForm | null
  /** `null` when `form` is `null`, `none` or an RPC form. */
  shape: ResultShape | null
  /**
   * What this plan had to guess: `column-order:<schema>.<relation>`, `computed-field:<relation>.<name>`
   * (no catalog to resolve it), `fk-validation:<schema>.<table>.<constraint>` (the catalog does not say whether the
   * key is validated), `rpc-shape`.
   */
  degraded: string[]
  mutation?: unknown
  call?: unknown
  routine?: unknown
  payloadKeys?: string[]
  debug?: string
  [k: string]: unknown
}

export type LoadResult = LoadSuccess | PlannerError
export type PlanResult = PlanSuccess | PlannerError

export interface Planner {
  info(): PlannerInfo
  load(input: LoadInput): LoadResult
  plan(handle: number, request: PlanRequest): PlanResult
  freeCache(handle: number): void
}

export interface LoadPlannerOptions {
  /** Path to postgrest-planner.wasm. Defaults to the package's `dist/postgrest-planner.wasm`. */
  wasmPath?: string
}

export function defaultWasmPath(): string {
  // src/ (ts-jest) and dist/main/ (built) sit at different depths: walk up to the package root.
  let dir = __dirname
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return join(dir, 'dist', 'postgrest-planner.wasm')
}

interface Exports {
  memory: WebAssembly.Memory
  hs_init(argc: number, argv: number): void
  planner_alloc(n: number): number
  planner_free(ptr: number): void
  planner_info(): number
  planner_load(
    cfgP: number,
    cfgN: number,
    schP: number,
    schN: number,
    suppP: number,
    suppN: number
  ): number
  planner_plan(handle: number, reqP: number, reqN: number): number
  planner_free_cache(handle: number): void
}

export async function loadPlanner(options: LoadPlannerOptions = {}): Promise<Planner> {
  const wasmPath = options.wasmPath ?? defaultWasmPath()
  if (!existsSync(wasmPath)) {
    throw new Error(
      `postgrest-planner wasm not found at ${wasmPath} (run: nx build:wasm postgrest-planner)`
    )
  }
  const wasi = new WASI({ version: 'preview1', args: ['postgrest-planner'], env: {} })
  const { instance } = await WebAssembly.instantiate(readFileSync(wasmPath), {
    wasi_snapshot_preview1: wasi.wasiImport,
  })
  wasi.initialize(instance) // reactor: runs _initialize
  const x = instance.exports as unknown as Exports
  x.hs_init(0, 0)

  const enc = new TextEncoder()
  const dec = new TextDecoder()
  const mem = () => new Uint8Array(x.memory.buffer) // re-view after every call: memory may grow

  const put = (str: string): [number, number] => {
    const bytes = enc.encode(str)
    const ptr = x.planner_alloc(bytes.length)
    mem().set(bytes, ptr)
    return [ptr, bytes.length]
  }
  // Results are [u32 LE length][bytes]
  const take = (ptr: number): unknown => {
    const len = new DataView(x.memory.buffer).getUint32(ptr, true)
    const text = dec.decode(mem().subarray(ptr + 4, ptr + 4 + len))
    x.planner_free(ptr)
    return JSON.parse(text)
  }

  return {
    info: () => take(x.planner_info()) as PlannerInfo,
    load({ config, schema, supplementary }) {
      const [cp, cn] = put(JSON.stringify(config))
      const [sp, sn] = put(schema)
      // No supplementary catalog is an empty buffer pair.
      const [xp, xn] =
        supplementary === undefined
          ? [0, 0]
          : put(typeof supplementary === 'string' ? supplementary : JSON.stringify(supplementary))
      const res = take(x.planner_load(cp, cn, sp, sn, xp, xn)) as LoadResult
      x.planner_free(cp)
      x.planner_free(sp)
      if (xp !== 0) x.planner_free(xp)
      return res
    },
    freeCache: (handle) => x.planner_free_cache(handle),
    plan(handle, request) {
      const [p, n] = put(JSON.stringify(request))
      const res = take(x.planner_plan(handle, p, n)) as PlanResult
      x.planner_free(p)
      return res
    },
  }
}

/** Parses `postgrest --dump-config` output (`key = <JSON value>` lines) into a config object. */
export function parseConfigDump(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const line of text.split('\n')) {
    const m = /^([a-z0-9.-]+)\s*=\s*(.*)$/.exec(line.trim())
    if (m) out[m[1]] = JSON.parse(m[2])
  }
  return out
}
