/**
 * PostgreSQL type to TypeScript type, the one place that knows the mapping (design v5 §5.1: the conventions of
 * `supabase gen types typescript`).
 *
 * Pure. The input is a type name as the planner spells it (`int4`, `timestamptz`, `public.user_status`, `text[]`) or
 * as `format_type` does (`integer`, `character varying(255)`, `timestamp(3) with time zone`, `"MyType"[]`).
 */

import { memberName, quote } from './literal'

/** Builtin name (internal spelling) to the TypeScript type `gen types` prints for it. Everything else is `unknown`. */
export const BUILTIN_TS: Readonly<Record<string, string>> = {
  bool: 'boolean',
  int2: 'number',
  int4: 'number',
  int8: 'number',
  float4: 'number',
  float8: 'number',
  numeric: 'number',
  bytea: 'string',
  bpchar: 'string',
  varchar: 'string',
  date: 'string',
  text: 'string',
  citext: 'string',
  time: 'string',
  timetz: 'string',
  timestamp: 'string',
  timestamptz: 'string',
  uuid: 'string',
  vector: 'string',
  json: 'Json',
  jsonb: 'Json',
  void: 'undefined',
  record: 'Record<string, unknown>',
}

/** `format_type` spellings that differ from the internal name. */
const SPELLINGS: Readonly<Record<string, string>> = {
  integer: 'int4',
  smallint: 'int2',
  bigint: 'int8',
  real: 'float4',
  'double precision': 'float8',
  decimal: 'numeric',
  boolean: 'bool',
  'character varying': 'varchar',
  character: 'bpchar',
  'timestamp without time zone': 'timestamp',
  'timestamp with time zone': 'timestamptz',
  'time without time zone': 'time',
  'time with time zone': 'timetz',
}

export interface NormalizedType {
  /** Internal name, schema qualified (`public.user_status`) outside `pg_catalog`, modifiers and `[]` removed */
  name: string
  /** Number of `[]` suffixes */
  dims: number
}

/** Only spaces are padding: a quoted name can end in a line break. */
const trimSpaces = (text: string): string => text.replace(/^ +| +$/g, '')

/** Strips modifiers and array suffixes and maps `format_type` spellings to internal names. */
export function normalizeType(type: string): NormalizedType {
  let rest = trimSpaces(type)
  let dims = 0
  for (;;) {
    const m = /^(.*?)(?:\[\d*\])$/s.exec(rest)
    if (!m) break
    rest = trimSpaces(m[1]!)
    dims++
  }
  if (/^_/.test(rest) && !rest.includes('.')) {
    // internal array spelling (`_int4`)
    rest = rest.slice(1)
    dims++
  }
  const { parts, quoted } = parseIdentifiers(rest)
  if (parts.length > 1) return { name: parts.join('.'), dims }
  const bare = parts[0] ?? ''
  return { name: quoted && bare !== 'char' ? bare : (SPELLINGS[bare] ?? bare), dims }
}

const MODIFIER = /\(\s*\d+(?:\s*,\s*\d+)?\s*\)/y

/**
 * The dot separated identifiers of a type spelling, as the planner reads a type name: dots, modifiers (`(255)`,
 * `(10,2)`) and padding count outside double quotes only, and `""` inside quotes is one quote. `quoted` is whether the
 * last identifier was quoted: a quoted name is a user type even when it reads like a builtin spelling.
 */
function parseIdentifiers(text: string): { parts: string[]; quoted: boolean } {
  const parts: string[] = []
  let current = ''
  let quoted = false
  let spaced = false
  const finish = (): void => {
    parts.push(spaced ? current.slice(0, -1) : current)
    current = ''
    spaced = false
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (c === '"') {
      quoted = true
      spaced = false
      for (i++; i < text.length; i++) {
        if (text[i] !== '"') current += text[i]
        else if (text[i + 1] === '"') current += text[i++]
        else break
      }
    } else if (c === '.') {
      finish()
      quoted = false
    } else if (c === '(') {
      MODIFIER.lastIndex = i
      const m = MODIFIER.exec(text)
      if (m) i += m[0].length - 1
      else current += c
    } else if (c === ' ') {
      if (!spaced) current += c
      spaced = true
    } else {
      current += c
      spaced = false
    }
  }
  finish()
  return { parts, quoted }
}

