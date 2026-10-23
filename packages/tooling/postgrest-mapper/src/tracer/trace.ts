import type {
  CatalogRelation,
  ColumnSource,
  TraceCatalog,
  TraceInput,
  TraceResult,
  TracedColumn,
} from './types'

/** A libpg_query node. Only the fields read here are relied upon, so the parser's PG major version is free. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any

export type ParseSql = (sql: string) => Promise<{ stmts: Node[] } | { error: string }>

/** The query is outside what the tracer understands: the whole result degrades to all-nullable. */
class Unsupported extends Error {}

interface Col {
  name: string
  nullable: boolean
  reason?: string
  source?: ColumnSource
  /** The value's type is in `pg_catalog`. Absent when it is not or when it is unknown. */
  builtin?: boolean
}

/** A named range table entry. `cols: null` means its columns are unknown (function, unknown relation, ...). */
interface Rel {
  alias: string
  /** schema of an unaliased catalog relation, for `schema.table.column` references */
  schema?: string
  cols: Col[] | null
}

interface Scope {
  rels: Rel[]
  /** Columns an unqualified name can resolve to, in `*` order (USING columns merged). */
  visible: Col[]
  open: boolean
}

interface CteEntry {
  name: string
  aliasNames: string[]
  query: Node
  recursive: boolean
  ctx: Ctx
  cols?: Promise<Col[]>
}

interface Ctx {
  ctes: ReadonlyMap<string, CteEntry>
  /** enclosing scopes visible through LATERAL, innermost first */
  outer: Scope[]
  params: string[]
  functionName?: string
  viewStack: string[]
}

type Verdict = Pick<Col, 'nullable' | 'reason' | 'source' | 'builtin'>

const EMPTY: Scope = { rels: [], visible: [], open: false }
const NON_NULL: Verdict = { nullable: false }
const NON_NULL_BUILTIN: Verdict = { nullable: false, builtin: true }
const nullable = (reason: string, source?: ColumnSource): Verdict =>
  source ? { nullable: true, reason, source } : { nullable: true, reason }

/** pg_catalog types whose cast functions return NULL only for NULL input. */
const BUILTIN_TYPES = new Set([
  'bool', 'boolean', 'bytea', 'char', 'bpchar', 'character', 'name', 'int8', 'bigint', 'int2', 'smallint', 'int4',
  'int', 'integer', 'text', 'oid', 'json', 'jsonb', 'xml', 'float4', 'real', 'float8', 'numeric', 'decimal',
  'varchar', 'date', 'time', 'timetz', 'timestamp', 'timestamptz', 'interval', 'bit', 'varbit', 'uuid', 'money',
  'inet', 'cidr', 'macaddr', 'macaddr8', 'regclass', 'regtype', 'regproc', 'regnamespace', 'regrole', 'tsvector',
  'tsquery', 'int4range', 'int8range', 'numrange', 'daterange', 'tsrange', 'tstzrange',
]) // prettier-ignore

/**
 * Whether a `format_type` spelling names a `pg_catalog` type. The catalog schema-qualifies every other type, so a dot
 * outside a quoted identifier means a type of another schema. An unknown type is not trusted.
 */
function inPgCatalog(type: string | undefined): boolean {
  return type !== undefined && !type.replace(/"[^"]*"/g, '').includes('.')
}

/** `col` with its `builtin` flag replaced. */
function withBuiltin(col: Col, builtin: boolean): Col {
  const { builtin: _previous, ...rest } = col
  return builtin ? { ...rest, builtin } : rest
}

function isBuiltinType(typeName: Node): boolean {
  const names: string[] = (typeName?.names ?? []).map((n: Node) => n.String?.sval)
  if (names.length === 0 || names.some((n) => typeof n !== 'string')) return false
  if (names.length === 1) return BUILTIN_TYPES.has(names[0])
  return names.length === 2 && names[0] === 'pg_catalog'
}

function strings(nodes: Node[] | undefined): string[] {
  return (nodes ?? []).map((n) => n.String?.sval ?? '')
}

