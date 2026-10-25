import type { ShapeField } from '@supabase/postgrest-planner'
import type { Supplementary, SupplementaryFunction, SupplementaryRelation } from '../schema'
import type { TracedColumn } from '../tracer'
import { columnKey, columnTypeKey, relationKey, type ColumnRef } from '../keys'
import { memberName as key, quote } from './literal'
import { canonicalType, classifyType, tsTypeOf, type TypeContext } from './pg-types'
import { createSelectsContext } from './selects-context'
import type { PrintDatabaseInput } from './types'

const EMPTY_OBJECT = '{ [_ in never]: never }'

interface Member {
  name: string
  optional?: boolean
  type: string
}

/** A multi-line object type; `indent` is the indentation of the line holding the opening brace. */
function object(members: Member[], indent: string, empty = EMPTY_OBJECT): string {
  if (members.length === 0) return empty
  const inner = indent + '  '
  const lines = members.map((m) => `${inner}${key(m.name)}${m.optional ? '?' : ''}: ${m.type}`)
  return `{\n${lines.join('\n')}\n${indent}}`
}

/** `{ a: T }` fields of an inline object (used for the members of a union that is printed on several lines). */
function union(items: string[], indent: string): string {
  if (items.length === 1) return items[0]!
  return items.map((i) => `\n${indent}  | ${i}`).join('')
}

const byName = <T extends { name: string }>(a: T, b: T): number =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// ---------------------------------------------------------------------------------------------------------------
// The schema dump: relationships and function argument optionality
// ---------------------------------------------------------------------------------------------------------------

