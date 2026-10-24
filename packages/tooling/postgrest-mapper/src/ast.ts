// Minimal ESTree / TS-ESTree view of oxc-parser's AST, plus the lexical scopes the resolvers need.

/** An AST node. oxc-parser's node types are a large union; the scanner reads a handful of fields by name. */
export interface Node {
  type: string
  start: number
  end: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface Binding {
  /** the initializer of `const name = init`; absent for every other kind of binding */
  init?: Node
  /** declared with an explicit type annotation: the literal type is gone */
  annotated: boolean
  /** the scope the initializer is evaluated in */
  scope: Scope
}

export class Scope {
  readonly bindings = new Map<string, Binding>()
  constructor(readonly parent?: Scope) {}

  lookup(name: string): Binding | undefined {
    return this.bindings.get(name) ?? this.parent?.lookup(name)
  }

  declare(name: string, init?: Node, annotated = false): void {
    this.bindings.set(name, { init, annotated, scope: this })
  }
}

export function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && typeof (value as Node).type === 'string'
}

function declarePattern(scope: Scope, pattern: Node | null | undefined): void {
  if (!pattern) return
  switch (pattern.type) {
    case 'Identifier':
      scope.declare(pattern.name)
      break
    case 'ObjectPattern':
      for (const p of pattern.properties as Node[]) {
        declarePattern(scope, p.type === 'RestElement' ? p.argument : p.value)
      }
      break
    case 'ArrayPattern':
      for (const e of pattern.elements as (Node | null)[]) declarePattern(scope, e)
      break
    case 'AssignmentPattern':
      declarePattern(scope, pattern.left)
      break
    case 'RestElement':
      declarePattern(scope, pattern.argument)
      break
    case 'TSParameterProperty':
      declarePattern(scope, pattern.parameter)
      break
  }
}

/** Declares what the statements bind in `scope` itself (lexical declarations, functions, classes, imports). */
export function declareStatements(scope: Scope, statements: readonly Node[]): void {
  for (const raw of statements) {
    const stmt =
      (raw.type === 'ExportNamedDeclaration' || raw.type === 'ExportDefaultDeclaration') &&
      raw.declaration
        ? (raw.declaration as Node)
        : raw
    switch (stmt.type) {
      case 'VariableDeclaration':
        for (const d of stmt.declarations as Node[]) {
          const id = d.id as Node
          if (stmt.kind === 'const' && id.type === 'Identifier' && d.init) {
            scope.declare(id.name, d.init as Node, id.typeAnnotation != null)
          } else {
            declarePattern(scope, id)
          }
        }
        break
      case 'FunctionDeclaration':
      case 'ClassDeclaration':
      case 'TSEnumDeclaration':
      case 'TSImportEqualsDeclaration':
        if (stmt.id?.type === 'Identifier') scope.declare(stmt.id.name)
        break
      case 'TSModuleDeclaration':
        if (stmt.id?.type === 'Identifier') scope.declare(stmt.id.name)
        break
      case 'ImportDeclaration':
        for (const s of (stmt.specifiers ?? []) as Node[]) {
          if (s.local?.type === 'Identifier') scope.declare(s.local.name)
        }
        break
    }
  }
}

/** The scope `node`'s children live in: a new one for scope-creating nodes, `parent` otherwise. */
export function enterScope(node: Node, parent: Scope): Scope {
  switch (node.type) {
    case 'Program': {
      const s = new Scope(parent)
      declareStatements(s, node.body)
      return s
    }
    case 'BlockStatement':
    case 'StaticBlock':
    case 'TSModuleBlock': {
      const s = new Scope(parent)
      declareStatements(s, node.body)
      return s
    }
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
    case 'TSDeclareFunction': {
      const s = new Scope(parent)
      for (const p of node.params as Node[]) declarePattern(s, p)
      if (node.type === 'FunctionExpression' && node.id?.type === 'Identifier') {
        s.declare(node.id.name)
      }
      return s
    }
    case 'ForStatement': {
      const s = new Scope(parent)
      if (node.init?.type === 'VariableDeclaration') declareStatements(s, [node.init])
      return s
    }
    case 'ForInStatement':
    case 'ForOfStatement': {
      const s = new Scope(parent)
      if (node.left?.type === 'VariableDeclaration') {
        for (const d of node.left.declarations as Node[]) declarePattern(s, d.id)
      }
      return s
    }
    case 'CatchClause': {
      const s = new Scope(parent)
      declarePattern(s, node.param)
      return s
    }
    case 'SwitchStatement': {
      const s = new Scope(parent)
      declareStatements(
        s,
        (node.cases as Node[]).flatMap((c) => c.consequent as Node[])
      )
      return s
    }
    default:
      return parent
  }
}