function sameSource(a?: ColumnSource, b?: ColumnSource): ColumnSource | undefined {
  return a && b && a.schema === b.schema && a.relation === b.relation && a.column === b.column
    ? a
    : undefined
}

function nullify(scope: Scope, reason: string): Scope {
  const mark = (c: Col): Col => (c.nullable ? c : { ...c, nullable: true, reason })
  return {
    rels: scope.rels.map((r) => ({ ...r, cols: r.cols && r.cols.map(mark) })),
    visible: scope.visible.map(mark),
    open: scope.open,
  }
}

function concat(a: Scope, b: Scope): Scope {
  return {
    rels: [...a.rels, ...b.rels],
    visible: [...a.visible, ...b.visible],
    open: a.open || b.open,
  }
}

function rename(cols: Col[], names: string[]): Col[] {
  return cols.map((c, i) => (i < names.length && names[i] ? { ...c, name: names[i] } : c))
}

/** libpg_query / PostgreSQL's FigureColname, for the names an enclosing query can refer to. */
function figureColname(node: Node): string {
  const kind = Object.keys(node ?? {})[0]
  const n = node?.[kind]
  switch (kind) {
    case 'ColumnRef': {
      const last = n.fields?.[n.fields.length - 1]
      return last?.String?.sval ?? '?column?'
    }
    case 'FuncCall': {
      const names = strings(n.funcname)
      return names[names.length - 1] || '?column?'
    }
    case 'TypeCast': {
      const inner = figureColname(n.arg)
      if (inner !== '?column?') return inner
      const names = strings(n.typeName?.names)
      return names[names.length - 1] || '?column?'
    }
    case 'CoalesceExpr':
      return 'coalesce'
    case 'CaseExpr':
      return 'case'
    case 'MinMaxExpr':
      return n.op === 'IS_LEAST' ? 'least' : 'greatest'
    case 'NullIfExpr':
      return 'nullif'
    case 'RowExpr':
      return 'row'
    case 'A_ArrayExpr':
      return 'array'
    case 'SubLink': {
      const sub = n.subselect?.SelectStmt
      const first = sub?.targetList?.[0]?.ResTarget
      if (n.subLinkType === 'EXISTS_SUBLINK') return 'exists'
      if (n.subLinkType === 'ARRAY_SUBLINK') return 'array'
      return first ? first.name || figureColname(first.val) : '?column?'
    }
    default:
      return '?column?'
  }
}

export interface CatalogIndex {
  lookup(schema: string, name: string): CatalogRelation | undefined
  searchPath: string[]
}

const indexCache = new WeakMap<TraceCatalog, CatalogIndex>()

export function indexCatalog(catalog: TraceCatalog): CatalogIndex {
  let index = indexCache.get(catalog)
  if (!index) {
    const map = new Map<string, CatalogRelation>()
    for (const relation of catalog.relations)
      map.set(`${relation.schema}\u0000${relation.name}`, relation)
    index = {
      lookup: (schema, name) => map.get(`${schema}\u0000${name}`),
      searchPath: catalog.searchPath ?? ['public'],
    }
    indexCache.set(catalog, index)
  }
  return index
}

class Run {
  /** Traced views, shared by every reference within one `trace` call. */
  private readonly views = new Map<string, Promise<Col[]>>()

  constructor(
    private readonly parse: ParseSql,
    private readonly catalog: CatalogIndex
  ) {}

  async statement(sql: string, ctx: Ctx): Promise<Col[]> {
    const parsed = await this.parse(sql)
    if ('error' in parsed) throw new Unsupported(`could not parse the SQL: ${parsed.error}`)
    if (parsed.stmts.length !== 1) {
      throw new Unsupported(`expected a single statement, found ${parsed.stmts.length}`)
    }
    const select = parsed.stmts[0]?.SelectStmt
    if (!select) throw new Unsupported('the statement is not a SELECT')
    return this.select(select, ctx)
  }

  // ---- query context --------------------------------------------------------------------------------------------