/** Unqualified part of a normalised name. */
export function baseName(name: string): string {
  const dot = name.indexOf('.')
  return dot < 0 ? name : name.slice(dot + 1)
}

/** What the printer knows about the types of the database. Keys are `schema.name`. */
export interface TypeContext {
  /** Enum types of the exposed schemas */
  enums: ReadonlySet<string>
  /** Composite types of the exposed schemas */
  composites: ReadonlySet<string>
  /**
   * Tables and views of the exposed schemas, by the attributes of their row type (in `attnum` order): a column or
   * function of this type holds a composite value, which PostgreSQL does not check against the constraints of the
   * relation (`ROW(NULL)::person` is a value even when `person.id` is the primary key)
   */
  relations: ReadonlyMap<string, readonly CompositeAttribute[]>
  /** Domain to the type it is defined over (`public.positive_int` to `int4`) */
  domains: ReadonlyMap<string, string>
  /** Schema an unqualified non-builtin name belongs to. Default `public` */
  defaultSchema?: string
  /** Name of the type of the generated global. Default `SupabaseDatabase` */
  databaseType?: string
  /** Type printed for `json`/`jsonb`: `Json` (values read) or `JsonIn` (function arguments). Default `Json` */
  jsonType?: string
}

/** One attribute of a composite value: its name and `format_type`. */
export interface CompositeAttribute {
  name: string
  type: string
}

/** The row type of a relation: its columns in `attnum` order. */
export function rowTypeOf(
  columns: readonly (CompositeAttribute & { attnum: number })[]
): CompositeAttribute[] {
  return [...columns]
    .sort((a, b) => a.attnum - b.attnum)
    .map((c) => ({ name: c.name, type: c.type }))
}

const isQualified = (name: string): boolean => name.includes('.')

/** `SupabaseDatabase['public']['Enums']['user_status']` */
export function databaseRef(
  ctx: TypeContext,
  schema: string,
  section: string,
  name: string
): string {
  return `${ctx.databaseType ?? 'SupabaseDatabase'}[${quote(schema)}][${quote(section)}][${quote(name)}]`
}

function split(name: string, ctx: TypeContext): [string, string] {
  const dot = name.indexOf('.')
  return dot < 0 ? [ctx.defaultSchema ?? 'public', name] : [name.slice(0, dot), name.slice(dot + 1)]
}

/**
 * Records a domain the planner reported for a field: its `pgType` (as `format_type` spells it, quoted where the name
 * needs it: `public."Amount"`) and the base type under it. `TypeContext.domains` is keyed by `schema.name` as the
 * catalog holds it, the key `normalizeType` gives, so the quotes are taken off here and a quoted domain resolves.
 */
export function rememberDomain(
  domains: Map<string, string>,
  pgType: string,
  baseType: string
): void {
  const { name, dims } = normalizeType(pgType)
  if (dims === 0) domains.set(name, baseType)
}

/** Follows a domain to the type it is defined over (and the array dimensions it adds). Guards against a cycle. */
function resolveDomain(name: string, ctx: TypeContext): NormalizedType {
  let current = name
  let dims = 0
  for (let i = 0; i < 8; i++) {
    const key = isQualified(current) ? current : `${ctx.defaultSchema ?? 'public'}.${current}`
    const next = ctx.domains.get(key)
    if (next === undefined) break
    const inner = normalizeType(next)
    current = inner.name
    dims += inner.dims
  }
  return { name: current, dims }
}

/** Kind of a normalised, non-array name: builtin, enum, composite, relation row, or unknown. */
export type TypeKind = 'builtin' | 'enum' | 'composite' | 'relation' | 'unknown'

