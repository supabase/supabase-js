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
  /** Functions of the exposed schemas (`db-schemas`). */
  functions?: SupplementaryFunction[]
  /**
   * Functions of the schemas of `db-extra-search-path` that are not exposed: a computed field is found
   * through the whole search path of the request, so they take part in resolving it. Members of an extension
   * (which `functions` leaves out) are listed here for every covered schema, exposed or not, when a lookup can
   * reach them: they take one row type as their only argument, or have OUT columns.
   */
  searchPathFunctions?: SupplementaryFunction[]
  /**
   * User-defined types (domains, enums, composites, ranges...) and array types of every covered schema,
   * whether or not anything else mentions them. A cast name resolves against this list.
   */
  types?: SupplementaryType[]
  /**
   * The schemas this catalog covers: it lists the functions and the types of each. A lookup that crosses
   * a schema off this list (a request path the catalog was not generated for) cannot prove a name absent
   * from it, so the field or cast is left unresolved with a degraded note.
   */
  schemas?: string[]
  /**
   * Every `pg_cast` row with a source or a target outside `pg_catalog`. A cast to `text`, `varchar` or `bpchar`
   * from such a type keeps a non-NULL value non-NULL only when none of them is a cast function for that pair
   * (PostgreSQL prefers it to the I/O conversion, and a user function may return NULL). Without this section
   * such a cast is nullable.
   */
  casts?: SupplementaryCast[]
  [k: string]: unknown
}

export interface SupplementaryCast {
  /** `format_type` of the source, under an empty `search_path` (schema-qualified outside `pg_catalog`). */
  source: string
  /** Same spelling, for the target. */
  target: string
  /** `pg_cast.castmethod`: `f` function, `i` I/O conversion, `b` binary coercible. */
  method: string
  [k: string]: unknown
}

export interface SupplementaryType {
  schema: string
  name: string
  /** `pg_type.typtype`: `b` base, `c` composite, `d` domain, `e` enum, `m` multirange, `r` range. */
  kind?: string
  /** Base type of a domain, spelled like `argTypes`; `null` otherwise. */
  base?: string | null
  /**
   * Element type of an array type, spelled like `argTypes`; `null` otherwise. An array type is listed under its own
   * `pg_type` name (`_name`, or what Postgres made of it when that name was taken), so a cast name resolves to
   * it at the schema that has it.
   */
  element?: string | null
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
  /** `pg_proc.pronargdefaults`: how many of the trailing input arguments have a default (a call may leave them out). */
  defaults?: number
  returns: { kind: 'scalar' | 'composite'; setof?: boolean; type: string }
  /** OUT / `RETURNS TABLE` columns (`null` when the function has none). */
  outColumns?: { name: string; type: string }[] | null
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
 * `Accept: application/vnd.pgrst.object+json`). The other forms belong to `/rpc/*` plans: `single-scalar` and
 * `setof-scalar` (a scalar or a list of scalars: no `shape`), `single-composite` (one object, `shape` is its
 * row) and `rowset` (a set of composite rows, `shape` is a row). `none` is a mutation without
 * `Prefer: return=representation`. `null` is any plan that returns no rows of a relation (OpenAPI,
 * relation/routine info).
 */
export type PlanForm = 'rowset' | 'single-composite' | 'single-scalar' | 'setof-scalar' | 'none'

export type JsonPathStep = { op: '->' | '->>'; key: string } | { op: '->' | '->>'; index: number }

