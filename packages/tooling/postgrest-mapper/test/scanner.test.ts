import { COLUMN_METHODS, scanFiles, scanSource } from '../src'
import { operands, scan, selects } from './helpers'

describe('relations and selects', () => {
  it('records a read select under the relation and exposed schemas', () => {
    const r = scan(`supabase.from('todos').select('id, title')`)
    expect(selects(r)).toEqual(['r|*|todos|id, title'])
  })

  it('keeps the raw cooked select, whitespace included', () => {
    const r = scan(`supabase.from('t').select('a,b')\nsupabase.from('t').select(' a , b ')`)
    expect(selects(r)).toEqual(['r|*|t| a , b ', 'r|*|t|a,b'])
  })

  it('defaults a bare select() to *', () => {
    expect(selects(scan(`supabase.from('t').select()`))).toEqual(['r|*|t|*'])
    expect(selects(scan(`supabase.from('t').select(undefined)`))).toEqual(['r|*|t|*'])
  })

  it('records a mutation with .select() as a write representation', () => {
    const r = scan(`
      supabase.from('t').insert({ a: 1 }).select('a')
      supabase.from('t').update({ a: 1 }).eq('id', 1).select()
      supabase.from('t').upsert({ a: 1 }).select('a, b')
      supabase.from('t').delete().eq('id', 1).select('id')
    `)
    expect(selects(r)).toEqual(['w|*|t|*', 'w|*|t|a', 'w|*|t|a, b', 'w|*|t|id'])
  })

  it('records no select for a mutation without .select()', () => {
    const r = scan(`supabase.from('t').insert({ a: 1 })`)
    expect(r.selects).toEqual([])
    expect(r.fallbacks).toEqual([])
  })

  it('keeps reads and writes of one relation apart', () => {
    const r = scan(`
      supabase.from('t').select('a')
      supabase.from('t').insert({}).select('a')
    `)
    expect(selects(r)).toEqual(['r|*|t|a', 'w|*|t|a'])
  })

  it('applies .schema() before and after resolution of the schema', () => {
    const r = scan(`
      supabase.schema('private').from('t').select('a')
      supabase.schema(cond ? 'a' : 'b').from('t').select('b')
    `)
    expect(selects(r)).toEqual(['r|a,b|t|b', 'r|private|t|a'])
  })

  it('reports an unresolved schema and falls back to every exposed schema', () => {
    const r = scan(`supabase.schema(name).from('t').select('a')`)
    expect(selects(r)).toEqual(['r|*|t|a'])
    expect(r.unresolved.map((u) => u.what)).toEqual(['schema'])
  })

  it('expands exposed to the exposedSchemas option', () => {
    const r = scan(`supabase.from('t').select('a'); supabase.schema('x').from('t').select('b')`, {
      exposedSchemas: ['public', 'api'],
    })
    expect(selects(r)).toEqual(['r|api,public|t|a', 'r|x|t|b'])
  })

  it('reads from a split chain through consts', () => {
    const r = scan(`
      const table = supabase.schema('s').from('t')
      const base = table.select('a, b')
      const filtered = base.eq('a', 1)
      filtered.order('b')
    `)
    expect(selects(r)).toEqual(['r|s|t|a, b'])
    expect(operands(r)).toEqual(['r|s|t|a, b|a', 'r|s|t|a, b|b'])
  })

  it('does not follow let, parameters or annotated consts', () => {
    const r = scan(`
      let a = supabase.from('t')
      a.select('x')
      function f(q) { q.select('y') }
      const b: Foo = supabase.from('t')
      b.select('z')
    `)
    expect(r.selects).toEqual([])
  })

  it('respects lexical shadowing of const bindings', () => {
    const r = scan(`
      const q = supabase.from('t')
      function f(q) { return q.select('inner') }
      q.select('outer')
    `)
    expect(selects(r)).toEqual(['r|*|t|outer'])
  })

  it('handles the optional-chain, await, as and non-null wrappers', () => {
    const r = scan(`
      async function f() {
        await (supabase.from('t') as any).select('a')
        await supabase!.from('u')!.select('b')
        await supabase?.from('v')?.select('c')
      }
    `)
    expect(selects(r)).toEqual(['r|*|t|a', 'r|*|u|b', 'r|*|v|c'])
  })

  it('does not treat other from() receivers as clients', () => {
    const r = scan(`Array.from('x'); Buffer.from('abc'); Object.from('y').select('z')`)
    expect(r.selects).toEqual([])
    expect(r.fallbacks).toEqual([])
  })

  it('scans tsx', () => {
    const r = scan(
      `export const C = () => { const { data } = useQuery(() => supabase.from('todos').select('id')); return <div>{data}</div> }`,
      undefined,
      'c.tsx'
    )
    expect(selects(r)).toEqual(['r|*|todos|id'])
    expect(r.files[0].parseErrors).toBe(0)
  })
})