interface Relationship {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

interface DumpParam {
  name: string
  required: boolean
  type: string
}

interface DumpFacts {
  /** `schema.relation` to its forward foreign keys, sorted */
  relationships: Map<string, Relationship[]>
  /** `schema.function` to every overload's parameters */
  routines: Map<string, DumpParam[][]>
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

/** Reads the parts of the PostgREST schema cache dump the printer needs, defensively: anything unexpected is skipped. */
function readDump(text: string): DumpFacts {
  const facts: DumpFacts = { relationships: new Map(), routines: new Map() }
  let dump: unknown
  try {
    dump = JSON.parse(text)
  } catch {
    return facts
  }
  if (!isRecord(dump)) return facts

  const groups = Array.isArray(dump['dbRelationships']) ? dump['dbRelationships'] : []
  for (const group of groups) {
    const rels = Array.isArray(group) ? group[1] : undefined
    if (!Array.isArray(rels)) continue
    for (const rel of rels) {
      if (!isRecord(rel) || rel['tag'] !== 'Relationship') continue
      const card = rel['relCardinality']
      const table = rel['relTable']
      const foreign = rel['relForeignTable']
      if (!isRecord(card) || !isRecord(table) || !isRecord(foreign)) continue
      const tag = card['tag']
      if (tag !== 'M2O' && tag !== 'O2O') continue
      if (tag === 'O2O' && card['isParent'] === true) continue
      const cols = Array.isArray(card['relColumns']) ? card['relColumns'] : []
      const columns: string[] = []
      const referencedColumns: string[] = []
      for (const pair of cols) {
        if (Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'string') {
          columns.push(pair[0])
          referencedColumns.push(pair[1])
        }
      }
      const owner = relationKey(str(table['qiSchema']) ?? '', str(table['qiName']) ?? '')
      const name = str(card['relCons'])
      const referenced = str(foreign['qiName'])
      if (name === undefined || referenced === undefined) continue
      const list = facts.relationships.get(owner) ?? []
      list.push({
        foreignKeyName: name,
        columns,
        isOneToOne: tag === 'O2O',
        referencedRelation: referenced,
        referencedColumns,
      })
      facts.relationships.set(owner, list)
    }
  }
  for (const list of facts.relationships.values()) {
    list.sort(
      (a, b) =>
        compare(a.foreignKeyName, b.foreignKeyName) ||
        compare(a.referencedRelation, b.referencedRelation) ||
        compare(a.columns.join(','), b.columns.join(','))
    )
  }

  const routines = Array.isArray(dump['dbRoutines']) ? dump['dbRoutines'] : []
  for (const entry of routines) {
    const overloads = Array.isArray(entry) ? entry[1] : undefined
    if (!Array.isArray(overloads)) continue
    for (const routine of overloads) {
      if (!isRecord(routine)) continue
      const schema = str(routine['pdSchema'])
      const name = str(routine['pdName'])
      if (schema === undefined || name === undefined || !Array.isArray(routine['pdParams']))
        continue
      const params: DumpParam[] = []
      for (const p of routine['pdParams']) {
        if (!isRecord(p)) continue
        params.push({
          name: str(p['ppName']) ?? '',
          required: p['ppReq'] !== false,
          type: str(p['ppType']) ?? '',
        })
      }
      const k = relationKey(schema, name)
      const list = facts.routines.get(k) ?? []
      list.push(params)
      facts.routines.set(k, list)
    }
  }
  return facts
}

/** The dump's parameters of a catalog function, when exactly one overload matches by arity, names and types. */
function matchParams(fn: SupplementaryFunction, dump: DumpFacts): DumpParam[] | undefined {
  const candidates = dump.routines.get(relationKey(fn.schema, fn.name)) ?? []
  const names = fn.argNames ?? fn.argTypes.map(() => '')
  const named = candidates.filter(
    (p) => p.length === fn.argTypes.length && p.every((param, i) => param.name === names[i])
  )
  if (named.length === 1) return named[0]
  const wanted = fn.argTypes.map(canonicalType)
  const typed = named.filter((p) => p.every((param, i) => canonicalType(param.type) === wanted[i]))
  return typed.length === 1 ? typed[0] : undefined
}

/** The only parameter types PostgREST passes the request body to when the parameter is unnamed. */
const BODY_TYPES: ReadonlySet<string> = new Set(['bytea', 'json', 'jsonb', 'text', 'xml'])

/**
 * Whether PostgREST can call an overload: the `callable` column of its schema cache query (`SchemaCache.hs`, v16.4),
 * which keeps a function unless it has no argument names at all (`proargnames` is null: every argument is unnamed)
 * and takes more than one argument, or one whose type is not json, jsonb, text, xml or bytea. The name of an
 * argument of a partly named function is an empty string, which that query counts as a name.
 */
function isCallable(fn: SupplementaryFunction): boolean {
  if (fn.argNames !== null) return true
  return fn.argTypes.length < 2 && (fn.argTypes.length === 0 || BODY_TYPES.has(fn.argTypes[0]!))
}

/** The argument names of one overload of a function, as `SupabaseDatabase` prints them in `Args`. */
export interface RoutineSignature {
  /** Names the caller must pass: required members of `Args` (`''` is an unnamed argument) */
  required: string[]
  /** Members printed optional (`name?:`): a default value, or variadic */
  optional: string[]
}

/**
 * Every printed overload of every function, by `relationKey(schema, function)`: the same names and optionality `printDatabase`
 * puts in `Args`, so the key sets the generator plans are the ones the consumer's `KeyMethods` enumerates.
 */
export function routineSignatures(
  supplementary: Supplementary,
  dumpText: string
): Map<string, RoutineSignature[]> {
  const dump = readDump(dumpText)
  const out = new Map<string, RoutineSignature[]>()
  for (const fn of supplementary.functions) {
    if (fn.returns.type === 'trigger' || fn.returns.type === 'event_trigger') continue
    if (!isCallable(fn)) continue
    const params = matchParams(fn, dump)
    const seen = new Set<string>()
    const signature: RoutineSignature = { required: [], optional: [] }
    fn.argTypes.forEach((_, i) => {
      const name = fn.argNames?.[i] ?? ''
      if (seen.has(name)) return
      seen.add(name)
      ;(params && !params[i]!.required ? signature.optional : signature.required).push(name)
    })
    const k = relationKey(fn.schema, fn.name)
    const list = out.get(k) ?? []
    list.push(signature)
    out.set(k, list)
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------------------------------------------

type Placement = 'Tables' | 'Views'

const placementOf = (r: SupplementaryRelation): Placement =>
  r.kind === 'r' || r.kind === 'p' ? 'Tables' : 'Views'
/** Tables and foreign tables carry their own NOT NULL, a view's nullability is traced */
const isTraced = (r: SupplementaryRelation): boolean => r.kind === 'v' || r.kind === 'm'

/** What `printDatabase` knows about one printed relation. */
interface PrintedRelation {
  relation: SupplementaryRelation
  placement: Placement
  fields: readonly ShapeField[]
  traces: ReadonlyMap<string, TracedColumn> | undefined
}

/** The members of `interface SupabaseDatabase { ... }`, indented for `declare global { ... }` (4 spaces). */
export function printDatabase(input: PrintDatabaseInput): string {
  const supplementary: Supplementary = input.supplementary
  const dump = readDump(input.dump)

  // The relations that are printed: exposed, and in the schema cache (they have a plan)
  const printed = new Map<string, PrintedRelation>()
  for (const relation of supplementary.relations) {
    const k = relationKey(relation.schema, relation.name)
    const fields = input.plans.get(k)
    if (!fields) continue
    printed.set(k, {
      relation,
      placement: placementOf(relation),
      fields,
      traces: isTraced(relation) ? input.traces.get(k) : undefined,
    })
  }

  // Its own instance: the domains that select entries learn while they print stay out of `SupabaseDatabase`
  const ctx = createSelectsContext(input).types
  const argCtx: TypeContext = { ...ctx, jsonType: 'JsonIn' }

  const schemaNames = new Set<string>(input.schemas ?? [])
  for (const r of printed.values()) schemaNames.add(r.relation.schema)
  for (const f of supplementary.functions) schemaNames.add(f.schema)
  for (const e of supplementary.enums) schemaNames.add(e.schema)
  for (const c of supplementary.composites) schemaNames.add(c.schema)

  // ---- column values
  /** `SupabaseColumnType<'s.r.c', Derived>` with the column's own nullability outside the wrapper */
  const value = (column: ColumnRef, pgType: string | null, nullable: boolean): string => {
    const derived =
      input.jsonSchemas.get(columnKey(column)) ??
      (pgType === null ? 'unknown' : tsTypeOf(pgType, ctx))
    return `SupabaseColumnType<${quote(columnTypeKey(column))}, ${derived}>${nullable ? ' | null' : ''}`
  }

  /** The column a column goes by: the base column a view column passes through from, else its own */
  const columnOf = (
    p: PrintedRelation,
    column: string
  ): { column: ColumnRef; nullable?: boolean } => {
    const own = { schema: p.relation.schema, relation: p.relation.name, column }
    const traced = p.traces?.get(column)
    return traced ? { column: traced.source ?? own, nullable: traced.nullable } : { column: own }
  }

  const rowMembers = (p: PrintedRelation): Member[] =>
    p.fields.map((f) => {
      const prov = f.provenance
      if (prov.kind !== 'plain') {
        // `select=*` yields plain columns only; anything else carries no source to override
        const derived = f.pgType === null ? 'unknown' : tsTypeOf(f.pgType, ctx)
        return { name: f.name, type: `${derived}${f.nullable ? ' | null' : ''}` }
      }
      const k = columnOf(p, f.name)
      return { name: f.name, type: value(k.column, f.pgType, k.nullable ?? f.nullable) }
    })

  /** Insert / Update members from the catalog's columns */
  const writeMembers = (p: PrintedRelation, mode: 'insert' | 'update'): Member[] => {
    const members: Member[] = []
    const columns = [...p.relation.columns].sort((a, b) => a.attnum - b.attnum)
    for (const c of columns) {
      if (c.generated !== null || c.identity === 'always') continue
      const k = columnOf(p, c.name)
      const nullable = k.nullable ?? !c.notNull
      const required =
        mode === 'insert' &&
        !isTraced(p.relation) &&
        c.notNull &&
        !c.hasDefault &&
        c.identity === null
      members.push({
        name: c.name,
        optional: !required,
        type: value(k.column, c.type, nullable),
      })
    }
    return members
  }

  /** Columns whose returned value is the stored value (design v5 §6.3) */
  const factColumns = (p: PrintedRelation): string => {
    const names: string[] = []
    for (const f of p.fields) {
      if (f.provenance.kind !== 'plain' || f.pgType === null) continue
      const c = classifyType(f.pgType, ctx)
      if (c.kind === 'composite' || c.kind === 'relation') continue
      if (c.kind === 'builtin' && (c.name === 'json' || c.name === 'jsonb')) continue
      names.push(f.name)
    }
    names.sort(compare)
    return names.length === 0 ? 'never' : names.map(quote).join(' | ')
  }

  const relationships = (p: PrintedRelation, indent: string): string => {
    const list = dump.relationships.get(relationKey(p.relation.schema, p.relation.name)) ?? []
    if (list.length === 0) return '[]'
    const inner = indent + '  '
    const tuple = (items: string[]) => `[${items.map(quote).join(', ')}]`
    const rows = list.map(
      (r) =>
        `${inner}{\n${inner}  foreignKeyName: ${quote(r.foreignKeyName)}\n${inner}  columns: ${tuple(r.columns)}\n${inner}  isOneToOne: ${r.isOneToOne}\n${inner}  referencedRelation: ${quote(r.referencedRelation)}\n${inner}  referencedColumns: ${tuple(r.referencedColumns)}\n${inner}}`
    )
    return `[\n${rows.join(',\n')}\n${indent}]`
  }

  const printRelation = (p: PrintedRelation, indent: string): string => {
    const inner = indent + '  '
    const lines = [`${inner}Row: ${object(rowMembers(p), inner)}`]
    const updatable =
      p.placement === 'Views' ? p.relation.updatable : { insert: true, update: true, delete: true }
    if (updatable.insert) {
      lines.push(
        `${inner}Insert: ${object(writeMembers(p, 'insert'), inner, 'Record<string, never>')}`
      )
    }
    if (updatable.update) {
      lines.push(
        `${inner}Update: ${object(writeMembers(p, 'update'), inner, 'Record<string, never>')}`
      )
    }
    lines.push(`${inner}FactColumns: ${factColumns(p)}`)
    lines.push(`${inner}Relationships: ${relationships(p, inner)}`)
    return `{\n${lines.join('\n')}\n${indent}}`
  }

  // ---- functions
  const returnsOf = (fn: SupplementaryFunction, indent: string): string => {
    const { kind, setof, type } = fn.returns
    // OUT columns describe the rows of a function that returns `record` or one scalar (`f(INOUT n int)`). One OUT
    // column of a named row type returns that row, expanded (`f(OUT u users)` answers the columns of `users`, not
    // a `u` key), which is the composite branch below, as it is for the planner.
    const outRows = kind === 'scalar' || type === 'record'
    if (outRows && fn.outColumns && fn.outColumns.length > 0) {
      const row = object(
        fn.outColumns.map((c) => ({ name: c.name, type: `${tsTypeOf(c.type, ctx)} | null` })),
        indent
      )
      return setof ? `${row}[]` : row
    }
    if (kind === 'composite') {
      const c = classifyType(type, ctx)
      const row =
        c.kind === 'composite' || c.kind === 'relation'
          ? tsTypeOf(type, ctx)
          : 'Record<string, unknown>'
      return setof ? `${row}[]` : row
    }
    const ts = tsTypeOf(type, ctx)
    if (ts === 'undefined') return setof ? 'undefined[]' : 'undefined'
    // a function can return NULL as the element of a set; no analysis of its body proves otherwise
    if (setof) return `(${ts} | null)[]`
    return `${ts} | null`
  }

  const argsOf = (fn: SupplementaryFunction, indent: string): string => {
    if (fn.argTypes.length === 0) return 'Record<string, never>'
    const params = matchParams(fn, dump)
    const seen = new Set<string>()
    const members: Member[] = []
    fn.argTypes.forEach((type, i) => {
      const name = fn.argNames?.[i] ?? ''
      if (seen.has(name)) return
      seen.add(name)
      members.push({
        name,
        optional: params ? !params[i]!.required : false,
        type: tsTypeOf(type, argCtx),
      })
    })
    return object(members, indent)
  }

  const printFunctions = (functions: SupplementaryFunction[], indent: string): string => {
    const byFunction = new Map<string, SupplementaryFunction[]>()
    for (const fn of functions) {
      if (fn.returns.type === 'trigger' || fn.returns.type === 'event_trigger') continue
      if (!isCallable(fn)) continue
      const list = byFunction.get(fn.name) ?? []
      list.push(fn)
      byFunction.set(fn.name, list)
    }
    const inner = indent + '  '
    const entries = [...byFunction.entries()].sort(([a], [b]) => compare(a, b))
    if (entries.length === 0) return EMPTY_OBJECT
    const lines = entries.map(([name, overloads]) => {
      overloads.sort((a, b) => compare(a.argTypes.join(','), b.argTypes.join(',')))
      const members = overloads.map((fn) => {
        const memberIndent = overloads.length === 1 ? inner : inner + '  '
        const body = `${memberIndent}  Args: ${argsOf(fn, memberIndent + '  ')}\n${memberIndent}  Returns: ${returnsOf(fn, memberIndent + '  ')}`
        return `{\n${body}\n${memberIndent}}`
      })
      return `${inner}${key(name)}: ${union(members, inner)}`
    })
    return `{\n${lines.join('\n')}\n${indent}}`
  }

  // ---- schemas
  const enumsOf = (schema: string, indent: string): string =>
    object(
      supplementary.enums
        .filter((e) => e.schema === schema)
        .sort(byName)
        .map((e) => ({ name: e.name, type: e.labels.map(quote).join(' | ') || 'never' })),
      indent
    )

  const compositesOf = (schema: string, indent: string): string =>
    object(
      supplementary.composites
        .filter((c) => c.schema === schema)
        .sort(byName)
        .map((c) => ({
          name: c.name,
          type: object(
            [...c.attributes]
              .sort((a, b) => a.attnum - b.attnum)
              .map((a) => ({ name: a.name, type: `${tsTypeOf(a.type, ctx)} | null` })),
            indent + '  '
          ),
        })),
      indent
    )

  const out: string[] = []
  for (const schema of [...schemaNames].sort(compare)) {
    const i2 = '      '
    const i3 = '        '
    const section = (placement: Placement): string => {
      const rels = [...printed.values()]
        .filter((p) => p.relation.schema === schema && p.placement === placement)
        .sort((a, b) => compare(a.relation.name, b.relation.name))
      return object(
        rels.map((p) => ({ name: p.relation.name, type: printRelation(p, i3) })),
        i2
      )
    }
    const functions = supplementary.functions.filter((f) => f.schema === schema)
    out.push(
      `    ${key(schema)}: {\n` +
        `${i2}Tables: ${section('Tables')}\n` +
        `${i2}Views: ${section('Views')}\n` +
        `${i2}Functions: ${printFunctions(functions, i2)}\n` +
        `${i2}Enums: ${enumsOf(schema, i2)}\n` +
        `${i2}CompositeTypes: ${compositesOf(schema, i2)}\n` +
        `    }`
    )
  }
  return out.join('\n')
}