/** Where the value of an output column comes from. Nested kinds carry the provenance they wrap in `of`. */
export type FieldProvenance =
  /**
   * `functionRows: true` when the column is read from the rows of a function (the root of an RPC plan, a computed
   * relationship): the function may return rows the table's constraints refuse, and the flag stays on the provenance
   * under a JSON path, a cast or an aggregate, which wrap it in `of`.
   */
  | {
      kind: 'plain'
      source: { schema: string; relation: string; column: string }
      functionRows?: true
    }
  | { kind: 'computed'; function: { schema: string; name: string }; relation: QualifiedName }
  | { kind: 'jsonPath'; of: FieldProvenance; path: JsonPathStep[] }
  | { kind: 'representation'; of: FieldProvenance; function: string }
  | { kind: 'cast'; of: FieldProvenance; to: string }
  /** `of` is `null` for `count()` (and `count(*)`), which reads no value. */
  | { kind: 'aggregate'; function: string; of: FieldProvenance | null }
  /** An `OUT` or `RETURNS TABLE` column of the RPC the rows come from. */
  | { kind: 'outColumn'; function: QualifiedName; column: string }
  /** An attribute of the named composite type an RPC returns. */
  | { kind: 'compositeAttribute'; type: QualifiedName; attribute: string }
  /** A literal the statement itself produces: the `1` of the `RETURNING 1` of an empty select on a table without a primary key. */
  | { kind: 'constant'; value: string }
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
  /**
   * `function-rows`: the value is read straight from a row a function returns (the root of an RPC plan, possibly
   * through a cast), so `nullable` is `true` whatever the table or type says: a function can return rows its
   * relation's constraints would refuse. `provenance` says which column or attribute it is, for a printer
   * that can trace the function and knows it cannot.
   */
  reason?: 'function-rows'
}

