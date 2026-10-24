import type {
  FieldProvenance,
  PlannerError,
  ResultShape,
  ShapeEmbed,
  ShapeField,
} from '@supabase/postgrest-planner'
import { columnKey, columnTypeKey, relationKey, type ColumnRef } from '../keys'
import { memberName, quote, quoteDouble } from './literal'
import type { FunctionRows } from './function-rows'
import { classifyType, isJsonType, rememberDomain, tsTypeOf } from './pg-types'
import type { SelectsContext } from './selects-context'
import type { TracedColumn } from '../tracer'

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
export const orNull = (ty: string): string =>
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
  /** The stored column the member's value is, for a root field that is one */
  column?: string
  /** The embeds the member's value comes from, with the ones nested in them: they stand or fall with the member */
  embeds: EmbedInfo[]
}

const inlineObject = (members: Member[]): string =>
  members.length === 0
    ? '{}'
    : `{ ${members.map((m) => `${memberName(m.name)}: ${m.type}`).join('; ')} }`

/**
 * The same name twice keeps the later value in the earlier position, as a JSON object would. `depth` is the number
 * of embeds the object is nested in: the outputs of an embed are paths from the root row, so `o[depth]` of an output
 * is the key of the member of this object it belongs to. An embed lists no output of a member the row replaced.
 */
function uniqueMembers(members: Member[], depth: number): Member[] {
  const byName = new Map<string, Member>()
  for (const m of members) byName.set(m.name, m)
  const survivors = [...byName.values()]
  const holders = new Map<EmbedInfo, Set<string>>()
  for (const m of survivors) {
    for (const info of m.embeds) {
      const names = holders.get(info) ?? new Set<string>()
      holders.set(info, names.add(m.name))
    }
  }
  const kept = new Map<EmbedInfo, EmbedInfo>()
  for (const [info, names] of holders) {
    const outputs = info.outputs.filter((o) => o[depth] === undefined || names.has(o[depth]!))
    kept.set(info, outputs.length === info.outputs.length ? info : { ...info, outputs })
  }
  return survivors.map((m) => ({ ...m, embeds: m.embeds.map((info) => kept.get(info)!) }))
}

/** The key an embed is printed under in `embeds`. */
const embedKey = (embed: EmbedInfo): string => embed.path.join('.')

/**
 * One entry per printed key: embeds that share one (the same relation spread twice, a spread and an embed of the
 * relation) merge into an entry that lists the outputs of both. The merged join and cardinality are the widest of the
 * two (`left`, `one`): a fact the consumer applies to a `left` / `one` entry only widens the type.
 */
function mergeEmbeds(embeds: readonly EmbedInfo[]): EmbedInfo[] {
  const byKey = new Map<string, EmbedInfo>()
  for (const embed of embeds) {
    const earlier = byKey.get(embedKey(embed))
    if (!earlier) {
      byKey.set(embedKey(embed), embed)
      continue
    }
    const seen = new Set(earlier.outputs.map((o) => JSON.stringify(o)))
    byKey.set(embedKey(embed), {
      path: embed.path,
      outputs: [...earlier.outputs, ...embed.outputs.filter((o) => !seen.has(JSON.stringify(o)))],
      join: earlier.join === 'inner' && embed.join === 'inner' ? 'inner' : 'left',
      cardinality: earlier.cardinality === 'many' && embed.cardinality === 'many' ? 'many' : 'one',
    })
  }
  return [...byKey.values()]
}

// ---------------------------------------------------------------------------------------------------------------
// One entry
// ---------------------------------------------------------------------------------------------------------------

/** Raised while typing a shape: becomes an `{ error }` entry. */
export class EntryError extends Error {}

export interface EmbedInfo {
  path: string[]
  outputs: string[][]
  join: 'inner' | 'left'
  cardinality: 'one' | 'many'
}

export interface PrintedShape {
  row: string
  sources: { name: string; type: string }[]
  embeds: EmbedInfo[]
}

export const tuple = (items: readonly string[]): string => `[${items.map(quote).join(', ')}]`

/** The base column a (view) column passes through from, and its traced nullability */
export function columnKeyOf(
  context: SelectsContext,
  source: ColumnRef
): { column: ColumnRef; nullable?: boolean } {
  const traced = context.traces.get(relationKey(source.schema, source.relation))?.get(source.column)
  if (!traced) return { column: source }
  return { column: traced.source ?? source, nullable: traced.nullable }
}

/**
 * The type of a column: its JSON Schema derived type when it has one, else the type mapping of its Postgres type.
 * `bypassSchema` is for the rows of a function, which can hold values the table's CHECK constraints would refuse.
 */