describe('string resolution', () => {
  it('resolves literals, templates, consts, conditionals, as const and parentheses', () => {
    const r = scan(`
      const rel = 'todos'
      const cols = \`id, title\`
      const sel = cond ? 'a' : (other ? 'b' : 'c')
      supabase.from(rel).select(cols)
      supabase.from('x').select(sel)
      supabase.from(('y' as const)).select(('z' as const))
      supabase.from('w').select(\`k\`)
    `)
    expect(selects(r)).toEqual([
      'r|*|todos|id, title',
      'r|*|w|k',
      'r|*|x|a',
      'r|*|x|b',
      'r|*|x|c',
      'r|*|y|z',
    ])
  })

  it('records a union from a conditional relation', () => {
    const r = scan(`supabase.from(cond ? 'a' : 'b').select('id')`)
    expect(selects(r)).toEqual(['r|*|a|id', 'r|*|b|id'])
  })

  it('cooks escapes in template and string literals', () => {
    const r = scan('supabase.from("t").select(`a\\n,b`); supabase.from("t").select("c\\u0020d")')
    expect(selects(r)).toEqual(['r|*|t|a\n,b', 'r|*|t|c d'])
  })

  it('leaves templates with substitutions unresolved', () => {
    const r = scan('supabase.from("t").select(`id, ${cols}`)')
    expect(r.selects).toEqual([])
    expect(r.unresolved.map((u) => u.what)).toEqual(['select'])
  })

  it('leaves identifiers, calls, concatenation, let and annotated consts unresolved', () => {
    const r = scan(`
      let a = 'x'
      const b: string = 'y'
      supabase.from('t').select(name)
      supabase.from('t').select(fn())
      supabase.from('t').select('a' + 'b')
      supabase.from('t').select(a)
      supabase.from('t').select(b)
    `)
    expect(r.selects).toEqual([])
    expect(r.unresolved).toHaveLength(5)
  })

  it('leaves a conditional with an unresolvable branch unresolved', () => {
    const r = scan(`supabase.from('t').select(cond ? 'a' : other)`)
    expect(r.selects).toEqual([])
    expect(r.unresolved).toHaveLength(1)
  })

  it('reports an unresolved relation and rpc name', () => {
    const r = scan(`supabase.from(name).select('a'); supabase.rpc(fn)`)
    expect(r.selects).toEqual([])
    expect(r.unresolved.map((u) => u.what).sort()).toEqual(['function', 'relation'])
  })

  it('terminates on self-referential consts', () => {
    const r = scan(`const a = a; const q = q.select('x'); supabase.from(a).select('b')`)
    expect(r.selects).toEqual([])
  })
})