  private async select(stmt: Node, ctx: Ctx): Promise<Col[]> {
    const inner = stmt.withClause ? { ...ctx, ctes: this.withClause(stmt.withClause, ctx) } : ctx
    const op: string = stmt.op ?? 'SETOP_NONE'
    if (op !== 'SETOP_NONE') {
      const left = await this.select(stmt.larg, inner)
      const right = await this.select(stmt.rarg, inner)
      return this.setOperation(op, left, right)
    }
    if (stmt.valuesLists?.length) return this.values(stmt, inner)
    return this.simple(stmt, inner)
  }

  /** UNION: every arm must prove it. INTERSECT: any arm may. EXCEPT: the left arm decides. */
  private setOperation(op: string, left: Col[], right: Col[]): Col[] {
    if (left.length !== right.length) {
      throw new Unsupported('the arms of a set operation have different column counts')
    }
    return left.map((l, i): Col => {
      const r = right[i]
      // The arms are coerced to one type, which is only known to be built in when both arms are
      const builtin = l.builtin && r.builtin ? { builtin: true } : {}
      switch (op) {
        case 'SETOP_UNION': {
          const source = sameSource(l.source, r.source)
          const isNullable = l.nullable || r.nullable
          const reason = (l.nullable ? l.reason : r.reason) ?? 'nullable in a UNION arm'
          return {
            name: l.name,
            nullable: isNullable,
            ...(isNullable ? { reason } : {}),
            ...(source ? { source } : {}),
            ...builtin,
          }
        }
        case 'SETOP_INTERSECT': {
          const source = sameSource(l.source, r.source)
          const isNullable = l.nullable && r.nullable
          return {
            name: l.name,
            nullable: isNullable,
            ...(isNullable ? { reason: l.reason ?? 'nullable in every INTERSECT arm' } : {}),
            ...(source ? { source } : {}),
            ...builtin,
          }
        }
        default:
          return withBuiltin(l, !!builtin.builtin)
      }
    })
  }

  private async values(stmt: Node, ctx: Ctx): Promise<Col[]> {
    const rows: Node[][] = stmt.valuesLists.map((list: Node) => list.List?.items ?? [])
    const width = rows[0].length
    if (rows.some((row) => row.length !== width))
      throw new Unsupported('VALUES rows differ in width')
    const cols: Col[] = []
    for (let i = 0; i < width; i++) {
      const verdicts: Verdict[] = []
      for (const row of rows) verdicts.push(await this.expr(row[i], EMPTY, ctx, false))
      const bad = verdicts.find((v) => v.nullable)
      cols.push({
        name: `column${i + 1}`,
        nullable: !!bad,
        ...(bad ? { reason: bad.reason } : {}),
        ...(verdicts.every((v) => v.builtin) ? { builtin: true } : {}),
      })
    }
    return cols
  }

  private async simple(stmt: Node, ctx: Ctx): Promise<Col[]> {
    let scope = EMPTY
    for (const item of stmt.fromClause ?? [])
      scope = concat(scope, await this.fromItem(item, ctx, scope))

    // Only grouping sets change what a bare grouped column can be. Plain GROUP BY, DISTINCT, WHERE, HAVING,
    // ORDER BY and LIMIT never turn a column's NULLs into non-NULLs or the reverse.
    const groupingSets = (stmt.groupClause ?? []).some((n: Node) => n.GroupingSet)
    const out: Col[] = []
    for (const target of stmt.targetList ?? []) {
      const rt = target.ResTarget
      const fields: Node[] | undefined = rt.val?.ColumnRef?.fields
      if (fields && fields[fields.length - 1]?.A_Star) {
        for (const c of this.star(fields, scope)) {
          out.push(
            groupingSets && !c.nullable ? { ...c, nullable: true, reason: GROUPING_REASON } : c
          )
        }
        continue
      }
      const verdict = await this.expr(rt.val, scope, ctx, groupingSets)
      out.push({ name: rt.name || figureColname(rt.val), ...verdict })
    }
    return out
  }

  private star(fields: Node[], scope: Scope): Col[] {
    if (fields.length === 1) {
      if (scope.open) throw new Unsupported('cannot expand * over a relation with unknown columns')
      return scope.visible
    }
    const names = strings(fields.slice(0, -1))
    const rel = this.findRel(scope, names)
    if (!rel?.cols) throw new Unsupported(`cannot expand ${names.join('.')}.*`)
    return rel.cols
  }