export function derivedType(
  context: SelectsContext,
  column: ColumnRef,
  pgType: string | null,
  bypassSchema = false
): string {
  return (
    (bypassSchema ? undefined : context.jsonSchemas.get(columnKey(column))) ??
    (pgType === null ? 'unknown' : tsTypeOf(pgType, context.types))
  )
}

class ShapePrinter {
  constructor(
    private readonly context: SelectsContext,
    private readonly degraded: readonly string[],
    private readonly rows?: FunctionRows
  ) {}

  print(shape: ResultShape): PrintedShape {
    // collisions first: provenance belongs to the member that wins the name, not to one it replaced
    const members = uniqueMembers(this.members(shape, [], true, 0), 0)
    const sources = members.flatMap((m) =>
      m.column === undefined ? [] : [{ name: m.name, type: quote(m.column) }]
    )
    // the embed of a member a later one replaced is not in the row, so it is not in the metadata either
    const embeds = mergeEmbeds([...new Set(members.flatMap((m) => m.embeds))])
    return { row: inlineObject(members), sources, embeds }
  }

  /** The members a shape adds to the object it is part of; `ops` are the spreads between it and that object. */
  private members(
    shape: ResultShape,
    ops: readonly SpreadOp[],
    root: boolean,
    depth: number
  ): Member[] {
    const members: Member[] = []
    for (const field of shape.fields) {
      const member: Member = {
        name: field.name,
        type: applyOps(this.leaf(field, root), ops),
        embeds: [],
      }
      const column = root ? this.sourceColumn(field) : undefined
      if (column !== undefined) member.column = column
      members.push(member)
    }
    for (const embed of shape.embeds) {
      if (embed.empty) continue
      const info: EmbedInfo = {
        path: embed.path,
        outputs: embed.outputs,
        join: embed.join,
        cardinality: embed.cardinality,
      }
      const nullable = root ? this.embedNullable(embed) : embed.nullable
      if (embed.spread) {
        const op: SpreadOp | undefined =
          embed.cardinality === 'many' ? 'array' : nullable ? 'null' : undefined
        for (const member of this.members(embed.shape, op ? [...ops, op] : ops, false, depth)) {
          members.push({ ...member, embeds: [info, ...member.embeds] })
        }
        continue
      }
      const value = this.embed(embed, nullable, depth + 1)
      members.push({
        name: embed.key ?? embed.alias ?? embed.name,
        type: applyOps(value.type, ops),
        embeds: [info, ...value.embeds],
      })
    }
    return members
  }

  /** The value of a plain embed: an object, an array of them, nullable per the planner; and the embeds inside it. */
  private embed(
    embed: ShapeEmbed,
    nullable: boolean,
    depth: number
  ): { type: string; embeds: EmbedInfo[] } {
    const members = uniqueMembers(this.members(embed.shape, [], false, depth), depth)
    const object = inlineObject(members)
    const embeds = members.flatMap((m) => m.embeds)
    if (embed.cardinality === 'many')
      return { type: nullable ? orNull(array(object)) : array(object), embeds }
    return { type: nullable ? orNull(object) : object, embeds }
  }

  /**
   * Whether a to-one embed of the root can be null. The planner makes it so for the rows of a function, whatever the
   * key proves (`function-rows`): the function can return a row the key does not hold for. A set returned by a
   * `STABLE` or `IMMUTABLE` function runs on the snapshot of the statement, so when the trace proves every key column
   * is a stored one of the table that declares the key (design v5 section 4.3), the parent row exists.
   */
  private embedNullable(embed: ShapeEmbed): boolean {
    const { rows } = this
    const relationship = embed.relationship
    if (
      !rows?.setof ||
      !rows.snapshot ||
      !rows.table ||
      !embed.nullable ||
      embed.reason !== 'function-rows' ||
      !embed.fkProven ||
      embed.cardinality !== 'one' ||
      embed.join !== 'left' ||
      relationship?.fkSide !== 'origin' ||
      // the columns of a composite key must come from one stored row, which the trace does not say
      relationship.columns.length !== 1 ||
      hasInner(embed.shape)
    ) {
      return embed.nullable
    }
    const { from } = relationship.columns[0]!
    const traced = rows.columns.get(from)
    const origin = traced?.source
    const proven =
      traced !== undefined &&
      !traced.nullable &&
      origin !== undefined &&
      origin.schema === rows.table.schema &&
      origin.relation === rows.table.name &&
      origin.column === from
    return !proven
  }

  /** The stored column a root field is the value of, so a filter fact on the column applies to it */
  private sourceColumn(field: ShapeField): string | undefined {
    const prov = field.provenance
    const column =
      prov.kind === 'plain'
        ? prov.source.column
        : prov.kind === 'outColumn'
          ? prov.column
          : prov.kind === 'compositeAttribute'
            ? prov.attribute
            : undefined
    if (column === undefined || field.pgType === null) return undefined
    const c = classifyType(field.pgType, this.context.types)
    if (c.kind === 'composite' || c.kind === 'relation') return undefined
    if (c.kind === 'builtin' && (c.name === 'json' || c.name === 'jsonb')) return undefined
    return column
  }

