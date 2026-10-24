import { parseSync, visitorKeys } from 'oxc-parser'
import { enterScope, isNode, Scope, type Node } from './ast'
import {
  COLUMN_METHOD_SET,
  FALLBACK_PAIR_LIMIT,
  MATCH_METHOD_SET,
  MUTATION_METHODS,
  NOT_A_CLIENT,
  OPTIONS_ARG_INDEX,
  REFERENCED_TABLE_METHOD_SET,
  type ReferencedTableMethod,
} from './methods'
import {
  isUndefinedLiteral,
  objectKeys,
  objectProperty,
  resolveBoolean,
  resolveStrings,
  unwrapReceiver,
} from './resolve'
import type {
  FallbackPair,
  FileScan,
  FunctionTarget,
  OperandRequest,
  PlanTarget,
  RelationTarget,
  RpcMethod,
  ScanOptions,
  ScanResult,
  SchemaScope,
  SelectRequest,
  SourceFile,
  SourceLocation,
  UnresolvedUse,
} from './types'

// ---------------------------------------------------------------- chain state
type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'
type Root =
  | { type: 'relation'; names: string[] | undefined; method: HttpMethod }
  | { type: 'function'; names: string[] | undefined; keys: string[] | null; methods: RpcMethod[] }

/**
 * What a builder chain looks like at one point, mirroring the builder's type state: the schema (`undefined`: no
 * `.schema()` call, so the default schema; `'unresolved'`: a `.schema()` whose argument does not resolve, so any exposed
 * schema), what `.from()` / `.rpc()` named, and the select the builder carries.
 */
interface Chain {
  schemas: string[] | 'unresolved' | undefined
  root: Root | undefined
  /** the current select: `['*']` until a `.select(q)`; `undefined` when it doesn't resolve */
  select: string[] | undefined
}
const EMPTY: Chain = { schemas: undefined, root: undefined, select: ['*'] }

interface NameUse {
  /** The schemas of every use (`scopeOf` of each): `'exposed'` once one of them is any exposed schema */
  schemas: Set<string> | 'exposed'
  kinds: Set<'r' | 'w'>
}

interface Unconnected {
  select: string
  location: SourceLocation
}

/** Accumulates deduplicated requests across files. */
export class Accumulator {
  readonly selects = new Map<string, SelectRequest>()
  readonly operands = new Map<string, OperandRequest>()
  readonly fallbacks = new Map<string, FallbackPair>()
  readonly unresolved = new Map<string, UnresolvedUse>()
  readonly files: FileScan[] = []
}

function mergeLocations(into: SourceLocation[], from: SourceLocation): void {
  if (!into.some((l) => l.fileName === from.fileName && l.start === from.start)) into.push(from)
}

export function compareLocations(a: SourceLocation, b: SourceLocation): number {
  return a.fileName < b.fileName
    ? -1
    : a.fileName > b.fileName
      ? 1
      : a.start - b.start || a.end - b.end
}

function scopeKey(schemas: SchemaScope): string {
  return schemas === 'exposed' ? '*' : schemas.join(',')
}

function targetKey(t: PlanTarget): string {
  return t.kind === 'f'
    ? JSON.stringify([t.kind, scopeKey(t.schemas), t.function, t.keys, t.method])
    : JSON.stringify([t.kind, scopeKey(t.schemas), t.relation])
}

export function selectRequestKey(r: SelectRequest): string {
  return JSON.stringify([targetKey(r.target), r.select])
}
export function operandRequestKey(r: OperandRequest): string {
  return JSON.stringify([targetKey(r.target), r.select, r.via, r.operand])
}

class LineIndex {
  private readonly starts: number[] = [0]
  constructor(text: string) {
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i)
      if (c === 10 || c === 0x2028 || c === 0x2029) this.starts.push(i + 1)
      else if (c === 13) {
        if (text.charCodeAt(i + 1) === 10) i++
        this.starts.push(i + 1)
      }
    }
  }
  at(offset: number): { line: number; column: number } {
    let lo = 0
    let hi = this.starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (this.starts[mid] <= offset) lo = mid
      else hi = mid - 1
    }
    return { line: lo + 1, column: offset - this.starts[lo] + 1 }
  }
}

