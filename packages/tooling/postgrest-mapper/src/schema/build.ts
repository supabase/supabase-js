import { PgParser } from '@supabase/pg-parser'
import { relationKey } from '../keys'
import { normalizeType } from '../printer/pg-types'
import type { CatalogRelation, TraceCatalog, TraceInput } from '../tracer/types'
import type { Supplementary, SupplementaryFunction, SupplementaryRelation } from './types'

// ---------------------------------------------------------------------------------------------------------------
// Tracer input
// ---------------------------------------------------------------------------------------------------------------

function toCatalogRelation(r: SupplementaryRelation): CatalogRelation {
  // A materialized view's stored rows can predate a NOT NULL or CHECK its base tables gained since the last refresh,
  // so its definition proves nothing about them: like a foreign table, it is opaque (all columns nullable).
  const kind = r.kind === 'r' || r.kind === 'p' ? 'table' : r.kind === 'v' ? 'view' : 'other'
  const relation: CatalogRelation = {
    schema: r.schema,
    name: r.name,
    kind,
    columns: r.columns.map((c) => ({ name: c.name, notNull: c.notNull, type: c.type })),
  }
  if (kind === 'view' && r.viewDefinition) relation.definition = r.viewDefinition
  return relation
}

export interface BuildTraceCatalogOptions {
  /** Schemas searched, in order, for an unqualified name (function bodies). Defaults to `['public']`. */
  searchPath?: string[]
  /**
   * The exposed schemas (`db-schemas`), the ones whose relations the catalog lists completely. Read by
   * `buildFunctionTraceInputs` to cut the search path of a function body. Defaults to the schemas of `relations`.
   */
  exposedSchemas?: string[]
}

/**
 * The tracer's catalog: every exposed relation plus the relations outside the exposed schemas that exposed views
 * select from (`Supplementary.referencedRelations`). Views carry their `pg_get_viewdef` text, which the tracer
 * parses on demand. Pure.
 */
export function buildTraceCatalog(
  supplementary: Supplementary,
  options: BuildTraceCatalogOptions = {}
): TraceCatalog {
  const relations = [...supplementary.relations, ...supplementary.referencedRelations].map(
    toCatalogRelation
  )
  return options.searchPath ? { relations, searchPath: options.searchPath } : { relations }
}

/**
 * The schemas a body can resolve a relation name in, in order, for a function that sets its own `search_path`:
 * `value` is split the way PostgreSQL splits it (comma separated identifiers, a quoted one kept as written with
 * `""` for a quote, an unquoted one folded to lower case) and cut by `completePrefix`. `undefined` when the path cannot be
 * resolved statically (`$user`, a temporary schema) or does not parse: the function is not traced then.
 */
function ownSearchPath(value: string, exposed: ReadonlySet<string>): string[] | undefined {
  const names: string[] = []
  let i = 0
  const n = value.length
  const blank = (c: string | undefined): boolean =>
    c === ' ' || c === '\t' || c === '\n' || c === '\r'
  for (;;) {
    while (blank(value[i])) i++
    let name = ''
    if (value[i] === '"') {
      i++
      for (;;) {
        if (i >= n) return undefined
        if (value[i] === '"') {
          if (value[i + 1] !== '"') break
          i++
        }
        name += value[i++]
      }
      i++
    } else {
      const start = i
      while (i < n && value[i] !== ',' && !blank(value[i])) i++
      if (i === start) return undefined
      name = value.slice(start, i).replace(/[A-Z]/g, (c) => c.toLowerCase())
    }
    names.push(name)
    while (blank(value[i])) i++
    if (i >= n) break
    if (value[i] !== ',') return undefined
    i++
  }
  if (names.some((x) => x === '$user' || x === 'pg_temp' || /^pg_temp_\d+$/.test(x)))
    return undefined
  return completePrefix(names, exposed)
}

/**
 * The schemas of a search path that can be read for a relation name: `pg_catalog` is dropped (it holds no relation the
 * tracer reads) and the list ends before the first schema the catalog does not list completely (one that is not
 * `exposed`), because a relation of that schema could take the name and nothing after it is sound.
 */
