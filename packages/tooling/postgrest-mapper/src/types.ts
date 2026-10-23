/** A file to scan. `fileName` picks the dialect (`.ts`, `.tsx`, `.js`, `.jsx`, …) and labels locations. */
export interface SourceFile {
  fileName: string
  sourceText: string
}

export interface ScanOptions {
  /**
   * The schemas the API exposes (`db-schemas`). When given, a chain without a resolvable `.schema()` is reported
   * with this list instead of `'exposed'`. The scanner never reads the schema cache: which of these schemas
   * actually has the relation is for the planning step to decide.
   */
  exposedSchemas?: readonly string[]
  /**
   * The schema of a chain that never calls `.schema()` (the client's `db.schema`). A chain whose `.schema()` argument
   * does not resolve is not in it: it could be in any exposed schema.
   */
  defaultSchema?: string
}

/** Where a call was found. `start` / `end` are UTF-16 offsets into the file's source text, as in TypeScript. */
export interface SourceLocation {
  fileName: string
  start: number
  end: number
  /** 1-based, of `start` */
  line: number
  /** 1-based, in UTF-16 code units, of `start` */
  column: number
}

/**
 * The schemas a chain is planned in. `'exposed'` means "every exposed schema (`db-schemas`) that has the relation":
 * the call has no resolvable `.schema()` and no `exposedSchemas` option was given. Otherwise the sorted list of
 * schema names: the resolved `.schema()` values, or `exposedSchemas`.
 */
export type SchemaScope = 'exposed' | string[]

/** The methods the runtime can send for an rpc call. */
export type RpcMethod = 'GET' | 'HEAD' | 'POST'

/** A relation read (`r`) or a mutation's representation (`w`). */
export interface RelationTarget {
  kind: 'r' | 'w'
  schemas: SchemaScope
  relation: string
}

/**
 * One planned shape of an rpc call: the function, the literal key set of its `args` (sorted; `[]` for no arguments)
 * or `null` when it isn't an object literal, and the one method it is planned with.
 */
export interface FunctionTarget {
  kind: 'f'
  schemas: SchemaScope
  function: string
  keys: string[] | null
  method: RpcMethod
}

export type PlanTarget = RelationTarget | FunctionTarget

/**
 * `.select(q)` on a chain: plan `select` for `target`. `select` is the raw cooked string (what TypeScript infers
 * as the literal type), not whitespace-normalised: the type side keys on it as is, so whitespace variants are
 * separate requests, and the planned request must use the runtime's normalisation (the planning step's job).
 * `'*'` is the default select; it is recorded (every rpc call has one, which is what dispatches the call) but a bare
 * `*` on a relation needs no plan.
 */
export interface SelectRequest {
  target: PlanTarget
  select: string
  locations: SourceLocation[]
}

/**
 * A filter or modifier call on a chain whose select is `select` at that point of the chain (`'*'` before any
 * `.select()`, as the builder's state says).
 * - `via: 'column'`: `operand` is the cooked column (`channels.id`, `metadata->theme`, a plain column too: the scanner
 *   doesn't know the relation's columns, planning skips plain ones);
 * - `via: 'referencedTable'`: the call carried `{ referencedTable: t }` and `operand` is `@t`. The column of such an
 *   `.order()` / `.filter()` belongs to the embed `t`, so it isn't recorded.
 */
export interface OperandRequest {
  target: PlanTarget
  select: string
  operand: string
  via: 'column' | 'referencedTable'
  locations: SourceLocation[]
}

/**
 * A resolved select the scanner couldn't connect to a relation or function (a builder passed across functions,
 * `from()` with a non-literal argument), paired with a relation or function the same file names. The planning step
 * plans every pair, at most 64 per file (`FALLBACK_PAIR_LIMIT`). Bare `*` selects are never paired.
 */
export interface FallbackPair {
  select: string
  target:
    | { kind: 'relation'; name: string; kinds: ('r' | 'w')[] }
    | { kind: 'function'; name: string }
  schemas: SchemaScope
  /** the unconnected `.select()` calls */
  locations: SourceLocation[]
}

/** Something the scanner met but couldn't resolve to a finite set of strings. Metadata, not a diagnostic. */
export interface UnresolvedUse {
  what: 'select' | 'relation' | 'function' | 'schema'
  location: SourceLocation
}

export interface FileScan {
  fileName: string
  /** the parser reported errors; the scan used whatever it recovered */
  parseErrors: number
  /** more fallback pairs existed than `FALLBACK_PAIR_LIMIT`; the rest were dropped */
  fallbackTruncated: boolean
}

/**
 * Everything to plan. Arrays are deduplicated and sorted (by lookup key, then `locations` by file and offset), so the
 * result doesn't depend on the order of the files.
 */
export interface ScanResult {
  selects: SelectRequest[]
  operands: OperandRequest[]
  fallbacks: FallbackPair[]
  unresolved: UnresolvedUse[]
  files: FileScan[]
}