  // ---- FROM -----------------------------------------------------------------------------------------------------

  private async fromItem(node: Node, ctx: Ctx, acc: Scope): Promise<Scope> {
    if (node.RangeVar) return this.rangeVar(node.RangeVar, ctx)
    if (node.RangeTableSample)
      return this.fromItem({ RangeVar: node.RangeTableSample.relation?.RangeVar }, ctx, acc)
    if (node.JoinExpr) return this.joinExpr(node.JoinExpr, ctx, acc)
    if (node.RangeSubselect) {
      const rs = node.RangeSubselect
      const alias: string = rs.alias?.aliasname ?? ''
      const sub = rs.subquery?.SelectStmt
      if (!sub) return this.single(alias, null)
      const subCtx = rs.lateral ? { ...ctx, outer: [acc, ...ctx.outer] } : ctx
      const cols = await this.select(sub, subCtx)
      return this.single(alias, rename(cols, strings(rs.alias?.colnames)))
    }
    if (node.RangeFunction) {
      const rf = node.RangeFunction
      const first = rf.functions?.[0]?.List?.items?.[0]?.FuncCall
      const alias: string = rf.alias?.aliasname ?? strings(first?.funcname).pop() ?? ''
      const names = strings(rf.alias?.colnames)
      const defined = (rf.coldeflist ?? []).map((n: Node) => n.ColumnDef?.colname ?? '')
      const columns = names.length ? names : defined
      // Lateral and set-returning functions: whatever they return is nullable.
      return this.single(
        alias,
        columns.length
          ? columns.map((name: string) => ({
              name,
              nullable: true,
              reason: 'column of a function in FROM',
            }))
          : null
      )
    }
    return this.single(node[Object.keys(node)[0]]?.alias?.aliasname ?? '', null)
  }

  private single(alias: string, cols: Col[] | null, schema?: string): Scope {
    return { rels: [{ alias, schema, cols }], visible: cols ?? [], open: cols === null }
  }

  private async rangeVar(rv: Node, ctx: Ctx): Promise<Scope> {
    const relname: string = rv.relname
    const alias: string | undefined = rv.alias?.aliasname || undefined
    const schemaName: string | undefined = rv.schemaname || undefined
    const colAliases = strings(rv.alias?.colnames)

    let cols: Col[] | null = null
    let schema = schemaName
    const cte = schemaName ? undefined : ctx.ctes.get(relname)
    if (cte) {
      cols = await this.cte(cte).catch((e) => {
        if (e instanceof Unsupported) return null
        throw e
      })
    } else {
      const found = this.findRelation(schemaName, relname)
      if (found) {
        schema = found.schema
        cols = await this.relationCols(found, ctx)
      }
    }
    return this.single(
      alias ?? relname,
      cols && rename(cols, colAliases),
      alias ? undefined : schema
    )
  }

  private findRelation(schema: string | undefined, name: string): CatalogRelation | undefined {
    if (schema) return this.catalog.lookup(schema, name)
    for (const candidate of this.catalog.searchPath) {
      const found = this.catalog.lookup(candidate, name)
      if (found) return found
    }
    return undefined
  }

  private async relationCols(rel: CatalogRelation, ctx: Ctx): Promise<Col[]> {
    const key = `${rel.schema}.${rel.name}`
    switch (rel.kind) {
      case 'table':
        return rel.columns.map((c) => ({
          name: c.name,
          nullable: !c.notNull,
          ...(c.notNull ? {} : { reason: 'nullable column' }),
          source: { schema: rel.schema, relation: rel.name, column: c.name },
          ...(inPgCatalog(c.type) ? { builtin: true } : {}),
        }))
      case 'view': {
        if (ctx.viewStack.includes(key)) return this.opaque(rel, `view ${key} is part of a cycle`)
        const traced = Array.isArray(rel.traced) ? rel.traced : rel.traced?.columns
        if (traced && traced.length === rel.columns.length) {
          return rel.columns.map((c, i) => ({
            name: c.name,
            nullable: traced[i].nullable,
            ...(traced[i].nullable
              ? { reason: traced[i].reason ?? 'nullable in the traced view' }
              : {}),
            ...(traced[i].source ? { source: traced[i].source } : {}),
            ...(inPgCatalog(c.type) ? { builtin: true } : {}),
          }))
        }
        if (rel.definition === undefined) return this.opaque(rel, `view ${key} has no definition`)
        let pending = this.views.get(key)
        if (!pending) {
          pending = this.traceView(rel, key, ctx)
          this.views.set(key, pending)
        }
        return pending
      }
      default:
        return this.opaque(rel, `${key} is not a table or view`)
    }
  }

