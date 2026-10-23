import type {
  FieldProvenance,
  PlannerError,
  ResultShape,
  ShapeEmbed,
  ShapeField,
} from '@supabase/postgrest-planner'
import { classifyType, tsTypeOf } from './pg-types'
import type { SelectsContext } from './selects-context'

/** A planned key: the result shape the planner gave for it. */
export interface PlannedEntry {
  key: string
  /** `PlanSuccess.shape` */
  shape: ResultShape
  /** `PlanSuccess.degraded` */
  degraded?: readonly string[]
}

/** A key the planner rejected, or one the printer could not type: the consumer rejects the builder with `error`. */
export interface ErrorEntry {
  key: string
  error: string
}

/**
 * An entry printed elsewhere: the extension point of the RPC slice (`calls` entries). `body` is the text between the
 * braces of the entry, indented for a member of `interface SupabaseSelects` (6 spaces).
 */
export interface RawEntry {
  key: string
  body: string
}

export type SelectsEntry = PlannedEntry | ErrorEntry | RawEntry

export interface PrintSelectsResult {
  /** Complete `interface SupabaseSelects { ... }`, indented for `declare global { ... }`. Empty without entries */
  text: string
  /** The entries as printed: a planned entry the printer could not type is an `ErrorEntry` here */
  entries: (ErrorEntry | RawEntry | (PlannedEntry & { printed: true }))[]
}

const IDENT = /^[A-Za-z_$][\w$]*$/

/** A single-quoted TypeScript string literal. */
export function quote(value: string): string {
  const body = JSON.stringify(value).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")
  return `'${body}'`
}

/** An object type key: bare when it is an identifier. */
const memberName = (name: string): string => (IDENT.test(name) ? name : quote(name))

/** `PGRST200: Could not find ...`, plus the planner's hint: what the consumer shows for a rejected select. */
export function plannerErrorMessage(failure: PlannerError): string {
  const { code, message, hint } = failure.error
  const text =
    typeof message === 'string' && message !== '' ? message : 'the planner rejected the request'
  const head = typeof code === 'string' && code !== '' ? `${code}: ${text}` : text
  const tip = typeof hint === 'string' && hint !== '' ? ` Hint: ${hint}` : ''
  return `${head}${tip}`
}

// ---------------------------------------------------------------------------------------------------------------
// Type text helpers
// ---------------------------------------------------------------------------------------------------------------