function memberName(callee: Node): string | undefined {
  if (callee.type !== 'MemberExpression') return undefined
  const p = callee.property as Node
  if (!callee.computed) return p.type === 'Identifier' ? p.name : undefined
  return p.type === 'Literal' && typeof p.value === 'string' ? p.value : undefined
}

/** The methods an rpc call can send, over every value its `get` / `head` options can take (head wins over get). */
function rpcMethods(options: Node | undefined, scope: Scope): RpcMethod[] {
  if (!options || isUndefinedLiteral(options)) return ['POST']
  const flag = (name: string): boolean[] => {
    const p = objectProperty(options, scope, name)
    if (p === 'absent') return [false]
    if (p === 'unknown') return [true, false]
    if (isUndefinedLiteral(p.value)) return [false]
    const b = resolveBoolean(p.value, p.scope)
    return b === undefined ? [true, false] : [b]
  }
  const methods = new Set<RpcMethod>()
  for (const head of flag('head')) {
    for (const get of flag('get')) methods.add(head ? 'HEAD' : get ? 'GET' : 'POST')
  }
  return [...methods].sort()
}

type RefTable =
  | { none: true }
  | { unknown: true }
  | { unresolved: true }
  | { tables: string[]; root: boolean }

/** The `referencedTable` (or deprecated `foreignTable`) option of a call. */
function refTableOf(options: Node | undefined, scope: Scope): RefTable {
  if (!options || isUndefinedLiteral(options)) return { none: true }
  for (const name of ['referencedTable', 'foreignTable']) {
    const p = objectProperty(options, scope, name)
    if (p === 'unknown') return { unknown: true }
    if (p === 'absent' || isUndefinedLiteral(p.value)) continue
    const values = resolveStrings(p.value, p.scope)
    if (!values) return { unresolved: true }
    // the runtime prefixes only a truthy table: '' sends the filter unprefixed, to the root
    const tables = values.filter((t) => t !== '')
    if (tables.length === 0) return { none: true }
    return { tables, root: tables.length < values.length }
  }
  return { none: true }
}

// ---------------------------------------------------------------- per-file scan
export class FileScanner {
  private readonly lines: LineIndex
  private readonly memo = new WeakMap<Node, Chain | 'pending'>()
  private readonly relations = new Map<string, NameUse>()
  private readonly functions = new Map<string, NameUse>()
  private readonly unconnected: Unconnected[] = []

  constructor(
    private readonly acc: Accumulator,
    private readonly fileName: string,
    sourceText: string,
    private readonly options: ScanOptions
  ) {
    this.lines = new LineIndex(sourceText)
  }

  scan(sourceText: string): void {
    const result = parseSync(this.fileName, sourceText, { preserveParens: false })
    this.walk(result.program as unknown as Node, new Scope())
    const truncated = this.finishFallbacks()
    this.acc.files.push({
      fileName: this.fileName,
      parseErrors: result.errors.length,
      fallbackTruncated: truncated,
    })
  }

  // -------------------------------------------------------------- walking
  private walk(node: Node, parent: Scope): void {
    const scope = enterScope(node, parent)
    if (node.type === 'CallExpression') this.handleCall(node, scope)
    const keys = visitorKeys[node.type]
    if (!keys) return
    for (const key of keys) {
      const child = node[key] as unknown
      if (Array.isArray(child)) {
        for (const c of child) if (isNode(c)) this.walk(c, scope)
      } else if (isNode(child)) {
        this.walk(child, scope)
      }
    }
  }

  // -------------------------------------------------------------- locations
  private locate(start: number, end: number): SourceLocation {
    return { fileName: this.fileName, start, end, ...this.lines.at(start) }
  }
  private locateNode(node: Node): SourceLocation {
    return this.locate(node.start, node.end)
  }
  /** `.method(…)`: from the method name to the closing parenthesis */
  private locateCall(call: Node): SourceLocation {
    const callee = unwrapReceiver(call.callee as Node)
    return this.locate((callee.property as Node)?.start ?? call.start, call.end)
  }

  private unresolvedUse(what: UnresolvedUse['what'], location: SourceLocation): void {
    this.acc.unresolved.set(`${what}|${location.fileName}|${location.start}`, { what, location })
  }