  private opaque(rel: CatalogRelation, reason: string): Col[] {
    return rel.columns.map((c) => ({
      name: c.name,
      nullable: true,
      reason,
      ...(inPgCatalog(c.type) ? { builtin: true } : {}),
    }))
  }

  private async traceView(rel: CatalogRelation, key: string, ctx: Ctx): Promise<Col[]> {
    try {
      const cols = await this.statement(rel.definition as string, {
        ctes: new Map(),
        outer: [],
        params: [],
        viewStack: [...ctx.viewStack, key],
      })
      if (cols.length !== rel.columns.length) {
        throw new Unsupported(
          `the definition returns ${cols.length} columns, the catalog lists ${rel.columns.length}`
        )
      }
      // the catalog's declared type of the view column, not the traced expression's
      return rel.columns.map((c, i) =>
        withBuiltin({ ...cols[i], name: c.name }, inPgCatalog(c.type))
      )
    } catch (e) {
      if (e instanceof Unsupported)
        return this.opaque(rel, `view ${key} could not be traced: ${e.message}`)
      throw e
    }
  }

  // ---- WITH -----------------------------------------------------------------------------------------------------

  private withClause(wc: Node, ctx: Ctx): Map<string, CteEntry> {
    const map = new Map(ctx.ctes)
    for (const node of wc.ctes ?? []) {
      const cte = node.CommonTableExpr
      map.set(cte.ctename, {
        name: cte.ctename,
        aliasNames: strings(cte.aliascolnames),
        query: cte.ctequery,
        recursive: !!wc.recursive,
        // A CTE sees the ones before it. Lookups of its own name are handled in `cte`.
        ctx: { ...ctx, ctes: new Map(map), outer: [] },
      })
    }
    return map
  }

  private cte(entry: CteEntry): Promise<Col[]> {
    entry.cols ??= this.traceCte(entry)
    return entry.cols
  }

  private async traceCte(entry: CteEntry): Promise<Col[]> {
    const query = entry.query?.SelectStmt
    if (!query) throw new Unsupported(`CTE ${entry.name} is not a SELECT`)
    let ctx = entry.ctx
    if (entry.recursive && query.larg) {
      // The self reference is nullable everywhere, so a UNION arm that reads it cannot prove anything about it.
      const seed = rename(await this.select(query.larg, ctx), entry.aliasNames)
      const placeholder: Col[] = seed.map((c) => ({
        name: c.name,
        nullable: true,
        reason: 'recursive CTE reference',
      }))
      const self: CteEntry = { ...entry, cols: Promise.resolve(placeholder) }
      ctx = { ...ctx, ctes: new Map(ctx.ctes).set(entry.name, self) }
    }
    return rename(await this.select(query, ctx), entry.aliasNames)
  }

  // ---- joins ----------------------------------------------------------------------------------------------------

