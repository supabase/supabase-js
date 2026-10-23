import { MAX_RESOLVED_VALUES } from './methods'
import { type Binding, type Node, type Scope } from './ast'

/** TS wrappers that keep a value's literal type (or don't matter for a receiver). */
function unwrapOnce(node: Node, receiver: boolean): Node | undefined {
  switch (node.type) {
    case 'ParenthesizedExpression':
    case 'ChainExpression':
    case 'TSNonNullExpression':
    case 'TSSatisfiesExpression':
      return node.expression
    case 'TSAsExpression':
    case 'TSTypeAssertion': {
      const t = node.typeAnnotation as Node
      const isConst = t.type === 'TSTypeReference' && t.typeName?.name === 'const'
      return receiver || isConst ? node.expression : undefined
    }
    default:
      return undefined
  }
}

/** `(x as Foo)!`, `x?.y`, `(x)`: the expression a chain receiver really is. */
export function unwrapReceiver(node: Node): Node {
  for (let next = unwrapOnce(node, true); next; next = unwrapOnce(node, true)) node = next
  return node
}

/** Parentheses, `as const`, `satisfies`, `!`: wrappers that leave a value's literal type alone. */
export function unwrapValue(node: Node): Node {
  for (let next = unwrapOnce(node, false); next; next = unwrapOnce(node, false)) node = next
  return node
}

/** The `const` binding an identifier refers to, when its initializer still carries a literal type. */
function constBinding(node: Node, scope: Scope): Binding | undefined {
  if (node.type !== 'Identifier') return undefined
  const b = scope.lookup(node.name)
  return b?.init && !b.annotated ? b : undefined
}

/** The initializer behind a chain of unannotated `const` identifiers, with the scope it is evaluated in. */
export function followConst(node: Node, scope: Scope): { node: Node; scope: Scope } {
  const seen = new Set<Binding>()
  for (;;) {
    node = unwrapValue(node)
    const b = constBinding(node, scope)
    if (!b || seen.has(b)) return { node, scope }
    seen.add(b)
    node = b.init as Node
    scope = b.scope
  }
}

function union(parts: string[][]): string[] | undefined {
  const out = new Set<string>()
  for (const p of parts) for (const v of p) out.add(v)
  return out.size > MAX_RESOLVED_VALUES ? undefined : [...out]
}

/**
 * The finite set of strings an expression can evaluate to (v5 §4.2), or `undefined` when unresolved:
 * string literals and template literals without substitutions (the parser cooks them as ECMAScript does, so the value
 * equals the literal type TypeScript infers), unannotated same-file `const` identifiers, conditionals whose branches
 * both resolve, and `as const` / `satisfies` / parenthesised forms of those.
 */
export function resolveStrings(node: Node, scope: Scope): string[] | undefined {
  const { node: n, scope: s } = followConst(node, scope)
  switch (n.type) {
    case 'Literal':
      return typeof n.value === 'string' ? [n.value] : undefined
    case 'TemplateLiteral': {
      if ((n.expressions as Node[]).length > 0) return undefined
      const cooked = n.quasis[0]?.value?.cooked
      return typeof cooked === 'string' ? [cooked] : undefined
    }
    case 'ConditionalExpression': {
      const a = resolveStrings(n.consequent, s)
      const b = a && resolveStrings(n.alternate, s)
      return a && b ? union([a, b]) : undefined
    }
    default:
      return undefined
  }
}

/** `true` / `false` for a literal (or unannotated const) boolean, `undefined` when unknown. */
export function resolveBoolean(node: Node, scope: Scope): boolean | undefined {
  const { node: n } = followConst(node, scope)
  return n.type === 'Literal' && typeof n.value === 'boolean' ? n.value : undefined
}

export function isUndefinedLiteral(node: Node): boolean {
  const n = unwrapValue(node)
  return n.type === 'Identifier' && n.name === 'undefined'
}

/** A property's key as a string, `undefined` for computed keys that don't resolve to exactly one string. */
export function propertyKey(prop: Node, scope: Scope): string | undefined {
  const key = prop.key as Node
  if (prop.computed) {
    const values = resolveStrings(key, scope)
    return values?.length === 1 ? values[0] : undefined
  }
  if (key.type === 'Identifier') return key.name
  if (key.type === 'Literal') return String(key.value)
  return undefined
}

/**
 * The keys of an object literal (following an unannotated `const`), sorted and unique. `undefined` when the object has
 * a spread, a computed key that doesn't resolve, or isn't an object literal at all.
 */
export function objectKeys(node: Node, scope: Scope): string[] | undefined {
  const { node: n, scope: s } = followConst(node, scope)
  if (n.type !== 'ObjectExpression') return undefined
  const keys = new Set<string>()
  for (const p of n.properties as Node[]) {
    if (p.type !== 'Property') return undefined
    const k = propertyKey(p, s)
    if (k === undefined) return undefined
    keys.add(k)
  }
  return [...keys].sort()
}

/** An object literal's property by key (the last one wins, as at run time); `'unknown'` if the object isn't plain. */
export function objectProperty(
  node: Node,
  scope: Scope,
  name: string
): { value: Node; scope: Scope } | 'absent' | 'unknown' {
  const { node: n, scope: s } = followConst(node, scope)
  if (n.type !== 'ObjectExpression') return 'unknown'
  let found: { value: Node; scope: Scope } | undefined
  for (const p of n.properties as Node[]) {
    if (p.type !== 'Property') return 'unknown'
    const k = propertyKey(p, s)
    if (k === undefined) return 'unknown'
    if (k === name) found = { value: p.value as Node, scope: s }
  }
  return found ?? 'absent'
}