/** Whether `ty` has a `|` or `&` outside brackets and strings, so a suffix like `[]` needs parentheses. */
function isCompound(ty: string): boolean {
  let depth = 0
  let inString: string | null = null
  for (let i = 0; i < ty.length; i++) {
    const c = ty[i]!
    if (inString) {
      if (c === '\\') i++
      else if (c === inString) inString = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') inString = c
    else if (c === '<' || c === '(' || c === '[' || c === '{') depth++
    else if (c === '>' || c === ')' || c === ']' || c === '}') depth--
    else if (depth === 0 && (c === '|' || c === '&')) return true
  }
  return false
}

const array = (ty: string): string => `${isCompound(ty) ? `(${ty})` : ty}[]`
const orNull = (ty: string): string =>
  /(^|\s)null$/.test(ty) && isCompound(ty) ? ty : `${ty} | null`

/** What a spread does to the values it merges into its parent. */
type SpreadOp = 'array' | 'null'

function applyOps(ty: string, ops: readonly SpreadOp[]): string {
  let out = ty
  for (let i = ops.length - 1; i >= 0; i--) out = ops[i] === 'array' ? array(out) : orNull(out)
  return out
}

interface Member {
  name: string
  type: string
}

const inlineObject = (members: Member[]): string =>
  members.length === 0
    ? '{}'
    : `{ ${members.map((m) => `${memberName(m.name)}: ${m.type}`).join('; ')} }`

/** The same name twice keeps the later value in the earlier position, as a JSON object would. */
function uniqueMembers(members: Member[]): Member[] {
  const byName = new Map<string, Member>()
  for (const m of members) byName.set(m.name, m)
  return [...byName.values()]
}

// ---------------------------------------------------------------------------------------------------------------
// One entry
// ---------------------------------------------------------------------------------------------------------------

/** Raised while typing a shape: becomes an `{ error }` entry. */
class EntryError extends Error {}

interface EmbedInfo {
  path: string[]
  outputs: string[][]
  join: 'inner' | 'left'
  cardinality: 'one' | 'many'
}

interface PrintedShape {
  row: string
  sources: Member[]
  embeds: EmbedInfo[]
}

const tuple = (items: readonly string[]): string => `[${items.map(quote).join(', ')}]`

class ShapePrinter {
  readonly embeds: EmbedInfo[] = []
  readonly sources: Member[] = []

  constructor(
    private readonly context: SelectsContext,
    private readonly degraded: readonly string[]
  ) {}

  print(shape: ResultShape): PrintedShape {
    const members = this.members(shape, [], true)
    return { row: inlineObject(uniqueMembers(members)), sources: this.sources, embeds: this.embeds }
  }

  /** The members a shape adds to the object it is part of; `ops` are the spreads between it and that object. */
  private members(shape: ResultShape, ops: readonly SpreadOp[], root: boolean): Member[] {
    const members: Member[] = []
    for (const field of shape.fields) {
      members.push({ name: field.name, type: applyOps(this.leaf(field), ops) })
      if (root) this.source(field)
    }
    for (const embed of shape.embeds) {
      if (embed.empty) continue
      this.embeds.push({
        path: embed.path,
        outputs: embed.outputs,
        join: embed.join,
        cardinality: embed.cardinality,
      })
      if (embed.spread) {
        const op: SpreadOp | undefined =
          embed.cardinality === 'many' ? 'array' : embed.nullable ? 'null' : undefined
        members.push(...this.members(embed.shape, op ? [...ops, op] : ops, false))
        continue
      }
      members.push({
        name: embed.key ?? embed.alias ?? embed.name,
        type: applyOps(this.embed(embed), ops),
      })
    }
    return members
  }

  /** The value of a plain embed: an object, an array of them, nullable per the planner. */
  private embed(embed: ShapeEmbed): string {
    const object = inlineObject(uniqueMembers(this.members(embed.shape, [], false)))
    if (embed.cardinality === 'many') return embed.nullable ? orNull(array(object)) : array(object)
    return embed.nullable ? orNull(object) : object
  }

  /** `sources`: root fields that are a stored column's value, so a filter fact on the column applies to them */
  private source(field: ShapeField): void {
    const prov = field.provenance
    if (prov.kind !== 'plain' || field.pgType === null) return
    const c = classifyType(field.pgType, this.context.types)
    if (c.kind === 'composite' || c.kind === 'relation') return
    if (c.kind === 'builtin' && (c.name === 'json' || c.name === 'jsonb')) return
    this.sources.push({ name: field.name, type: quote(prov.source.column) })
  }

  // -------------------------------------------------------------------------------------------------------------
  // Leaves
  // -------------------------------------------------------------------------------------------------------------

  private leaf(field: ShapeField): string {
    const prov = field.provenance
    if (prov.kind === 'unresolved') {
      // Without a catalog the planner cannot tell a computed field from a missing column: stay honest, not wrong
      if (this.degraded.some((d) => d.startsWith('computed-field:'))) return 'unknown'
      throw new EntryError(`\`${field.name}\`: ${prov.reason}`)
    }
    this.learnDomain(field)
    if (prov.kind === 'plain') {
      const k = this.columnKey(prov.source)
      const derived = this.derived(k.key, field.pgType)
      return `SupabaseColumnType<${quote(k.key)}, ${derived}>${(k.nullable ?? field.nullable) ? ' | null' : ''}`
    }
    if (prov.kind === 'jsonPath') {
      const path = this.jsonPath(prov)
      if (path !== undefined) return path
    }
    // cast, aggregate, computed, representation: the value is computed, nothing of the column's type is left
    const ty = field.pgType === null ? 'unknown' : tsTypeOf(field.pgType, this.context.types)
    return field.nullable ? orNull(ty) : ty
  }

  private learnDomain(field: ShapeField): void {
    if (field.pgType && field.baseType && field.baseType !== field.pgType) {
      this.context.domains.set(field.pgType, field.baseType)
    }
  }

  /** The base column a (view) column passes through from, and its traced nullability */
  private columnKey(source: { schema: string; relation: string; column: string }): {
    key: string
    nullable?: boolean
  } {
    const own = `${source.schema}.${source.relation}.${source.column}`
    const traced = this.context.traces
      .get(`${source.schema}.${source.relation}`)
      ?.get(source.column)
    if (!traced) return { key: own }
    const origin = traced.source
    return {
      key: origin ? `${origin.schema}.${origin.relation}.${origin.column}` : own,
      nullable: traced.nullable,
    }
  }

  private derived(columnKey: string, pgType: string | null): string {
    return (
      this.context.jsonSchemas.get(columnKey) ??
      (pgType === null ? 'unknown' : tsTypeOf(pgType, this.context.types))
    )
  }

  /** `data->a->>b`: the indexed value, typed against the column's own (possibly JSON Schema derived) type */
  private jsonPath(prov: Extract<FieldProvenance, { kind: 'jsonPath' }>): string | undefined {
    if (prov.of.kind !== 'plain' || prov.path.length === 0) return undefined
    const source = prov.of.source
    const star = this.context.plans.get(`${source.schema}.${source.relation}`)
    const column = star?.find((f) => f.name === source.column)
    const k = this.columnKey(source)
    const columnType = `SupabaseColumnType<${quote(k.key)}, ${this.derived(k.key, column?.pgType ?? 'jsonb')}>`
    const steps = prov.path.map((s) => ('key' in s ? s.key : String(s.index)))
    const last = prov.path[prov.path.length - 1]!
    const helper = last.op === '->>' ? 'PgrstJsonText' : 'PgrstJson'
    return `import(${quote(this.context.importFrom)}).${helper}<${columnType}, ${tuple(steps)}>`
  }
}

/** The row, sources and embeds of a planned entry. Throws `EntryError` for a shape that cannot be typed. */
function printShape(context: SelectsContext, entry: PlannedEntry): PrintedShape {
  return new ShapePrinter(context, entry.degraded ?? []).print(entry.shape)
}

// ---------------------------------------------------------------------------------------------------------------
// The interface
// ---------------------------------------------------------------------------------------------------------------

function printEntry(key: string, body: string): string {
  return `    ${quote(key)}: {\n${body}\n    }`
}

function printPlanned(context: SelectsContext, entry: PlannedEntry): string | EntryError {
  let printed: PrintedShape
  try {
    printed = printShape(context, entry)
  } catch (error) {
    if (error instanceof EntryError) return error
    throw error
  }
  const sources =
    printed.sources.length === 0
      ? '{}'
      : `{ ${printed.sources.map((s) => `${memberName(s.name)}: ${s.type}`).join('; ')} }`
  const embeds =
    printed.embeds.length === 0
      ? '{}'
      : `{\n${printed.embeds
          .map(
            (e) =>
              `        ${memberName(e.path.join('.'))}: { path: ${tuple(e.path)}; outputs: [${e.outputs.map(tuple).join(', ')}]; join: ${quote(e.join)}; cardinality: ${quote(e.cardinality)} }`
          )
          .join('\n')}\n      }`
  return printEntry(
    entry.key,
    [`      row: ${printed.row}`, `      sources: ${sources}`, `      embeds: ${embeds}`].join('\n')
  )
}

const isError = (e: SelectsEntry): e is ErrorEntry => 'error' in e
const isRaw = (e: SelectsEntry): e is RawEntry => 'body' in e

/**
 * Prints `interface SupabaseSelects` (design v5 §5.2): a planned entry is `{ row, sources, embeds }`, a rejected one
 * `{ error }`, a raw one (RPC `calls`, printed by the RPC slice) its own body. Entries are sorted by key; the
 * same key twice keeps the first. Pure.
 */
export function printSelects(
  context: SelectsContext,
  entries: readonly SelectsEntry[]
): PrintSelectsResult {
  const sorted = [...entries].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  const seen = new Set<string>()
  const blocks: string[] = []
  const printed: PrintSelectsResult['entries'] = []
  for (const entry of sorted) {
    if (seen.has(entry.key)) continue
    seen.add(entry.key)
    if (isError(entry)) {
      blocks.push(printEntry(entry.key, `      error: ${JSON.stringify(entry.error)}`))
      printed.push(entry)
    } else if (isRaw(entry)) {
      blocks.push(printEntry(entry.key, entry.body))
      printed.push(entry)
    } else {
      const text = printPlanned(context, entry)
      if (text instanceof EntryError) {
        const error = `unresolved select item ${text.message}`
        blocks.push(printEntry(entry.key, `      error: ${JSON.stringify(error)}`))
        printed.push({ key: entry.key, error })
      } else {
        blocks.push(text)
        printed.push({ ...entry, printed: true })
      }
    }
  }
  if (blocks.length === 0) return { text: '', entries: printed }
  return { text: `  interface SupabaseSelects {\n${blocks.join('\n')}\n  }`, entries: printed }
}
