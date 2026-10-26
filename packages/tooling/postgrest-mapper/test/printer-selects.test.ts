import type { ResultShape, ShapeEmbed, ShapeField } from '@supabase/postgrest-planner'
import {
  createSelectsContext,
  printRpcEntry,
  printSelects,
  type CallPlan,
  type SelectsContext,
} from '../src'
import { columnKey } from '../src/keys'
import { column, supplementary, table } from './support/printer'

/** Error and raw entries never read the database, so the printer's ordering rules need no context. */
const context = {} as SelectsContext

describe('printSelects', () => {
  it('prints nothing without entries', () => {
    expect(printSelects(context, [])).toBe('')
  })

  it('sorts entries by key and keeps the first of a duplicated key', () => {
    const text = printSelects(context, [
      { key: 'r|public|users|b', error: 'second' },
      { key: 'r|public|users|a', error: 'first' },
      { key: 'r|public|users|b', error: 'dropped' },
    ])
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
    const text = printSelects(context, [
      { key: 'c|public|f|{}', body: '      calls: { kind: "raw" }' },
    ])
    expect(text).toContain('\'c|public|f|{}\': {\n      calls: { kind: "raw" }\n    }')
  })

  it('escapes quotes in keys and error messages', () => {
    const text = printSelects(context, [{ key: "r|public|users|data->>'a'", error: 'it\'s "bad"' }])
    expect(text).toContain("'r|public|users|data->>\\'a\\'': {")
    expect(text).toContain('error: "it\'s \\"bad\\""')
  })
})

describe('the rows of a planned entry', () => {
  const plain = (
    relation: string,
    name: string,
    pgType: string,
    nullable: boolean
  ): ShapeField => ({
    name,
    pgType,
    nullable,
    provenance: { kind: 'plain', source: { schema: 'public', relation, column: name } },
  })
  const embed = (
    name: string,
    relation: string,
    cardinality: 'one' | 'many',
    nullable: boolean,
    shape: ResultShape
  ): ShapeEmbed => ({
    name,
    alias: null,
    key: name,
    spread: false,
    empty: false,
    path: [name],
    outputs: [[name]],
    join: 'left',
    cardinality,
    relationship: null,
    target: { schema: 'public', name: relation, kind: 'table' },
    nullable,
    reason: 'array',
    fkProven: false,
    shape,
  })
  const shapeOf = (
    relation: string,
    fields: ShapeField[],
    embeds: ShapeEmbed[] = []
  ): ResultShape => ({
    relation: { schema: 'public', name: relation },
    fields,
    embeds,
  })

  const context = createSelectsContext({
    supplementary: supplementary({
      relations: [
        table('public', 'books', [column('id', 'integer', 1)]),
        table('public', 'authors', [column('id', 'integer', 1), column('settings', 'jsonb', 2)]),
      ],
    }),
    plans: new Map(),
    traces: new Map(),
    // a column value that is an object literal: it stays an argument of `SupabaseColumnType`
    jsonSchemas: new Map([
      [
        columnKey({ schema: 'public', relation: 'authors', column: 'settings' }),
        '{ theme: string }',
      ],
    ]),
  })
  const authors = shapeOf('authors', [
    plain('authors', 'id', 'int4', false),
    plain('authors', 'settings', 'jsonb', true),
  ])
  const books = shapeOf(
    'books',
    [plain('books', 'id', 'int4', false)],
    [
      embed('author', 'authors', 'one', false, authors),
      embed('editor', 'authors', 'one', true, authors),
      embed('chapters', 'authors', 'many', false, authors),
    ]
  )

  it('wraps the row, a nested embed, an array embed and a nullable embed, and not the value of a column', () => {
    const text = printSelects(context, [{ key: 'r|public|books|*', shape: books }])
    const row = /row: (.*)\n/.exec(text)?.[1]
    const settings =
      "settings: SupabaseColumnType<'public.authors.settings', { theme: string }> | null"
    const author = `PgrstObject<{ id: SupabaseColumnType<'public.authors.id', number>; ${settings} }>`
    expect(row).toBe(
      `PgrstObject<{ id: SupabaseColumnType<'public.books.id', number>; author: ${author}; editor: ${author} | null; chapters: ${author}[] }>`
    )
  })

  it('wraps an empty row', () => {
    const text = printSelects(context, [{ key: 'r|public|books|x', shape: shapeOf('books', []) }])
    expect(text).toContain('row: PgrstObject<{}>\n')
  })

  it('inherits the base of the builder in every planned entry', () => {
    const text = printSelects(context, [
      { key: 'r|public|books|*', shape: books },
      { key: 'w|public|books|id', shape: shapeOf('books', [plain('books', 'id', 'int4', false)]) },
    ])
    expect(text.match(/^ {6}row: .*\n {6}base: 'inherit'\n {6}sources: /gm)).toHaveLength(2)
  })
})

describe('the rows of an rpc call', () => {
  const context = createSelectsContext({
    supplementary: supplementary({}),
    plans: new Map(),
    traces: new Map(),
    jsonSchemas: new Map(),
  })
  const field = (name: string, pgType: string): ShapeField => ({
    name,
    pgType,
    nullable: false,
    provenance: { kind: 'aggregate', function: 'count', of: null },
  })
  const rowset = (names: string[]): CallPlan => ({
    form: 'rowset',
    shape: {
      relation: { schema: 'pg_catalog', name: 'record' },
      fields: names.map((n) => field(n, 'int4')),
      embeds: [],
    },
    rpc: null,
    routine: null,
    returns: null,
    filters: [],
    degraded: [],
  })

  it('wraps the row and the row of the source, whose base the call keeps to itself', () => {
    const entry = printRpcEntry(context, 'f|public|f|a', 'a', [
      {
        keys: [],
        method: 'POST',
        outcome: { plan: rowset(['a']) },
        star: { plan: rowset(['a', 'b']) },
      },
    ])
    expect(entry?.body).toContain('row: PgrstObject<{ a: number }>\n')
    expect(entry?.body).toContain(
      'source: { row: PgrstObject<{ a: number; b: number }>; sources: {} }'
    )
    expect(entry?.body).not.toContain('base:')
  })

  it('wraps the row of a call that selects everything', () => {
    const entry = printRpcEntry(context, 'f|public|f|*', '*', [
      { keys: [], method: 'POST', outcome: { plan: rowset(['a']) } },
    ])
    expect(entry?.body).toContain('row: PgrstObject<{ a: number }>\n')
    expect(entry?.body).toContain('source: { row: PgrstObject<{ a: number }>; sources: {} }')
  })

  it('leaves the row of a scalar as it is', () => {
    const plan: CallPlan = {
      form: 'single-scalar',
      shape: null,
      rpc: null,
      routine: null,
      returns: { kind: 'scalar', multiplicity: 'single', type: { name: 'int4', dims: 0 } },
      filters: [],
      degraded: [],
    }
    const entry = printRpcEntry(context, 'f|public|f|*', '*', [
      { keys: [], method: 'POST', outcome: { plan } },
    ])
    expect(entry?.body).toContain('row: number | null\n')
    expect(entry?.body).not.toContain('PgrstObject')
  })
})