/** The relation a node of the result reads and its output: columns first, then embeds. */
export interface ResultShape {
  /**
   * The relation. For the root of an RPC plan, what the rows come from: the table or view, the composite type
   * or, for `RETURNS TABLE` / `OUT` columns, `pg_catalog.record`.
   */
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
 * `fk-proven`, `single-composite` (a computed relationship to a function returning one composite, not `setof`:
 * Postgres always yields a row, a composite of NULLs when nothing matches, so the embed is an object whose
 * fields are all `nullable` with reason `function-rows`). `nullable: true`: `write` (a to-one of a mutation plan), `filtered` (a filter, an offset or a
 * limit of 0 can drop its row), `nested-inner` (a `!inner` child drops it), `spread-parent` (it is merged
 * by a nullable to-one spread) and what `fkProven: false` stands for: `computed`, `inverse-o2o`,
 * `view-origin`, `view-target`, `nullable-fk-column`, `fk-not-validated`, `fk-unknown` (the catalog does not
 * say whether the key is validated), `unknown-relationship`. `function-rows`: a to-one embed of the rows of an
 * RPC (first level only, not `!inner`): the row it hangs from may not satisfy the key, whatever `fkProven` says.
 * A printer that traces a `STABLE` or `IMMUTABLE` function down to the table can restore the embed when
 * `fkProven`.
 */
export type ShapeEmbedReason =
  | 'array'
  | 'inner-join'
  | 'fk-proven'
  | 'single-composite'
  | 'write'
  | 'function-rows'
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

export type RpcVolatility = 'immutable' | 'stable' | 'volatile'

/** Where the rows of an RPC come from. */
export type RpcSource =
  /** `setof table` or `setof view` (also a single row of one). The `shape` columns are the relation's. */
  | { kind: 'relation'; schema: string; name: string; view: boolean }
  /** A named composite type that is not a table row. The `shape` fields are its attributes. */
  | { kind: 'composite'; schema: string; name: string }
  /** `RETURNS TABLE (...)` or `OUT` parameters, in order, typed as the supplementary catalog says. */
  | { kind: 'returnsTable'; columns: { name: string; pgType: string }[] }

/** What a `/rpc/*` plan calls. */
export interface RpcInfo {
  function: QualifiedName
  /**
   * `provolatile`, from the dump (upstream reads it from the same place to choose the transaction mode). A
   * function that is not `volatile` runs in a read-only transaction under `GET`; upstream does not refuse a
   * `GET` of a volatile function, Postgres does when it runs.
   */
  volatility: RpcVolatility
  /**
   * `null` for a scalar return (`form` is `single-scalar` or `setof-scalar`, `shape` is `null`) and when the
   * columns are not known (`degraded` carries `rpc-columns:<function or type>`: no catalog, or it does not list
   * them; `shape` then has the selected names with an `unresolved` provenance).
   */
  source: RpcSource | null
}

/** An enclosing `and(...)` / `or(...)` group of a filter, outermost first. `not.` is `negated`. */
export interface FilterLogic {
  operator: 'and' | 'or'
  negated: boolean
}

/** A filter on a column, `col=op.value`, `embed.col=op.value` or a leaf of an `or=(...)` / `and=(...)` tree. */
export interface ColumnFilter {
  kind: 'column'
  /** The embed the filter applies to: its keys (alias, else name) from the root. Empty for the root relation. */
  embed: string[]
  /** The column as written, without its JSON path. */
  column: string
  /** The JSON path of `col->a->>b`, empty for none. */
  jsonPath: JsonPathStep[]
  /** The column's type: `null` when `provenance.kind` is `unresolved` (no such column or computed field). */
  pgType: string | null
  /** The base type of a domain, only when it differs from `pgType`. */
  baseType?: string
  /** Whether the column (before the JSON path) can be null, as for a select item. */
  nullable: boolean
  /** `function-rows` for a column of the rows of an RPC: see {@link ShapeField.reason}. */
  reason?: 'function-rows'
  provenance: FieldProvenance
  /** Empty for a plain `column=op.value` parameter. */
  logic: FilterLogic[]
}

/**
 * `embed=is.null` and `embed=not.is.null`, where the name is an embed of the select: tests whether the embedded
 * row exists. (`is.not_null` and every other operator stay a {@link ColumnFilter} on the name.)
 */
export interface EmbedFilter {
  kind: 'embed'
  /** The embed the filter is written under (the parameter `a.b=is.null` has `embed: ['a']`). */
  embed: string[]
  /** The embed's key, as written. */
  column: string
  /** The embed the filter tests: `embed` plus `column`. */
  tested: string[]
  /** `not.is.null`: the row must exist. */
  negated: boolean
  logic: FilterLogic[]
}

export type PlanFilter = ColumnFilter | EmbedFilter

/** What every successful plan carries. */
interface PlanBase {
  ok: true
  warnings: unknown[]
  /** `null` for plans that return no rows of a relation, and when a custom media handler writes the body. */
  form: PlanForm | null
  /** `null` when `form` is `null`, `none`, `single-scalar` or `setof-scalar`. */
  shape: ResultShape | null
  /** `null` for plans that are not `/rpc/*` calls. */
  rpc: RpcInfo | null
  /**
   * The target of every filter of the request, in the order upstream applies them (per node, root first:
   * `or=` / `and=` trees, then the other parameters). A mutation's filters come first. A filter under an
   * embed the select does not name fails the whole plan (`PGRST108`), so there is no per-filter error: the
   * plan is `ok: false`.
   */
  filters: PlanFilter[]
  /**
   * What this plan had to guess: `column-order:<schema>.<relation>`, `computed-field:<relation>.<name>`
   * (no catalog to resolve it, or a schema of the request's search path that the catalog does not cover), `cast-type:<name>` (a cast names a type that is neither builtin nor in a schema the catalog covers, or a covered path schema comes after an uncovered one), `fk-validation:<schema>.<table>.<constraint>` (the catalog does not say whether the
   * key is validated), `rpc-columns:<function>` (an RPC returns a composite type or `RETURNS TABLE` the
   * catalog does not describe), `rpc-embed-relation:<schema>.<relation>` (upstream resolves the embeds of an
   * RPC against another table than the one the function returns: see the README), `media-handler:<function>`
   * (the negotiated media handler is a custom function: `form` and `shape` are `null`).
   */
  degraded: string[]
}

/** A plan that reads, writes or calls through the database: `select` and `embeds` describe the read part. */
interface PlanDb extends PlanBase {
  media: string
  txMode: 'read' | 'write'
  explain: boolean
  target: QualifiedName
  select: SelectItem[]
  embeds: EmbedPlan[]
  debug: string
}

/** `GET` or `HEAD` of a relation. */
export interface PlanRead extends PlanDb {
  action: 'read' | 'head'
}

/** `POST`, `PATCH`, `PUT` or `DELETE` of a relation. */
export interface PlanMutation extends PlanDb {
  action: 'insert' | 'update' | 'delete' | 'upsert'
  mutation: unknown
}

/** `/rpc/*` call. */
export interface PlanRpc extends PlanDb {
  action: 'rpc'
  call: unknown
  routine: unknown
  payloadKeys: string[]
}

/** `GET /`: the OpenAPI document. Nothing is read, so there is no `select`, `embeds`, `txMode` or `target`. */
export interface PlanInspect extends PlanBase {
  action: 'inspect'
  schema: string
  media: string
}

/** `OPTIONS /`. */
export interface PlanSchemaInfo extends PlanBase {
  action: 'schemaInfo'
}

/** `OPTIONS` of a table or view. */
export interface PlanRelationInfo extends PlanBase {
  action: 'relationInfo'
  target: QualifiedName
}

/** `OPTIONS` of a function. */
export interface PlanRoutineInfo extends PlanBase {
  action: 'routineInfo'
  routine: unknown
}

/** The plans that go through the database: the ones with a `select` and `embeds`. */
export type PlanCrud = PlanRead | PlanMutation | PlanRpc

/** A successful plan. Narrow on `action`: only {@link PlanCrud} has `select`, `embeds`, `txMode` and `target`. */
export type PlanSuccess =
  | PlanCrud
  | PlanInspect
  | PlanSchemaInfo
  | PlanRelationInfo
  | PlanRoutineInfo

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