  private async joinExpr(join: Node, ctx: Ctx, acc: Scope): Promise<Scope> {
    let left = await this.fromItem(join.larg, ctx, acc)
    let right = await this.fromItem(join.rarg, ctx, concat(acc, left))
    const type: string = join.jointype ?? 'JOIN_INNER'
    if (type === 'JOIN_LEFT' || type === 'JOIN_FULL')
      right = nullify(right, `nullable side of a ${type.slice(5)} JOIN`)
    if (type === 'JOIN_RIGHT' || type === 'JOIN_FULL')
      left = nullify(left, `nullable side of a ${type.slice(5)} JOIN`)

    let using: string[] = strings(join.usingClause)
    if (join.isNatural) {
      if (left.open || right.open)
        throw new Unsupported('NATURAL JOIN over a relation with unknown columns')
      const rightNames = new Set(right.visible.map((c) => c.name))
      using = left.visible.map((c) => c.name).filter((n) => rightNames.has(n))
    }

    // USING / NATURAL merge each shared column into one: the left value, the right one for a RIGHT JOIN, and
    // COALESCE of both (never provably non-null here) for a FULL JOIN.
    const merged: Col[] = using.map((name) => {
      const l = left.visible.find((c) => c.name === name)
      const r = right.visible.find((c) => c.name === name)
      if (type === 'JOIN_FULL')
        return { name, nullable: true, reason: 'merged column of a FULL JOIN' }
      return (
        (type === 'JOIN_RIGHT' ? r : l) ?? {
          name,
          nullable: true,
          reason: 'unresolved USING column',
        }
      )
    })
    const usingSet = new Set(using)
    let result: Scope = {
      rels: [...left.rels, ...right.rels],
      visible: [
        ...merged,
        ...left.visible.filter((c) => !usingSet.has(c.name)),
        ...right.visible.filter((c) => !usingSet.has(c.name)),
      ],
      open: left.open || right.open,
    }
    if (join.alias?.aliasname) {
      const cols = rename(result.visible, strings(join.alias.colnames))
      result = this.single(join.alias.aliasname, result.open ? null : cols)
    }
    return result
  }

  // ---- expressions ----------------------------------------------------------------------------------------------

  private async expr(node: Node, scope: Scope, ctx: Ctx, groupingSets: boolean): Promise<Verdict> {
    const kind = Object.keys(node ?? {})[0]
    const n = node?.[kind]
    switch (kind) {
      case 'ColumnRef': {
        const verdict = this.columnRef(n, scope, ctx)
        return groupingSets && !verdict.nullable
          ? { ...verdict, nullable: true, reason: GROUPING_REASON }
          : verdict
      }
      case 'A_Const':
        return n.isnull ? { ...nullable('NULL constant'), builtin: true } : NON_NULL_BUILTIN
      case 'TypeCast': {
        const target = isBuiltinType(n.typeName)
        // A literal is parsed by the target type's input function, which never yields NULL.
        if (n.arg?.A_Const && !n.arg.A_Const.isnull) return target ? NON_NULL_BUILTIN : NON_NULL
        const inner = await this.expr(n.arg, scope, ctx, groupingSets)
        // The cast replaces the value, so the inner provenance is dropped.
        if (inner.nullable) {
          const verdict = nullable(inner.reason ?? 'cast of a nullable expression')
          return target ? { ...verdict, builtin: true } : verdict
        }
        // A cast between built-in types returns NULL only for NULL; one that involves another type may call a
        // user function that returns NULL for a non-null value.
        if (!target) return nullable('cast to a type that is not built in')
        return inner.builtin
          ? NON_NULL_BUILTIN
          : { ...nullable('cast of a value whose type is not known to be built in'), builtin: true }
      }
      case 'CoalesceExpr': {
        let reason = 'COALESCE without a non-null argument'
        let proven = false
        let builtin = true
        for (const arg of n.args ?? []) {
          const v = await this.expr(arg, scope, ctx, groupingSets)
          if (!v.nullable) proven = true
          else if (!proven) reason = v.reason ?? reason
          builtin &&= !!v.builtin
        }
        const type = builtin ? { builtin: true } : {}
        return proven ? { ...NON_NULL, ...type } : { ...nullable(reason), ...type }
      }
      case 'FuncCall': {
        const names = strings(n.funcname)
        const name = names[names.length - 1]
        // count never returns NULL, as an aggregate, with FILTER, or as a window function.
        if (
          name === 'count' &&
          (names.length === 1 || (names.length === 2 && names[0] === 'pg_catalog'))
        ) {
          return NON_NULL_BUILTIN
        }
        if (n.over) return nullable(`window function ${name}()`)
        const aggregate =
          n.agg_star || n.agg_distinct || n.agg_filter || n.agg_within_group || n.agg_order?.length
        return nullable(aggregate ? `aggregate ${name}()` : `function call ${name}()`)
      }
      case 'ParamRef':
        return nullable('function parameter')
      case 'SubLink':
        return nullable('subquery')
      case 'CaseExpr':
        return nullable('CASE expression')
      default:
        return nullable(`${kind ?? 'unknown'} expression is not proven non-null`)
    }
  }

