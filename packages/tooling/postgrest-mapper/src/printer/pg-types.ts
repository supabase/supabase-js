/**
 * PostgreSQL type to TypeScript type, the one place that knows the mapping (design v5 §5.1: the conventions of
 * `supabase gen types typescript`).
 *
 * Pure. The input is a type name as the planner spells it (`int4`, `timestamptz`, `public.user_status`, `text[]`) or
 * as `format_type` does (`integer`, `character varying(255)`, `timestamp(3) with time zone`, `"MyType"[]`).
 */

import { relationKey } from '../keys'
import type { SupplementaryType } from '../schema'
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
  /** The schema the spelling qualifies the name with (`public` of `public.user_status`); absent for a bare name */
  schema?: string
  /** Internal name without schema, modifiers and `[]`: a dot inside it belongs to the name */
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
  if (parts.length > 1)
    return { schema: parts[parts.length - 2]!, name: parts[parts.length - 1]!, dims }
  const bare = parts[0] ?? ''
  return {
    name:
      quoted && bare !== 'char' ? bare : Object.hasOwn(SPELLINGS, bare) ? SPELLINGS[bare]! : bare,
    dims,
  }
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

/** What the printer knows about the types of the database. Keys are `relationKey(schema, name)`. */
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
  /** Domain to the type it is defined over (`relationKey('public', 'positive_int')` to `int4`) */
  domains: ReadonlyMap<string, string>
  /**
   * Array type of a user type to the element type (`relationKey('public', '_user_status')` to `public.user_status`):
   * the planner reports such an array by its own identifier. Default: none
   */
  arrays?: ReadonlyMap<string, NormalizedType>
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

/** `SupabaseDatabase['public']['Enums']['user_status']` */
export function databaseRef(
  ctx: TypeContext,
  schema: string,
  section: string,
  name: string
): string {
  return `${ctx.databaseType ?? 'SupabaseDatabase'}[${quote(schema)}][${quote(section)}][${quote(name)}]`
}

/**
 * Records a domain the planner reported for a field: its `pgType` (as `format_type` spells it, quoted where the name
 * needs it: `public."Amount"`) and the base type under it. `TypeContext.domains` is keyed by the schema and name as
 * the catalog holds them, so the quotes are taken off here and a quoted domain resolves. A name without a schema
 * is not a domain the planner reports.
 */
export function rememberDomain(
  domains: Map<string, string>,
  pgType: string,
  baseType: string
): void {
  const { schema, name, dims } = normalizeType(pgType)
  if (schema !== undefined && dims === 0) domains.set(relationKey(schema, name), baseType)
}

/**
 * The domains and the array types of the user types the catalog lists (the `types` of the supplementary catalog), in
 * the shapes `TypeContext` holds them. An element spelled without a schema is of the schema of its array type, which
 * always lives next to its element.
 */
export function catalogTypeFacts(types: readonly SupplementaryType[]): {
  domains: Map<string, string>
  arrays: Map<string, NormalizedType>
} {
  const domains = new Map<string, string>()
  const arrays = new Map<string, NormalizedType>()
  for (const t of types) {
    const key = relationKey(t.schema, t.name)
    if (t.kind === 'd' && typeof t.base === 'string') domains.set(key, t.base)
    if (typeof t.element === 'string') {
      const element = normalizeType(t.element)
      arrays.set(key, { ...element, schema: element.schema ?? t.schema })
    }
  }
  return { domains, arrays }
}

/** Follows a domain to the type it is defined over (and the array dimensions it adds). Guards against a cycle. */
function resolveDomain(type: NormalizedType, ctx: TypeContext): NormalizedType {
  let current = type
  let dims = 0
  for (let i = 0; i < 8; i++) {
    const next = ctx.domains.get(relationKey(current.schema ?? defaultSchemaOf(ctx), current.name))
    if (next === undefined) break
    current = normalizeType(next)
    dims += current.dims
  }
  return { ...current, dims }
}