  private scopeOf(schemas: string[] | 'unresolved' | undefined): SchemaScope {
    if (Array.isArray(schemas)) return [...new Set(schemas)].sort()
    const { defaultSchema, exposedSchemas } = this.options
    if (schemas === undefined && defaultSchema !== undefined) return [defaultSchema]
    return exposedSchemas ? [...new Set(exposedSchemas)].sort() : 'exposed'
  }

  // -------------------------------------------------------------- chain evaluation
  private chainOf(expr: Node, scope: Scope): Chain {
    const e = unwrapReceiver(expr)
    if (e.type === 'Identifier') {
      const b = scope.lookup(e.name)
      return b?.init && !b.annotated ? this.chainOf(b.init, b.scope) : EMPTY
    }
    if (e.type !== 'CallExpression') return EMPTY
    const cached = this.memo.get(e)
    if (cached === 'pending') return EMPTY
    if (cached) return cached
    this.memo.set(e, 'pending')
    const callee = unwrapReceiver(e.callee as Node)
    const name = memberName(callee)
    const chain = name ? this.apply(name, e, callee, scope) : EMPTY
    this.memo.set(e, chain)
    return chain
  }

  private apply(name: string, call: Node, callee: Node, scope: Scope): Chain {
    const receiver = unwrapReceiver(callee.object as Node)
    const args = call.arguments as Node[]
    if (name === 'from' && receiver.type === 'Identifier' && NOT_A_CLIENT.has(receiver.name)) {
      return EMPTY
    }
    const recv = this.chainOf(receiver, scope)
    switch (name) {
      case 'schema': {
        const schemas = args[0] ? (resolveStrings(args[0], scope) ?? 'unresolved') : undefined
        return { ...recv, schemas }
      }
      case 'from': {
        if (!args[0]) return recv
        const names = resolveStrings(args[0], scope)
        return {
          schemas: recv.schemas,
          root: { type: 'relation', names, method: 'GET' },
          select: ['*'],
        }
      }
      case 'rpc': {
        if (!args[0]) return recv
        const names = resolveStrings(args[0], scope)
        const a = args[1]
        const keys = !a || isUndefinedLiteral(a) ? [] : (objectKeys(a, scope) ?? null)
        return {
          schemas: recv.schemas,
          root: { type: 'function', names, keys, methods: rpcMethods(args[2], scope) },
          select: ['*'],
        }
      }
      case 'insert':
      case 'upsert':
      case 'update':
      case 'delete':
        return recv.root?.type === 'relation'
          ? { ...recv, root: { ...recv.root, method: MUTATION_METHODS[name] }, select: ['*'] }
          : recv
      case 'select': {
        if (!recv.root) return recv
        const a = args[0]
        const select = !a || isUndefinedLiteral(a) ? ['*'] : resolveStrings(a, scope)
        return { ...recv, select }
      }
      default:
        return recv
    }
  }

  private targets(chain: Chain): PlanTarget[] {
    const { root } = chain
    if (!root?.names) return []
    const schemas = this.scopeOf(chain.schemas)
    if (root.type === 'relation') {
      const kind = root.method === 'GET' ? 'r' : 'w'
      return root.names.map((relation): RelationTarget => ({ kind, schemas, relation }))
    }
    return root.names.flatMap((fn) =>
      root.methods.map(
        (method): FunctionTarget => ({
          kind: 'f',
          schemas,
          function: fn,
          keys: root.keys ? [...root.keys] : null,
          method,
        })
      )
    )
  }