  const put = (bytes: Uint8Array): number => {
    const ptr = x.planner_alloc(bytes.length)
    mem().set(bytes, ptr)
    return ptr
  }
  // Results are [u32 LE length][bytes]
  const take = (ptr: number): unknown => {
    const len = new DataView(x.memory.buffer).getUint32(ptr, true)
    const text = dec.decode(mem().subarray(ptr + 4, ptr + 4 + len))
    x.planner_free(ptr)
    return JSON.parse(text)
  }
  // Every input is serialized before the first allocation (serializing can throw), and every buffer that was
  // allocated is freed whatever happens after.
  const withBuffers = <T>(inputs: Uint8Array[], run: (ptrs: number[]) => T): T => {
    const ptrs: number[] = []
    try {
      for (const bytes of inputs) ptrs.push(put(bytes))
      return run(ptrs)
    } finally {
      for (const ptr of ptrs) x.planner_free(ptr)
    }
  }

  return {
    info: () => take(x.planner_info()) as PlannerInfo,
    load({ config, schema, supplementary }) {
      const cfg = enc.encode(JSON.stringify(config))
      const sch = enc.encode(schema)
      const supp =
        supplementary === undefined
          ? undefined
          : enc.encode(
              typeof supplementary === 'string' ? supplementary : JSON.stringify(supplementary)
            )
      // No supplementary catalog is an empty buffer pair.
      return withBuffers(supp === undefined ? [cfg, sch] : [cfg, sch, supp], ([cp, sp, xp]) => {
        const res = x.planner_load(cp, cfg.length, sp, sch.length, xp ?? 0, supp?.length ?? 0)
        return take(res) as LoadResult
      })
    },
    freeCache: (handle) => x.planner_free_cache(handle),
    plan(handle, request) {
      const bytes = enc.encode(JSON.stringify(request))
      return withBuffers(
        [bytes],
        ([p]) => take(x.planner_plan(handle, p, bytes.length)) as PlanResult
      )
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