  // -------------------------------------------------------------------------------------------------------------
  // Leaves
  // -------------------------------------------------------------------------------------------------------------

  private leaf(field: ShapeField, root: boolean): string {
    const prov = field.provenance
    if (prov.kind === 'unresolved') {
      // Without a catalog the planner cannot tell a computed field from a missing column: stay honest, not wrong
      if (this.degraded.some((d) => d.startsWith('computed-field:'))) return 'unknown'
      throw new EntryError(`\`${field.name}\`: ${prov.reason}`)
    }
    this.learnDomain(field)
    if (prov.kind === 'plain') {
      // a function can return rows its table's constraints would refuse: no JSON Schema type, always nullable,
      // unless the trace of its body proves the column
      const functionRows = prov.functionRows === true
      const traced = root && functionRows ? this.traced(prov.source.column) : undefined
      const k = this.columnOf(prov.source, traced?.source)
      const bypass = functionRows && (traced?.source === undefined || !this.isJson(field.pgType))
      const derived = this.derived(k.column, field.pgType, bypass)
      const nullable = traced
        ? this.rowNullable(traced)
        : functionRows || (k.nullable ?? field.nullable)
      return `SupabaseColumnType<${quote(columnTypeKey(k.column))}, ${derived}>${nullable ? ' | null' : ''}`
    }
    if (prov.kind === 'outColumn' || prov.kind === 'compositeAttribute') {
      // the rows of a function the trace of its body covers: a traced stored column keeps its identity
      const traced = root ? this.tracedOf(prov) : undefined
      if (traced) {
        const nullable = this.rowNullable(traced)
        const origin = traced.source
        if (origin) {
          const derived = this.derived(origin, field.pgType, !this.isJson(field.pgType))
          return `SupabaseColumnType<${quote(columnTypeKey(origin))}, ${derived}>${nullable ? ' | null' : ''}`
        }
        const ty = field.pgType === null ? 'unknown' : tsTypeOf(field.pgType, this.context.types)
        return nullable ? orNull(ty) : ty
      }
    }
    if (prov.kind === 'jsonPath') {
      const path = this.jsonPath(prov, root)
      if (path !== undefined) return path
    }
    if (
      prov.kind === 'aggregate' &&
      (prov.function === 'min' || prov.function === 'max') &&
      prov.of
    ) {
      // the aggregated value itself (design v5 §5.3): what is known about the column and its path applies to it, the
      // planner's nullability stays outside
      if (prov.of.kind === 'plain') {
        const functionRows = prov.of.functionRows === true
        const traced = root && functionRows ? this.traced(prov.of.source.column) : undefined
        const k = this.columnOf(prov.of.source, traced?.source)
        const bypass = functionRows && (traced?.source === undefined || !this.isJson(field.pgType))
        const derived = this.derived(k.column, field.pgType, bypass)
        return `SupabaseColumnType<${quote(columnTypeKey(k.column))}, ${derived}>${field.nullable ? ' | null' : ''}`
      }
      const origin = root ? this.tracedOf(prov.of)?.source : undefined
      if (origin) {
        const derived = this.derived(origin, field.pgType, !this.isJson(field.pgType))
        return `SupabaseColumnType<${quote(columnTypeKey(origin))}, ${derived}>${field.nullable ? ' | null' : ''}`
      }
      if (prov.of.kind === 'jsonPath') {
        const path = this.jsonPath(prov.of, root)
        if (path !== undefined) return path
      }
    }
    // cast, count, sum, avg, computed, representation: the value is computed, nothing of the column's type is left
    const ty = field.pgType === null ? 'unknown' : tsTypeOf(field.pgType, this.context.types)
    return field.nullable ? orNull(ty) : ty
  }

  /** What the trace of the function body says about its output column, when there is a trace and the field is of the root. */
  private traced(column: string): TracedColumn | undefined {
    return this.rows ? (this.rows.columns.get(column) ?? { nullable: true }) : undefined
  }

  /** The verdict of the trace for an `OUT` column or composite attribute of the rows of a function, when there is one */
  private tracedOf(prov: FieldProvenance): TracedColumn | undefined {
    return prov.kind === 'outColumn'
      ? this.traced(prov.column)
      : prov.kind === 'compositeAttribute'
        ? this.traced(prov.attribute)
        : undefined
  }

  /** A single composite can be a null one, expanded to a row of nulls: every field of it is nullable whatever the trace says. */
  private rowNullable(traced: TracedColumn): boolean {
    return !this.rows?.setof || traced.nullable
  }

