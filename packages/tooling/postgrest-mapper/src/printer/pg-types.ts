/**
 * PostgreSQL type to TypeScript type, the one place that knows the mapping (design v5 §5.1: the conventions of
 * `supabase gen types typescript`).
 *
 * Pure. The input is a type name as the planner spells it (`int4`, `timestamptz`, `public.user_status`, `text[]`) or
 * as `format_type` does (`integer`, `character varying(255)`, `timestamp(3) with time zone`, `"MyType"[]`).
 */

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

/** Strips modifiers and array suffixes and maps `format_type` spellings to internal names. */
export function normalizeType(type: string): NormalizedType {
  let rest = type.trim()
  let dims = 0
  for (;;) {
    const m = /^(.*?)(?:\[\d*\])$/.exec(rest)
    if (!m) break
    rest = m[1]!.trim()
    dims++
  }
  if (/^_/.test(rest) && !rest.includes('.')) {
    // internal array spelling (`_int4`)
    rest = rest.slice(1)
    dims++
  }
  // modifiers: varchar(255), numeric(10,2), timestamp(3) with time zone
  rest = rest.replace(/\(\s*\d+(?:\s*,\s*\d+)?\s*\)/g, '').replace(/\s+/g, ' ')
  const dot = rest.lastIndexOf('.')
  if (dot > 0 && !rest.startsWith('"')) {
    const schema = rest.slice(0, dot).replace(/^"|"$/g, '')
    const name = rest.slice(dot + 1).replace(/^"|"$/g, '')
    return { name: `${schema}.${name}`, dims }
  }
  const bare = rest.replace(/^"|"$/g, '')
  const quoted = rest.startsWith('"') && bare !== 'char'
  return { name: quoted ? bare : (SPELLINGS[bare] ?? bare), dims }
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
  /** Tables and views of the exposed schemas: a column or function of this type holds a row */
  relations: ReadonlyMap<string, 'Tables' | 'Views'>
  /** Domain to the type it is defined over (`public.positive_int` to `int4`) */
  domains: ReadonlyMap<string, string>
  /** Schema an unqualified non-builtin name belongs to. Default `public` */
  defaultSchema?: string
  /** Name of the type of the generated global. Default `SupabaseDatabase` */
  databaseType?: string
  /** Type printed for `json`/`jsonb`: `Json` (values read) or `JsonIn` (function arguments). Default `Json` */
  jsonType?: string
}

const isQualified = (name: string): boolean => name.includes('.')

function quoteKey(schema: string): string {
  return `'${schema.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/** `SupabaseDatabase['public']['Enums']['user_status']` */
export function databaseRef(
  ctx: TypeContext,
  schema: string,
  section: string,
  name: string
): string {
  return `${ctx.databaseType ?? 'SupabaseDatabase'}[${quoteKey(schema)}][${quoteKey(section)}][${quoteKey(name)}]`
}

function split(name: string, ctx: TypeContext): [string, string] {
  const dot = name.indexOf('.')
  return dot < 0 ? [ctx.defaultSchema ?? 'public', name] : [name.slice(0, dot), name.slice(dot + 1)]
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
      const [schema, name] = split(c.name, ctx)
      ts = `${databaseRef(ctx, schema, ctx.relations.get(c.name)!, name)}['Row']`
      break
    }
    default:
      ts = 'unknown'
  }
  return withDims(ts, c.dims)
}

/** `T[]` per dimension; a union element gets parentheses. */
export function withDims(ts: string, dims: number): string {
  if (dims === 0) return ts
  const element = /[|&]/.test(ts) ? `(${ts})` : ts
  return element + '[]'.repeat(dims)
}