/** The extension types the mapping knows, by the schema Supabase installs the extension in */
const EXTENSION_TYPES: Readonly<Record<string, readonly string[]>> = {
  extensions: ['citext', 'vector'],
}

/**
 * Whether a type is one the mapping knows: a `pg_catalog` type, which is spelled without a schema, or an extension
 * type of its schema. A name that only reads like one in another schema (an enum `extensions.int4`) is a user type.
 */
const isBuiltin = (schema: string | undefined, name: string): boolean =>
  Object.hasOwn(BUILTIN_TS, name) &&
  (schema === undefined ||
    schema === 'pg_catalog' ||
    (Object.hasOwn(EXTENSION_TYPES, schema) && EXTENSION_TYPES[schema]!.includes(name)))

const defaultSchemaOf = (ctx: TypeContext): string => ctx.defaultSchema ?? 'public'

/** Kind of a normalised, non-array name: builtin, enum, composite, relation row, or unknown. */
export type TypeKind = 'builtin' | 'enum' | 'composite' | 'relation' | 'unknown'

export interface ClassifiedType {
  kind: TypeKind
  /** The schema of an enum, a composite, a relation row (the default schema for a bare name); absent for a builtin */
  schema?: string
  /** Normalised name after resolving domains, without schema */
  name: string
  /** Array dimensions of the type itself plus those a domain over an array adds */
  dims: number
}

/** The type of a spelling (`format_type`, the planner's) or one a caller already normalised. */
export function classifyType(type: string | NormalizedType, ctx: TypeContext): ClassifiedType {
  const named = typeof type === 'string' ? normalizeType(type) : type
  // the planner names the array of a user type by its own identifier (`public._user_status`)
  const element = ctx.arrays?.get(relationKey(named.schema ?? defaultSchemaOf(ctx), named.name))
  const normalized = element ? { ...element, dims: named.dims + 1 } : named
  const resolved = resolveDomain(normalized, ctx)
  const dims = normalized.dims + resolved.dims
  const { name } = resolved
  const schema = resolved.schema ?? defaultSchemaOf(ctx)
  const key = relationKey(schema, name)
  if (ctx.enums.has(key)) return { kind: 'enum', schema, name, dims }
  if (ctx.composites.has(key)) return { kind: 'composite', schema, name, dims }
  if (ctx.relations.has(key)) return { kind: 'relation', schema, name, dims }
  if (isBuiltin(resolved.schema, name)) return { kind: 'builtin', name, dims }
  return { kind: 'unknown', ...(resolved.schema === undefined ? {} : { schema }), name, dims }
}

/** A type without schema and modifiers, for comparing two spellings of it (a dump's, a catalog's, the planner's). */
export function canonicalType(type: string): string {
  const n = normalizeType(type)
  return n.name + '[]'.repeat(n.dims)
}

/** Whether values of this type are JSON documents (`json`, `jsonb`, or a domain over them), any array depth aside. */
export function isJsonType(type: string | NormalizedType, ctx: TypeContext): boolean {
  const c = classifyType(type, ctx)
  return c.kind === 'builtin' && (c.name === 'json' || c.name === 'jsonb')
}

/** The TypeScript type expression for a PostgreSQL type, as a member of `Row` / `Returns` (JSON reads) or `Args`. */
export function tsTypeOf(type: string | NormalizedType, ctx: TypeContext): string {
  const c = classifyType(type, ctx)
  let ts: string
  switch (c.kind) {
    case 'builtin': {
      ts = BUILTIN_TS[c.name]!
      if (ts === 'Json' && ctx.jsonType) ts = ctx.jsonType
      break
    }
    case 'enum': {
      ts = databaseRef(ctx, c.schema!, 'Enums', c.name)
      break
    }
    case 'composite': {
      ts = databaseRef(ctx, c.schema!, 'CompositeTypes', c.name)
      break
    }
    case 'relation': {
      // a composite value, not a row of the table: every attribute can be null
      ts = compositeValue(ctx.relations.get(relationKey(c.schema!, c.name))!, ctx)
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