  // -------------------------------------------------------------- recording
  private handleCall(call: Node, scope: Scope): void {
    const callee = unwrapReceiver(call.callee as Node)
    const name = memberName(callee)
    if (!name) return
    const args = call.arguments as Node[]
    const recv = () => this.chainOf(callee.object as Node, scope)
    switch (name) {
      case 'schema': {
        if (args[0] && !resolveStrings(args[0], scope)) {
          this.unresolvedUse('schema', this.locateNode(args[0]))
        }
        return
      }
      case 'from':
      case 'rpc': {
        const after = this.chainOf(call, scope)
        const root = after.root
        if (!root || (after === EMPTY && !args[0])) return
        if (!root.names) {
          this.unresolvedUse(name === 'from' ? 'relation' : 'function', this.locateNode(args[0]))
          return
        }
        for (const n of root.names) this.useName(root.type, n, after.schemas)
        if (root.type === 'function') {
          const at = this.locateCall(call)
          for (const target of this.targets(after)) this.addSelect(target, '*', at)
        }
        return
      }
      case 'insert':
      case 'upsert':
      case 'update':
      case 'delete': {
        const root = recv().root
        if (root?.type === 'relation' && root.names) {
          for (const n of root.names) this.useName('relation', n, recv().schemas, 'w')
        }
        return
      }
      case 'select':
        return this.recordSelect(call, args, recv(), scope)
      default:
        if (
          COLUMN_METHOD_SET.has(name) ||
          MATCH_METHOD_SET.has(name) ||
          REFERENCED_TABLE_METHOD_SET.has(name)
        ) {
          this.recordOperands(name, args, recv(), scope)
        }
    }
  }

  private useName(
    type: 'relation' | 'function',
    name: string,
    schemas: string[] | 'unresolved' | undefined,
    kind: 'r' | 'w' = 'r'
  ): void {
    const map = type === 'relation' ? this.relations : this.functions
    let use = map.get(name)
    if (!use) {
      use = { schemas: new Set(), kinds: new Set() }
      map.set(name, use)
    }
    if (type === 'relation') use.kinds.add(kind)
    const scope = this.scopeOf(schemas)
    if (scope === 'exposed') use.schemas = 'exposed'
    else if (use.schemas !== 'exposed') for (const s of scope) use.schemas.add(s)
  }

  private addSelect(target: PlanTarget, select: string, location: SourceLocation): void {
    const request: SelectRequest = { target, select, locations: [] }
    const key = selectRequestKey(request)
    const existing = this.acc.selects.get(key) ?? request
    this.acc.selects.set(key, existing)
    mergeLocations(existing.locations, location)
  }

  private addOperand(
    target: PlanTarget,
    select: string,
    operand: string,
    via: OperandRequest['via'],
    location: SourceLocation
  ): void {
    const request: OperandRequest = { target, select, operand, via, locations: [] }
    const key = operandRequestKey(request)
    const existing = this.acc.operands.get(key) ?? request
    this.acc.operands.set(key, existing)
    mergeLocations(existing.locations, location)
  }

  private recordSelect(call: Node, args: Node[], recv: Chain, scope: Scope): void {
    const arg = args[0]
    const bare = !arg || isUndefinedLiteral(arg)
    const values = bare ? ['*'] : resolveStrings(arg, scope)
    const at = bare ? this.locateCall(call) : this.locateNode(arg)
    const root = recv.root
    if (root?.names) {
      if (!values) return this.unresolvedUse('select', at)
      for (const target of this.targets(recv)) {
        for (const select of values) this.addSelect(target, select, at)
      }
    } else if (!values) {
      if (root) this.unresolvedUse('select', at)
    } else {
      for (const select of values) {
        if (select !== '*') this.unconnected.push({ select, location: at })
      }
    }
  }

  private recordOperands(name: string, args: Node[], recv: Chain, scope: Scope): void {
    const targets = this.targets(recv)
    if (targets.length === 0 || !recv.select) return
    const candidates: { operand: string; via: OperandRequest['via']; at: SourceLocation }[] = []

    let ref: RefTable = { none: true }
    if (REFERENCED_TABLE_METHOD_SET.has(name)) {
      ref = refTableOf(args[OPTIONS_ARG_INDEX[name as ReferencedTableMethod]], scope)
      if ('tables' in ref) {
        const at = this.locateNode(args[OPTIONS_ARG_INDEX[name as ReferencedTableMethod]])
        for (const t of ref.tables)
          candidates.push({ operand: `@${t}`, via: 'referencedTable', at })
      }
    }
    // with a referencedTable the column belongs to the embed; unknown options might hold one, so the column stays
    const columnIsRoot = 'tables' in ref ? ref.root : !('unresolved' in ref)
    if (COLUMN_METHOD_SET.has(name) && columnIsRoot && args[0]) {
      const columns = resolveStrings(args[0], scope)
      const at = this.locateNode(args[0])
      const via = name === 'order' ? 'order' : 'column'
      for (const c of columns ?? []) candidates.push({ operand: c, via, at })
    } else if (MATCH_METHOD_SET.has(name) && args[0]) {
      const at = this.locateNode(args[0])
      for (const c of objectKeys(args[0], scope) ?? []) {
        candidates.push({ operand: c, via: 'column', at })
      }
    }

    for (const target of targets) {
      for (const select of recv.select) {
        for (const c of candidates) this.addOperand(target, select, c.operand, c.via, c.at)
      }
    }
  }