function completePrefix(names: readonly string[], exposed: ReadonlySet<string>): string[] {
  const path: string[] = []
  for (const name of names) {
    if (name === 'pg_catalog') continue
    if (!exposed.has(name)) break
    if (!path.includes(name)) path.push(name)
  }
  return path
}

/**
 * One tracer input per single-body `LANGUAGE sql` function of the exposed schemas: its body, its output column
 * names (OUT / `RETURNS TABLE` columns, the attributes of a composite return type, or the function's own name for a
 * scalar) and its parameter names. The search path of a function is its own schema followed by `searchPath`, or the one
 * its own `SET search_path` names (`ownSearchPath`).
 */
export function buildFunctionTraceInputs(
  supplementary: Supplementary,
  options: BuildTraceCatalogOptions = {}
): {
  schema: string
  name: string
  argTypes: string[]
  function: SupplementaryFunction
  input: TraceInput
}[] {
  const base = options.searchPath ?? ['public']
  const exposed = new Set(
    options.exposedSchemas ??
      [...supplementary.relations, ...supplementary.referencedRelations].map((r) => r.schema)
  )
  // the columns of each row type: name and declared type
  const rowTypes = new Map<string, { name: string; type: string }[]>()
  for (const r of [...supplementary.relations, ...supplementary.referencedRelations])
    rowTypes.set(
      relationKey(r.schema, r.name),
      r.columns.map((c) => ({ name: c.name, type: c.type }))
    )
  for (const c of supplementary.composites)
    rowTypes.set(
      relationKey(c.schema, c.name),
      c.attributes.map((a) => ({ name: a.name, type: a.type }))
    )
  // one catalog per search path: the functions of a schema share it
  const catalogs = new Map<string, TraceCatalog>()
  const out: ReturnType<typeof buildFunctionTraceInputs> = []
  for (const fn of supplementary.functions) {
    if (fn.language !== 'sql' || !fn.source) continue
    const returned = normalizeType(fn.returns.type)
    const returnedKey =
      fn.returns.kind === 'composite' && returned.schema !== undefined && returned.dims === 0
        ? relationKey(returned.schema, returned.name)
        : undefined
    const outputs = fn.outColumns ??
      (returnedKey !== undefined ? rowTypes.get(returnedKey) : undefined) ?? [
        { name: fn.name, type: fn.returns.type },
      ]
    let searchPath = completePrefix([fn.schema, ...base], exposed)
    if (fn.searchPath != null) {
      const own = ownSearchPath(fn.searchPath, exposed)
      if (!own) continue
      searchPath = own
    }
    const catalogKey = JSON.stringify(searchPath)
    let catalog = catalogs.get(catalogKey)
    if (!catalog) {
      catalog = buildTraceCatalog(supplementary, { searchPath })
      catalogs.set(catalogKey, catalog)
    }
    out.push({
      schema: fn.schema,
      name: fn.name,
      argTypes: fn.argTypes,
      function: fn,
      input: {
        sql: fn.source,
        columns: outputs.map((c) => c.name),
        outputTypes: outputs.map((c) => c.type),
        catalog,
        parameters: fn.argNames ?? fn.argTypes.map(() => ''),
        functionName: fn.name,
      },
    })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// JSON Schema input (design v5 §6.1)
// ---------------------------------------------------------------------------------------------------------------

/** One JSON/JSONB column and the JSON Schema its validated CHECK constraints prove for every stored value. */
export interface JsonSchemaColumn {
  schema: string
  table: string
  column: string
  /** The column's type as `format_type` spells it: `json` or `jsonb` */
  columnType: string
  /** The constraint's schema, or `{ allOf: [...] }` when several constraints apply. Feed to `jsonSchemaToTs`. */
  jsonSchema: unknown
  /** The constraints it came from */
  constraints: string[]
}

/** A constraint that mentions `json(b)_matches_schema` but proves nothing usable, and why. */
export interface IgnoredJsonSchemaCheck {
  schema: string
  table: string
  constraint: string
  reason: string
}

export interface JsonSchemaInput {
  columns: JsonSchemaColumn[]
  ignored: IgnoredJsonSchemaCheck[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any

const MATCHES_SCHEMA: Record<string, string> = {
  jsonb_matches_schema: 'jsonb',
  json_matches_schema: 'json',
}

/** `'...'::json` or `'...'` */
function constantString(node: Node): string | undefined {
  if (node?.TypeCast) return constantString(node.TypeCast.arg)
  return node?.A_Const?.sval?.sval
}

/** A bare column reference, possibly cast (`data::jsonb`): the column name. */
function columnName(node: Node): string | undefined {
  if (node?.TypeCast) return columnName(node.TypeCast.arg)
  const fields: Node[] | undefined = node?.ColumnRef?.fields
  const last = fields?.[fields.length - 1]?.String?.sval
  return fields && fields.every((f) => f.String) ? last : undefined
}

interface Parsed {
  column: string
  schema: string
}

/** `func('const', col)` -> the column and the parsed schema, or a reason. */
function matchCall(node: Node, wanted: string | undefined): Parsed | string {
  const call = node?.FuncCall
  if (!call) return 'not a call of json(b)_matches_schema'
  const funcname: string = call.funcname?.[call.funcname.length - 1]?.String?.sval
  if (!Object.hasOwn(MATCHES_SCHEMA, funcname)) return 'not a call of json(b)_matches_schema'
  const [schemaArg, columnArg] = call.args ?? []
  const text = constantString(schemaArg)
  if (text === undefined) return 'the schema argument is not a constant'
  const column = columnName(columnArg)
  if (column === undefined) return 'the instance argument is not a plain column'
  if (wanted !== undefined && column !== wanted) {
    return 'the IS NULL guard is not on the validated column'
  }
  try {
    return { column, schema: JSON.parse(text) }
  } catch {
    return 'the schema argument is not valid JSON'
  }
}

const AND_EXPR = 'AND_EXPR'
const OR_EXPR = 'OR_EXPR'

/**
 * A term of a conjunction: `matches(const, col)` or `col IS NULL OR matches(const, col)` (either order). The
 * second form still bounds every non-null value, which is all a type needs.
 */
function matchTerm(node: Node): Parsed | string {
  const bool = node?.BoolExpr
  if (bool?.boolop === OR_EXPR) {
    const args: Node[] = bool.args ?? []
    const nullTests = args.filter((a) => a.NullTest)
    const calls = args.filter((a) => !a.NullTest)
    if (args.length === 2 && nullTests.length === 1 && calls.length === 1) {
      const test = nullTests[0].NullTest
      if (test.nulltesttype !== 'IS_NULL') return 'an OR with a test other than IS NULL'
      // A guard that is not the validated column itself (an expression, another column) can hold while the value
      // is anything, so it must not be read as "NULL or valid".
      const guarded = columnName(test.arg)
      if (guarded === undefined) return 'the IS NULL guard is not a plain column'
      return matchCall(calls[0], guarded)
    }
    return 'an OR of something other than `col IS NULL` and the schema check'
  }
  return matchCall(node, undefined)
}

function conjunctionTerms(node: Node): Node[] {
  // pg_get_constraintdef wraps the expression in redundant parentheses; the parser drops them
  if (node?.BoolExpr?.boolop === AND_EXPR)
    return (node.BoolExpr.args as Node[]).flatMap(conjunctionTerms)
  return [node]
}

/** `CHECK ((expr)) NO INHERIT NOT VALID` -> `expr`, and whether the constraint is `NO INHERIT` */
function checkExpression(
  definition: string
): { expression: string; noInherit: boolean } | undefined {
  const match = /^CHECK \((.*?)\)((?: NO INHERIT| NOT VALID)*)$/s.exec(definition.trim())
  return match ? { expression: match[1]!, noInherit: match[2]!.includes(' NO INHERIT') } : undefined
}

export interface BuildJsonSchemaOptions {
  /** PostgreSQL grammar of the parser. Defaults to 17. */
  pgVersion?: 15 | 16 | 17
}

/**
 * The JSON Schema input: for every validated CHECK constraint that is a plain conjunction of
 * `jsonb_matches_schema('<constant>', col)` / `json_matches_schema(...)` terms (each optionally guarded by
 * `col IS NULL OR`), the schema of the column. Several constraints on a column become an `allOf`. A `NOT VALID` or
 * `NO INHERIT` constraint (a query of the table also returns the rows of its descendants), a non-constant schema or any other shape lands in `ignored` with the reason, never in `columns`.
 *
 * Constraint definitions are parsed with libpg_query, hence asynchronous. Only columns of type `json` / `jsonb` are
 * reported.
 */
export async function buildJsonSchemaInput(
  supplementary: Supplementary,
  options: BuildJsonSchemaOptions = {}
): Promise<JsonSchemaInput> {
  const parser = new PgParser<17>({ version: options.pgVersion ?? 17 })
  await parser.ready
  const relations = new Map(
    [...supplementary.relations, ...supplementary.referencedRelations].map((r) => [
      relationKey(r.schema, r.name),
      r,
    ])
  )
  const byColumn = new Map<string, { schemas: unknown[]; column: JsonSchemaColumn }>()
  const ignored: IgnoredJsonSchemaCheck[] = []

  for (const check of supplementary.jsonSchemaChecks) {
    const skip = (reason: string) =>
      ignored.push({
        schema: check.schema,
        table: check.table,
        constraint: check.constraint,
        reason,
      })
    if (!check.validated) {
      skip('NOT VALID: the constraint says nothing about rows already stored')
      continue
    }
    const definition = checkExpression(check.definition)
    if (definition === undefined) {
      skip('not a CHECK constraint definition')
      continue
    }
    if (definition.noInherit) {
      skip(
        'NO INHERIT: the constraint says nothing about the rows of the tables inheriting from this one'
      )
      continue
    }
    const { expression } = definition
    const parsed = await parser.parse(`select ${expression}`)
    const stmt: Node = parsed.error
      ? undefined
      : (parsed.tree.stmts as Node[] | undefined)?.[0]?.stmt
    const target: Node = stmt?.SelectStmt?.targetList?.[0]
    const root: Node = target?.ResTarget?.val
    if (!root) {
      skip('the constraint expression could not be parsed')
      continue
    }
    const terms: Parsed[] = []
    let reason: string | undefined
    for (const term of conjunctionTerms(root)) {
      const matched = matchTerm(term)
      if (typeof matched === 'string') {
        reason = `not a plain conjunction of schema checks: ${matched}`
        break
      }
      terms.push(matched)
    }
    if (reason !== undefined) {
      skip(reason)
      continue
    }
    const relation = relations.get(relationKey(check.schema, check.table))
    for (const term of terms) {
      const column = relation?.columns.find((c) => c.name === term.column)
      if (!column || (column.type !== 'json' && column.type !== 'jsonb')) {
        skip(`column \`${term.column}\` is not a json or jsonb column`)
        continue
      }
      const key = JSON.stringify([check.schema, check.table, term.column])
      const entry = byColumn.get(key)
      if (entry) {
        entry.schemas.push(term.schema)
        if (!entry.column.constraints.includes(check.constraint)) {
          entry.column.constraints.push(check.constraint)
        }
      } else {
        byColumn.set(key, {
          schemas: [term.schema],
          column: {
            schema: check.schema,
            table: check.table,
            column: term.column,
            columnType: column.type,
            jsonSchema: undefined,
            constraints: [check.constraint],
          },
        })
      }
    }
  }
  const columns = [...byColumn.values()].map(({ schemas, column }) => ({
    ...column,
    jsonSchema: schemas.length === 1 ? schemas[0] : { allOf: schemas },
  }))
  return { columns, ignored }
}
