import fs = require('node:fs')
import path = require('node:path')
import ts = require('typescript')
import { normalizeSelect, planKeysOf, planRequestOf, scanSource } from '../src'

const keysOf = (source: string, exposedSchemas?: string[]) =>
  planKeysOf(scanSource('a.ts', source, exposedSchemas ? { exposedSchemas } : {})).map((k) => k.key)

/** The client's own function, compiled from its source (the mapper has no dependency on the client package). */
function loadClientNormalizeSelect(): (select: string) => string {
  const file = path.resolve(__dirname, '../../../core/postgrest-js/src/normalizeSelect.ts')
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const mod: { exports: { normalizeSelect?: (select: string) => string } } = { exports: {} }
  new Function('module', 'exports', outputText)(mod, mod.exports)
  return mod.exports.normalizeSelect!
}
const clientNormalizeSelect = loadClientNormalizeSelect()

describe('normalizeSelect', () => {
  const inputs = [
    '*',
    'id, name',
    ' id ,\n  name\t',
    'a:b, "col umn", c',
    'id, "a ""b"" c", d',
    'id,\n  messages (id,\n    channels(id) )',
    '"unterminated, quote',
    '',
  ]

  it.each(inputs)('agrees with the postgrest-js function on %j', (select) => {
    expect(normalizeSelect(select)).toBe(clientNormalizeSelect(select))
  })

  it('removes whitespace outside double quotes only', () => {
    expect(normalizeSelect('id,  "a b" ,\n c')).toBe('id,"a b",c')
  })
})

describe('plan keys', () => {
  it('derives one key per kind, schema, relation and select as written, sorted and deduplicated', () => {
    const keys = keysOf(
      `
      supabase.from('users').select('username,  status')
      supabase.from('users').select('username,  status')
      supabase.from('users').select('username,status')
      supabase.schema('other').from('users').select('username')
      supabase.from('users').update({ a: 1 }).select('username')
      `,
      ['public']
    )
    expect(keys).toEqual([
      'r|other|users|username',
      'r|public|users|username,  status',
      'r|public|users|username,status',
      'w|public|users|username',
    ])
  })

  it('leaves out bare stars, rpc calls and unresolved schemas', () => {
    const keys = keysOf(
      `
      supabase.from('users').select('*')
      supabase.from('users').select()
      supabase.rpc('f', { a: 1 }).select('id')
      supabase.from('users').select('username')
      `
    )
    expect(keys).toEqual([])
  })

  it('plans a chain in every candidate schema and marks the ones it only guesses', () => {
    const scan = scanSource('a.ts', `supabase.from('users').select('username')`, {
      exposedSchemas: ['personal', 'public'],
    })
    const keys = planKeysOf(scan)
    expect(keys.map((k) => [k.key, k.schemaCount, k.speculative])).toEqual([
      ['r|personal|users|username', 2, false],
      ['r|public|users|username', 2, false],
    ])
    const guessed = planKeysOf(
      scanSource(
        'a.ts',
        `const s = 'id, channels(id)'\nsupabase.from('users')\nsupabase.from('messages')\nfoo(s)`,
        { exposedSchemas: ['public'] }
      )
    )
    for (const k of guessed) expect(k.speculative).toBe(true)
  })
})

describe('plan requests', () => {
  it('reads with GET, the normalised select and the schema profile', () => {
    expect(
      planRequestOf({ kind: 'r', schema: 'public', relation: 'users', select: 'id, "a b"' })
    ).toEqual({
      method: 'GET',
      url: '/users?select=id%2C%22a%20b%22',
      headers: { 'Accept-Profile': 'public' },
    })
  })

  it('writes with a POST that asks for the representation', () => {
    expect(
      planRequestOf({ kind: 'w', schema: 'other', relation: 'odd name', select: 'id' })
    ).toEqual({
      method: 'POST',
      url: '/odd%20name?select=id',
      headers: {
        'Content-Profile': 'other',
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: '{}',
    })
  })
})