  // -------------------------------------------------------------- per-file fallback
  /** Pairs every unconnected select with every relation and function the file names, at most 64. */
  private finishFallbacks(): boolean {
    const selects = new Map<string, SourceLocation[]>()
    for (const u of this.unconnected) {
      const locs = selects.get(u.select) ?? []
      selects.set(u.select, locs)
      mergeLocations(locs, u.location)
    }
    const targets: FallbackPair['target'][] = [
      ...[...this.relations.keys()].sort().map((name) => ({
        kind: 'relation' as const,
        name,
        kinds: [...this.relations.get(name)!.kinds].sort(),
      })),
      ...[...this.functions.keys()].sort().map((name) => ({ kind: 'function' as const, name })),
    ]
    let count = 0
    let truncated = false
    for (const select of [...selects.keys()].sort()) {
      for (const target of targets) {
        if (count === FALLBACK_PAIR_LIMIT) {
          truncated = true
          continue
        }
        count++
        const use = (target.kind === 'relation' ? this.relations : this.functions).get(target.name)!
        const pair: FallbackPair = {
          select,
          target,
          schemas: use.schemas === 'exposed' ? 'exposed' : [...use.schemas].sort(),
          locations: [],
        }
        const key = JSON.stringify([
          select,
          target.kind,
          target.name,
          target.kind === 'relation' ? target.kinds : null,
          scopeKey(pair.schemas),
        ])
        const existing = this.acc.fallbacks.get(key) ?? pair
        this.acc.fallbacks.set(key, existing)
        for (const l of selects.get(select)!) mergeLocations(existing.locations, l)
      }
    }
    return truncated
  }
}

// ---------------------------------------------------------------- entry points
function byKey<T>(items: Iterable<T>, key: (item: T) => string): T[] {
  return [...items].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
}

function finish(acc: Accumulator): ScanResult {
  const sortLocations = <T extends { locations: SourceLocation[] }>(items: T[]): T[] => {
    for (const item of items) item.locations.sort(compareLocations)
    return items
  }
  return {
    selects: sortLocations(byKey(acc.selects.values(), selectRequestKey)),
    operands: sortLocations(byKey(acc.operands.values(), operandRequestKey)),
    fallbacks: sortLocations(
      byKey(acc.fallbacks.values(), (f) => JSON.stringify([f.select, f.target, f.schemas]))
    ),
    unresolved: [...acc.unresolved.values()].sort(
      (a, b) => compareLocations(a.location, b.location) || (a.what < b.what ? -1 : 1)
    ),
    files: [...acc.files].sort((a, b) => (a.fileName < b.fileName ? -1 : 1)),
  }
}

function scanInto(acc: Accumulator, file: SourceFile, options: ScanOptions): void {
  new FileScanner(acc, file.fileName, file.sourceText, options).scan(file.sourceText)
}

/** Scans one file. Syntax only: nothing is read from disk and nothing is type-checked. */
export function scanSource(
  fileName: string,
  sourceText: string,
  options: ScanOptions = {}
): ScanResult {
  const acc = new Accumulator()
  scanInto(acc, { fileName, sourceText }, options)
  return finish(acc)
}

/**
 * Scans several files into one deduplicated result. The result is independent of the order of `files`; a request
 * found in several files lists every location.
 */
export function scanFiles(files: Iterable<SourceFile>, options: ScanOptions = {}): ScanResult {
  const acc = new Accumulator()
  for (const file of files) scanInto(acc, file, options)
  return finish(acc)
}
