import fs = require('node:fs')
import path = require('node:path')
import ts = require('typescript')
import { COLUMN_METHODS, MATCH_METHODS, REFERENCED_TABLE_METHODS } from '../src'

/**
 * The scanner lists the builder methods whose arguments name columns. This reads the builders' own source (nothing in
 * postgrest-js is edited for it) and fails when a method starts taking a column and the scanner doesn't know it, or
 * the scanner lists a method the builders no longer have. A method's implementation signature is the last declaration
 * of its name; it names its first parameter `column` when it takes one.
 */
const src = path.resolve(__dirname, '../../../core/postgrest-js/src')

/** method name -> name of the first parameter of its implementation signature */
function firstParameters(file: string, className: string): Map<string, string> {
  const text = fs.readFileSync(path.join(src, file), 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const methods = new Map<string, string>()
  source.forEachChild((node) => {
    if (!ts.isClassDeclaration(node) || node.name?.text !== className) return
    for (const m of node.members) {
      if (ts.isMethodDeclaration(m) && ts.isIdentifier(m.name) && m.body) {
        const first = m.parameters[0]
        methods.set(m.name.text, first && ts.isIdentifier(first.name) ? first.name.text : '')
      }
    }
  })
  return methods
}

describe('builder drift', () => {
  const methods = new Map([
    ...firstParameters('PostgrestTransformBuilder.ts', 'PostgrestTransformBuilder'),
    ...firstParameters('PostgrestFilterBuilder.ts', 'PostgrestFilterBuilder'),
  ])

  it('finds the builders', () => {
    expect(methods.size).toBeGreaterThan(40)
    expect(methods.has('eq')).toBe(true)
    expect(methods.has('select')).toBe(true)
  })

  it('lists exactly the builder methods that take a column', () => {
    const taking = [...methods].filter(([, p]) => p === 'column').map(([name]) => name)
    expect([...COLUMN_METHODS].sort()).toEqual(taking.sort())
  })

  it('lists exactly the builder methods that take a query object of columns', () => {
    const taking = [...methods].filter(([, p]) => p === 'query').map(([name]) => name)
    expect([...MATCH_METHODS].sort()).toEqual(taking.sort())
  })

  it('lists only methods the builders have for referencedTable', () => {
    expect(REFERENCED_TABLE_METHODS.filter((m) => !methods.has(m))).toEqual([])
  })
})