  private isJson(pgType: string | null): boolean {
    return pgType !== null && isJsonType(pgType, this.context.types)
  }

  private learnDomain(field: ShapeField): void {
    if (field.pgType && field.baseType && field.baseType !== field.pgType) {
      rememberDomain(this.context.domains, field.pgType, field.baseType)
    }
  }

  /** The key of a column: the stored column the trace of a function body found, else what the view traces say. */
  private columnOf(
    source: ColumnRef,
    stored?: ColumnRef
  ): {
    column: ColumnRef
    nullable?: boolean
  } {
    if (stored) return { column: stored }
    return columnKeyOf(this.context, source)
  }

  private derived(column: ColumnRef, pgType: string | null, bypassSchema = false): string {
    return derivedType(this.context, column, pgType, bypassSchema)
  }

  /** `data->a->>b`: the indexed value, typed against the column's own (possibly JSON Schema derived) type */
  private jsonPath(
    prov: Extract<FieldProvenance, { kind: 'jsonPath' }>,
    root: boolean
  ): string | undefined {
    if (prov.path.length === 0) return undefined
    const base = prov.of
    let source: { schema: string; relation: string; column: string }
    let stored: typeof source | undefined
    let bypass = false
    if (base.kind === 'plain') {
      source = base.source
      const functionRows = base.functionRows === true
      stored = root && functionRows ? this.traced(source.column)?.source : undefined
      bypass = functionRows && stored === undefined
    } else {
      // an `OUT` column or composite attribute of the rows of a function: only the column the trace found is known
      stored = root ? this.tracedOf(base)?.source : undefined
      if (!stored) return undefined
      source = stored
    }
    const star = this.context.plans.get(relationKey(source.schema, source.relation))
    const column = star?.find((f) => f.name === source.column)
    const k = this.columnOf(source, stored)
    const columnType = `SupabaseColumnType<${quote(columnTypeKey(k.column))}, ${this.derived(k.column, column?.pgType ?? 'jsonb', bypass)}>`
    const steps = prov.path.map((s) => ('key' in s ? s.key : String(s.index)))
    const last = prov.path[prov.path.length - 1]!
    const helper = last.op === '->>' ? 'PgrstJsonText' : 'PgrstJson'
    return `import(${quote(this.context.importFrom)}).${helper}<${columnType}, ${tuple(steps)}>`
  }
}

/** The row, sources and embeds of a shape. Throws `EntryError` for a shape that cannot be typed. */
export function printResultShape(
  context: SelectsContext,
  shape: ResultShape,
  degraded: readonly string[] = [],
  rows?: FunctionRows
): PrintedShape {
  return new ShapePrinter(context, degraded, rows).print(shape)
}

/** Whether a `!inner` embed is anywhere under the shape: it can drop the row the embed hangs from. */
function hasInner(shape: ResultShape): boolean {
  return shape.embeds.some((e) => e.join === 'inner' || hasInner(e.shape))
}

/** `{ id: 'id'; ... }`: the `sources` of an entry, `{}` for none. */
export function printSources(sources: readonly { name: string; type: string }[]): string {
  return sources.length === 0
    ? '{}'
    : `{ ${sources.map((s) => `${memberName(s.name)}: ${s.type}`).join('; ')} }`
}

/** The `embeds` of an entry, `{}` for none; `indent` is the indentation of the line the object opens on plus 2. */
export function printEmbeds(embeds: readonly EmbedInfo[], indent: string): string {
  if (embeds.length === 0) return '{}'
  const lines = embeds.map(
    (e) =>
      `${indent}  ${memberName(embedKey(e))}: { path: ${tuple(e.path)}; outputs: [${e.outputs.map(tuple).join(', ')}]; join: ${quote(e.join)}; cardinality: ${quote(e.cardinality)} }`
  )
  return `{\n${lines.join('\n')}\n${indent}}`
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
    printed = printResultShape(context, entry.shape, entry.degraded ?? [])
  } catch (error) {
    if (error instanceof EntryError) return error
    throw error
  }
  return printEntry(
    entry.key,
    [
      `      row: ${printed.row}`,
      `      sources: ${printSources(printed.sources)}`,
      `      embeds: ${printEmbeds(printed.embeds, '      ')}`,
    ].join('\n')
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
      blocks.push(printEntry(entry.key, `      error: ${quoteDouble(entry.error)}`))
      printed.push(entry)
    } else if (isRaw(entry)) {
      blocks.push(printEntry(entry.key, entry.body))
      printed.push(entry)
    } else {
      const text = printPlanned(context, entry)
      if (text instanceof EntryError) {
        const error = `unresolved select item ${text.message}`
        blocks.push(printEntry(entry.key, `      error: ${quoteDouble(error)}`))
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
