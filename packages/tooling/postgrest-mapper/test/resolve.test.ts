import { parseSync } from 'oxc-parser'
import { enterScope, Scope, type Node } from '../src/ast'
import { resolveStrings } from '../src/resolve'

/** Resolves the initializer of the last top-level `const` in `source`. */
function resolveLast(source: string): string[] | undefined {
  const program = parseSync('a.ts', source, { preserveParens: false }).program as unknown as Node
  const scope = enterScope(program, new Scope())
  const decl = [...program.body].reverse().find((s: Node) => s.type === 'VariableDeclaration')
  return resolveStrings(decl.declarations[0].init, scope)
}

describe('resolveStrings', () => {
  it('leaves a cyclic conditional const unresolved', () => {
    expect(resolveLast(`const columns = flag ? 'id' : columns`)).toBeUndefined()
    expect(resolveLast(`const columns = flag ? columns : 'id'`)).toBeUndefined()
  })

  it('leaves self and mutual references unresolved', () => {
    expect(resolveLast(`const a = a`)).toBeUndefined()
    expect(resolveLast(`const a = b; const b = a`)).toBeUndefined()
  })

  it('resolves a diamond over one binding', () => {
    expect(resolveLast(`const q = 'id'; const c = flag ? q : q`)).toEqual(['id'])
  })
})