describe('rpc', () => {
  it('records a POST rpc with its key set', () => {
    expect(selects(scan(`supabase.rpc('f', { b: 1, a: 2 })`))).toEqual(['f|*|f(a,b):POST|*'])
  })

  it('records an argument-less rpc with an empty key set', () => {
    expect(selects(scan(`supabase.rpc('f')`))).toEqual(['f|*|f():POST|*'])
    expect(selects(scan(`supabase.rpc('f', undefined)`))).toEqual(['f|*|f():POST|*'])
  })

  it('records GET and HEAD from literal options, head winning', () => {
    const r = scan(`
      supabase.rpc('a', {}, { get: true })
      supabase.rpc('b', {}, { head: true })
      supabase.rpc('c', {}, { head: true, get: true })
      supabase.rpc('d', {}, { get: false })
      supabase.rpc('e', {}, {})
    `)
    expect(selects(r)).toEqual([
      'f|*|a():GET|*',
      'f|*|b():HEAD|*',
      'f|*|c():HEAD|*',
      'f|*|d():POST|*',
      'f|*|e():POST|*',
    ])
  })

  it('records every possible method for non-literal options', () => {
    const r = scan(`
      supabase.rpc('a', {}, { get: flag })
      supabase.rpc('b', {}, opts)
      supabase.rpc('c', {}, { ...opts })
    `)
    expect(selects(r)).toEqual([
      'f|*|a():GET|*',
      'f|*|a():POST|*',
      'f|*|b():GET|*',
      'f|*|b():HEAD|*',
      'f|*|b():POST|*',
      'f|*|c():GET|*',
      'f|*|c():HEAD|*',
      'f|*|c():POST|*',
    ])
  })

  it('marks the key set unknown when the arguments are not a literal', () => {
    const r = scan(`supabase.rpc('f', args); supabase.rpc('g', { ...rest, a: 1 })`)
    expect(r.selects.map((s) => s.target.kind === 'f' && s.target.keys)).toEqual([null, null])
  })

  it('records the select of a set-returning rpc and its operands', () => {
    const r = scan(`supabase.rpc('f', { a: 1 }).select('id, name').eq('id', 1).order('name')`)
    expect(selects(r)).toEqual(['f|*|f(a):POST|*', 'f|*|f(a):POST|id, name'])
    expect(operands(r)).toEqual(['f|*|f|id, name|id', 'f|*|f|id, name|name'])
  })

  it('honours .schema() on rpc', () => {
    expect(selects(scan(`supabase.schema('s').rpc('f')`))).toEqual(['f|s|f():POST|*'])
  })
})