export interface ClassifiedType {
  kind: TypeKind
  /** Normalised name after resolving domains */
  name: string
  /** Array dimensions of the type itself plus those a domain over an array adds */
  dims: number
}

export function classifyType(type: string, ctx: TypeContext): ClassifiedType {
  const normalized = normalizeType(type)
  const resolved = resolveDomain(normalized.name, ctx)
  const dims = normalized.dims + resolved.dims
  const name = resolved.name
  const [schema, local] = split(name, ctx)
  const key = `${schema}.${local}`
  if (ctx.enums.has(key)) return { kind: 'enum', name: key, dims }
  if (ctx.composites.has(key)) return { kind: 'composite', name: key, dims }
  if (ctx.relations.has(key)) return { kind: 'relation', name: key, dims }
  // pg_catalog types are unqualified; extension types (`extensions.citext`, `extensions.vector`) map by name
  const builtinName = isQualified(name) ? baseName(name) : name
  if (builtinName in BUILTIN_TS && (!isQualified(name) || schema !== 'public')) {
    return { kind: 'builtin', name: builtinName, dims }
  }
  return { kind: 'unknown', name, dims }
}

/** A type without schema and modifiers, for comparing two spellings of it (a dump's, a catalog's, the planner's). */
export function canonicalType(type: string): string {
  const n = normalizeType(type)
  return baseName(n.name) + '[]'.repeat(n.dims)
}

/** Whether values of this type are JSON documents (`json`, `jsonb`, or a domain over them), any array depth aside. */
export function isJsonType(type: string, ctx: TypeContext): boolean {
  const c = classifyType(type, ctx)
  return c.kind === 'builtin' && (c.name === 'json' || c.name === 'jsonb')
}

/** The TypeScript type expression for a PostgreSQL type, as a member of `Row` / `Returns` (JSON reads) or `Args`. */
export function tsTypeOf(type: string, ctx: TypeContext): string {
  const c = classifyType(type, ctx)
  let ts: string
  switch (c.kind) {
    case 'builtin': {
      ts = BUILTIN_TS[c.name]!
      if (ts === 'Json' && ctx.jsonType) ts = ctx.jsonType
      break
    }
    case 'enum': {
      const [schema, name] = split(c.name, ctx)
      ts = databaseRef(ctx, schema, 'Enums', name)
      break
    }
    case 'composite': {
      const [schema, name] = split(c.name, ctx)
      ts = databaseRef(ctx, schema, 'CompositeTypes', name)
      break
    }
    case 'relation': {
      // a composite value, not a row of the table: every attribute can be null
      ts = compositeValue(ctx.relations.get(c.name)!, ctx)
      break
    }
    default:
      ts = 'unknown'
  }
  return withDims(ts, c.dims)
}

/** `{ a: T | null; ... }`: a composite value, every attribute nullable. */
function compositeValue(attributes: readonly CompositeAttribute[], ctx: TypeContext): string {
  if (attributes.length === 0) return '{ [_ in never]: never }'
  const members = attributes.map((a) => `${memberName(a.name)}: ${tsTypeOf(a.type, ctx)} | null`)
  return `{ ${members.join('; ')} }`
}

/**
 * `T[]` per dimension; a union element gets parentheses. Elements stay non-null and the dimensions are the type's own
 * (`format_type` spells every array with one `[]`): PostgreSQL has no element-level NOT NULL and doesn't enforce
 * declared dimensions, so `{1,NULL}` and `{{1,2},{3,4}}` both fit an `int4[]` column. A column that holds either is
 * typed per column through `SupabaseColumnTypes` (`'public.t.c': (number | null)[]`).
 */
export function withDims(ts: string, dims: number): string {
  if (dims === 0) return ts
  const element = /[|&]/.test(ts) ? `(${ts})` : ts
  return element + '[]'.repeat(dims)
}
