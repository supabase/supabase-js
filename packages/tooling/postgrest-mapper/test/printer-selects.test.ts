import { printSelects, type SelectsContext } from '../src'

/** Error and raw entries never read the database, so the printer's ordering rules need no context. */
const context = {} as SelectsContext

describe('printSelects', () => {
  it('prints nothing without entries', () => {
    expect(printSelects(context, [])).toEqual({ text: '', entries: [] })
  })

  it('sorts entries by key and keeps the first of a duplicated key', () => {
    const { text, entries } = printSelects(context, [
      { key: 'r|public|users|b', error: 'second' },
      { key: 'r|public|users|a', error: 'first' },
      { key: 'r|public|users|b', error: 'dropped' },
    ])
    expect(entries.map((e) => e.key)).toEqual(['r|public|users|a', 'r|public|users|b'])
    expect(text).toBe(
      [
        '  interface SupabaseSelects {',
        "    'r|public|users|a': {",
        '      error: "first"',
        '    }',
        "    'r|public|users|b': {",
        '      error: "second"',
        '    }',
        '  }',
      ].join('\n')
    )
  })

  it('prints a raw entry body as given: the place RPC calls entries plug into', () => {
    const { text } = printSelects(context, [
      { key: 'c|public|f|{}', body: '      calls: { kind: "raw" }' },
    ])
    expect(text).toContain('\'c|public|f|{}\': {\n      calls: { kind: "raw" }\n    }')
  })

  it('escapes quotes in keys and error messages', () => {
    const { text } = printSelects(context, [
      { key: "r|public|users|data->>'a'", error: 'it\'s "bad"' },
    ])
    expect(text).toContain("'r|public|users|data->>\\'a\\'': {")
    expect(text).toContain('error: "it\'s \\"bad\\""')
  })
})