describe('operands', () => {
  it('records every column-taking filter method', () => {
    const calls = COLUMN_METHODS.filter((m) => m !== 'not' && m !== 'filter' && m !== 'order')
    const source = calls.map((m) => `q.${m}('col_${m}', 1)`).join('\n')
    const r = scan(`const q = supabase.from('t').select('a')\n${source}`)
    expect(operands(r)).toEqual(calls.map((m) => `r|*|t|a|col_${m}`).sort())
  })

  it('records not, filter and order', () => {
    const r = scan(`
      supabase.from('t').select('a')
        .not('n', 'eq', 1)
        .filter('f', 'eq', 1)
        .order('o', { ascending: false })
    `)
    expect(operands(r)).toEqual(['r|*|t|a|f', 'r|*|t|a|n', 'r|*|t|a|o'])
  })

  it('records the keys of match', () => {
    const r = scan(`supabase.from('t').select('a').match({ x: 1, 'y z': 2, ['w']: 3 })`)
    expect(operands(r)).toEqual(['r|*|t|a|w', 'r|*|t|a|x', 'r|*|t|a|y z'])
  })

  it('records no match key when the object is not a literal', () => {
    expect(scan(`supabase.from('t').select('a').match(obj)`).operands).toEqual([])
    expect(scan(`supabase.from('t').select('a').match({ ...obj })`).operands).toEqual([])
  })

  it('resolves the column like any string', () => {
    const r = scan(`
      const col = 'c'
      supabase.from('t').select('a').eq(col, 1).eq(cond ? 'x' : 'y', 2).eq(dyn, 3)
    `)
    expect(operands(r)).toEqual(['r|*|t|a|c', 'r|*|t|a|x', 'r|*|t|a|y'])
  })

  it('records @table for referencedTable and not the column', () => {
    const r = scan(`
      supabase.from('t').select('a, e(id)')
        .order('x', { referencedTable: 'e' })
        .limit(1, { referencedTable: 'e' })
        .range(0, 1, { referencedTable: 'e' })
        .or('x.eq.1', { referencedTable: 'e' })
        .filter('y', 'eq', 1, { referencedTable: 'e' })
    `)
    expect(operands(r)).toEqual(['r|*|t|a, e(id)|@e'])
    expect(r.operands[0].via).toBe('referencedTable')
  })

  it('accepts the deprecated foreignTable option', () => {
    const r = scan(`supabase.from('t').select('a').order('x', { foreignTable: 'e' })`)
    expect(operands(r)).toEqual(['r|*|t|a|@e'])
  })

  it('resolves referencedTable through consts and conditionals', () => {
    const r = scan(`
      const e = 'e'
      supabase.from('t').select('a').limit(1, { referencedTable: e }).limit(1, { referencedTable: c ? 'f' : 'g' })
    `)
    expect(operands(r)).toEqual(['r|*|t|a|@e', 'r|*|t|a|@f', 'r|*|t|a|@g'])
  })

  it('treats an undefined or absent referencedTable as none', () => {
    const r = scan(`
      supabase.from('t').select('a')
        .order('x', { referencedTable: undefined })
        .order('y', { ascending: true })
        .limit(1)
        .or('z.eq.1')
    `)
    expect(operands(r)).toEqual(['r|*|t|a|x', 'r|*|t|a|y'])
  })

  it('records nothing for an unresolved referencedTable but keeps the select', () => {
    const r = scan(`supabase.from('t').select('a').order('x', { referencedTable: dyn })`)
    expect(r.operands).toEqual([])
    expect(selects(r)).toEqual(['r|*|t|a'])
  })

  it('keeps the column when the options are not a literal', () => {
    const r = scan(`supabase.from('t').select('a').order('x', opts)`)
    expect(operands(r)).toEqual(['r|*|t|a|x'])
  })

  it('attaches operands to the select current at that point', () => {
    const r = scan(`
      const q = supabase.from('t')
      q.select('a').eq('x', 1)
      q.select('b').eq('y', 1)
    `)
    expect(operands(r)).toEqual(['r|*|t|a|x', 'r|*|t|b|y'])
  })

  it('attaches operands of a re-select to the new select', () => {
    const r = scan(`supabase.from('t').insert({}).select('a').eq('x', 1)`)
    expect(operands(r)).toEqual(['w|*|t|a|x'])
  })

  it('attaches operands of a mutation without select to the default select', () => {
    const r = scan(`supabase.from('t').update({ a: 1 }).eq('id', 1)`)
    expect(operands(r)).toEqual(['w|*|t|*|id'])
  })

  it('ignores filter-named calls that are not on a recorded chain', () => {
    const r = scan(`list.eq('x', 1); other.order('y'); Array.from('t').eq('x', 1)`)
    expect(r.operands).toEqual([])
  })

  it('records every select of a union for each operand', () => {
    const r = scan(`supabase.from('t').select(c ? 'a' : 'b').eq('x', 1)`)
    expect(operands(r)).toEqual(['r|*|t|a|x', 'r|*|t|b|x'])
  })

  it('records rpc operands under the function', () => {
    const r = scan(`supabase.rpc('f', {}).eq('x', 1)`)
    expect(operands(r)).toEqual(['f|*|f|*|x'])
  })
})

describe('locations and determinism', () => {
  it('reports UTF-16 offsets, 1-based lines and columns', () => {
    const src = `// 😀\nsupabase.from('t').select('a')\n`
    const r = scan(src)
    const loc = r.selects[0].locations[0]
    expect(src.slice(loc.start, loc.end)).toBe(`'a'`)
    expect(loc).toMatchObject({ fileName: 'a.ts', line: 2, column: 27 })
  })

  it('counts CRLF as one line break', () => {
    const r = scan(`a\r\nb\r\nsupabase.from('t').select('a')`)
    expect(r.selects[0].locations[0].line).toBe(3)
  })

  it('locates a bare select() at the call', () => {
    const src = `supabase.from('t').select()`
    const loc = scan(src).selects[0].locations[0]
    expect(src.slice(loc.start, loc.end)).toBe('select()')
  })

  it('merges locations of one request across files, independent of file order', () => {
    const files = [
      { fileName: 'b.ts', sourceText: `supabase.from('t').select('a')` },
      {
        fileName: 'a.ts',
        sourceText: `supabase.from('t').select('a')\nsupabase.from('t').select('a')`,
      },
    ]
    const forward = scanFiles(files)
    const backward = scanFiles([...files].reverse())
    expect(forward).toEqual(backward)
    expect(forward.selects).toHaveLength(1)
    expect(forward.selects[0].locations.map((l) => [l.fileName, l.line])).toEqual([
      ['a.ts', 1],
      ['a.ts', 2],
      ['b.ts', 1],
    ])
  })

  it('reports parse errors without throwing', () => {
    const r = scan(`supabase.from('t').select('a'); const = ;`)
    expect(r.files[0].parseErrors).toBeGreaterThan(0)
  })

  it('does no I/O and works on empty input', () => {
    expect(scanSource('x.ts', '')).toEqual({
      selects: [],
      operands: [],
      fallbacks: [],
      unresolved: [],
      files: [{ fileName: 'x.ts', parseErrors: 0, fallbackTruncated: false }],
    })
  })
})