  private columnRef(ref: Node, scope: Scope, ctx: Ctx): Verdict {
    const fields: string[] = (ref.fields ?? []).map((f: Node) => f.String?.sval)
    if (fields.length === 0 || fields.some((f) => typeof f !== 'string')) {
      return nullable('unsupported column reference')
    }
    for (const candidate of [scope, ...ctx.outer]) {
      const found = this.findColumn(candidate, fields)
      if (found === 'open') return nullable('column of a relation with unknown columns')
      if (found === 'ambiguous') return nullable('ambiguous column reference')
      if (found) {
        return {
          nullable: found.nullable,
          reason: found.reason,
          source: found.source,
          builtin: found.builtin,
        }
      }
      // A single name that is a range table entry is a whole-row reference.
      if (fields.length === 1 && candidate.rels.some((r) => r.alias === fields[0])) {
        return nullable('whole-row reference')
      }
    }
    const param =
      fields.length === 1
        ? ctx.params.includes(fields[0])
        : fields.length === 2 && ctx.functionName === fields[0] && ctx.params.includes(fields[1])
    return nullable(param ? 'function parameter' : 'unresolved column reference')
  }

  private findRel(scope: Scope, qualifier: string[]): Rel | undefined {
    if (qualifier.length === 1) return scope.rels.find((r) => r.alias === qualifier[0])
    if (qualifier.length === 2)
      return scope.rels.find((r) => r.alias === qualifier[1] && r.schema === qualifier[0])
    return undefined
  }

  private findColumn(scope: Scope, fields: string[]): Col | 'open' | 'ambiguous' | undefined {
    const name = fields[fields.length - 1]
    if (fields.length === 1) {
      const matches = scope.visible.filter((c) => c.name === name)
      if (matches.length === 1) return matches[0]
      if (matches.length > 1) return 'ambiguous'
      return scope.open ? 'open' : undefined
    }
    const rel = this.findRel(scope, fields.slice(0, -1))
    if (!rel) return undefined
    if (!rel.cols) return 'open'
    const matches = rel.cols.filter((c) => c.name === name)
    return matches.length === 1 ? matches[0] : matches.length > 1 ? 'ambiguous' : undefined
  }
}

const GROUPING_REASON = 'grouping column under GROUPING SETS, ROLLUP or CUBE'

function fallback(input: TraceInput, error: string): TraceResult {
  return { columns: input.columns.map(() => ({ nullable: true, reason: error })), error }
}

/** Runs one trace. Never throws for SQL it cannot handle. */
export async function runTrace(parse: ParseSql, input: TraceInput): Promise<TraceResult> {
  const run = new Run(parse, indexCatalog(input.catalog))
  try {
    const cols = await run.statement(input.sql, {
      ctes: new Map(),
      outer: [],
      params: (input.parameters ?? []).filter((p) => p !== ''),
      functionName: input.functionName,
      viewStack: [],
    })
    if (cols.length !== input.columns.length) {
      return fallback(
        input,
        `the query returns ${cols.length} columns, expected ${input.columns.length}`
      )
    }
    return { columns: cols.map(toTraced) }
  } catch (e) {
    return fallback(
      input,
      e instanceof Unsupported ? e.message : `internal error: ${(e as Error).message}`
    )
  }
}

function toTraced(c: Col): TracedColumn {
  return {
    nullable: c.nullable,
    ...(c.source ? { source: c.source } : {}),
    ...(c.nullable ? { reason: c.reason ?? 'not proven non-null' } : {}),
  }
}
