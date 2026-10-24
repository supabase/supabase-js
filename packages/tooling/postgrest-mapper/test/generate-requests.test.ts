import fs = require('node:fs')
import path = require('node:path')
import ts = require('typescript')
import { normalizeSelect, planKeysOf, planRequestOf, scanSource } from '../src'
import { operandRequestOf, planOperandsOf, planRpcOf } from '../src/generate/requests'

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

describe('rpc plan keys of a select that no chain reaches', () => {
  const SIGNATURES = new Map([['public.f', [{ required: ['a'], optional: ['b'] }]]])
  const HELPER = `
    function projected(builder) { return builder.select('x') }
    projected(supabase.rpc('f', { a: 1 }, { get: true }))
  `
  const entriesOf = (source: string, withObserved = true) => {
    const scan = scanSource('a.ts', source, { exposedSchemas: ['public'] })
    const used = withObserved ? scan : { ...scan, selects: [] }
    return planRpcOf(used, SIGNATURES)
      .filter((k) => k.select === 'x')
      .map((k) => [k.entry, k.keys, k.method])
  }

  it('plans the select for the key sets and methods the file calls the function with', () => {
    expect(entriesOf(HELPER)).toEqual([['f|public|f|x', ['a'], 'GET']])
  })

  it('plans it for every overload of the function when the file calls it with no key set it can see', () => {
    expect(entriesOf(HELPER, false)).toEqual([
      ['f|public|f|x', ['a', 'b'], 'POST'],
      ['f|public|f|x', ['a'], 'POST'],
    ])
  })
})

describe('order requests', () => {
  const requestsOf = (source: string) =>
    planOperandsOf(scanSource('a.ts', source, { exposedSchemas: ['public'] }), new Map()).map(
      (k) => [k.entry, operandRequestOf(k).url] as const
    )

  it('plans an order column as an order parameter and a filter operand as a filter', () => {
    expect(
      requestsOf(
        `supabase.from('messages').select('id, channels(id)').order('channels(id)').eq('channels.id', 1)`
      )
    ).toEqual([
      [
        'order|r|public|messages|id, channels(id)|channels(id)',
        '/messages?select=id%2Cchannels(id)&order=channels(id).asc&channels(id)=is.null',
      ],
      [
        'r|public|messages|id, channels(id)|channels.id',
        '/messages?select=id%2Cchannels(id)&channels.id=is.null',
      ],
    ])
  })

  it('keeps an order column and a filter on the same name apart', () => {
    const keys = requestsOf(
      `supabase.from('messages').select('id, channels(id)').order('channels.id').eq('channels.id', 1)`
    ).map(([key]) => key)
    expect(keys).toEqual([
      'order|r|public|messages|id, channels(id)|channels.id',
      'r|public|messages|id, channels(id)|channels.id',
    ])
  })

  it('does not plan the order column of a referencedTable', () => {
    expect(
      requestsOf(
        `supabase.from('messages').select('id, channels(id)').order('id', { referencedTable: 'channels' })`
      )
    ).toEqual([])
  })
})