describe('fallback pairs', () => {
  it('pairs a select that is not connected to a chain with every relation and function of the file', () => {
    const r = scan(`
      const cols = 'id, name'
      function load(q) { return q.select(cols) }
      supabase.from('a').select('x')
      supabase.from('b').insert({}).select('y')
      supabase.rpc('f', {})
    `)
    expect(r.fallbacks.map((f) => [f.select, f.target.kind, f.target.name, f.schemas])).toEqual([
      ['id, name', 'function', 'f', 'exposed'],
      ['id, name', 'relation', 'a', 'exposed'],
      ['id, name', 'relation', 'b', 'exposed'],
    ])
    const rel = r.fallbacks.find((f) => f.target.name === 'b')!
    expect(rel.target.kind === 'relation' && rel.target.kinds).toEqual(['r', 'w'])
    expect(rel.locations).toHaveLength(1)
  })

  it('does not pair a bare * select', () => {
    const r = scan(`function f(q) { return q.select() }; supabase.from('a').select('x')`)
    expect(r.fallbacks).toEqual([])
  })

  it('does not pair a select that resolved on a chain', () => {
    const r = scan(`supabase.from('a').select('x'); supabase.from('b').select('y')`)
    expect(r.fallbacks).toEqual([])
  })

  it('carries the schemas the relation was used with', () => {
    const r = scan(`
      function f(q) { return q.select('x') }
      supabase.schema('s1').from('a').select('i')
      supabase.schema('s2').from('a').select('i')
    `)
    expect(r.fallbacks[0].schemas).toEqual(['s1', 's2'])
  })

  it('widens to exposed schemas when one use has no schema', () => {
    const r = scan(
      `
      function f(q) { return q.select('x') }
      supabase.schema('s1').from('a').select('i')
      supabase.from('a').select('i')
    `,
      { exposedSchemas: ['public', 's1'] }
    )
    expect(r.fallbacks[0].schemas).toEqual(['public', 's1'])
  })

  it('is per file', () => {
    const r = scanFiles([
      { fileName: 'a.ts', sourceText: `function f(q) { return q.select('x') }` },
      { fileName: 'b.ts', sourceText: `supabase.from('t').select('y')` },
    ])
    expect(r.fallbacks).toEqual([])
  })

  it('caps the pairs of a file at 64 and flags the truncation', () => {
    const relations = Array.from({ length: 10 }, (_, i) => `supabase.from('r${i}').select('a')`)
    const selects = Array.from({ length: 10 }, (_, i) => `q.select('c${i}')`)
    const r = scan(`function f(q) { ${selects.join('; ')} }\n${relations.join('\n')}`)
    expect(r.fallbacks).toHaveLength(64)
    expect(r.files[0].fallbackTruncated).toBe(true)
  })

  it('does not flag a file at exactly 64 pairs', () => {
    const relations = Array.from({ length: 8 }, (_, i) => `supabase.from('r${i}').select('a')`)
    const selects = Array.from({ length: 8 }, (_, i) => `q.select('c${i}')`)
    const r = scan(`function f(q) { ${selects.join('; ')} }\n${relations.join('\n')}`)
    expect(r.fallbacks).toHaveLength(64)
    expect(r.files[0].fallbackTruncated).toBe(false)
  })
})
