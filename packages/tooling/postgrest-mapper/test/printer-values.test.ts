import type { ResultShape, ShapeField } from '@supabase/postgrest-planner'
import {
  createSelectsContext,
  printDatabase,
  printModule,
  printRpcEntry,
  printSelects,
  type CallPlan,
  type Supplementary,
} from '../src'
import { quote, quoteDouble } from '../src/printer/literal'
import { TYPE_HELPERS, typecheckConsumer } from './support/consumer'

/**
 * What the printers say about values: composite values, the elements of a set of scalars, string literals and
 * overridden columns under an aggregate. The catalog and plans are built by hand (PostgreSQL facts the stack does
 * not have: a table used as a column type, a `SETOF integer` function, names with line breaks), and printed like a
 * generation does; the module is type-checked as a consumer sees it.
 */

const HELPERS = `import type { Json } from './db'\n${TYPE_HELPERS}export type { Json }\n`

const supplementary = (over: Partial<Supplementary>): Supplementary => ({
  format: 1,
  composites: [],
  foreignKeys: [],
  relations: [],
  functions: [],
  schemas: [],
  searchPathFunctions: [],
  types: [],
  casts: [],
  referencedRelations: [],
  enums: [],
  jsonSchemaChecks: [],
  ...over,
})

const column = (name: string, type: string, attnum: number, notNull = false) => ({
  name,
  attnum,
  type,
  notNull,
  hasDefault: false,
  identity: null,
  generated: null,
})

const table = (schema: string, name: string, columns: ReturnType<typeof column>[]) => ({
  schema,
  name,
  kind: 'r' as const,
  columns,
  viewDefinition: null,
  updatable: { insert: true, update: true, delete: true },
})

/** The planner's output column of `select=*` */
const plain = (
  schema: string,
  relation: string,
  name: string,
  pgType: string,
  nullable: boolean
): ShapeField => ({
  name,
  pgType,
  nullable,
  provenance: { kind: 'plain', source: { schema, relation, column: name } },
})

const fn = (
  name: string,
  argTypes: string[],
  returns: { kind: 'scalar' | 'composite'; setof: boolean; type: string }
) => ({
  schema: 'public',
  name,
  argTypes,
  volatility: 'v',
  returns,
  outColumns: null,
  language: 'sql',
  source: null,
  argNames: argTypes.map((_, i) => `a${i}`),
})

function printed(
  input: Partial<Supplementary>,
  plans: [string, ShapeField[]][],
  schemas = ['public']
): string {
  const result = printDatabase({
    supplementary: supplementary(input),
    dump: '{}',
    schemas,
    plans: new Map(plans),
    traces: new Map(),
    jsonSchemas: new Map(),
  })
  return printModule({ database: result.text })
}

function expectClean(db: string, consumer: string): void {
  const result = typecheckConsumer({
    files: { 'db.d.ts': db, 'helpers.ts': HELPERS, 'consumer.ts': consumer },
  })
  expect(result.byFile.get('db.d.ts') ?? []).toEqual([])
  expect(result.byFile.get('consumer.ts') ?? []).toEqual([])
}

describe('F6: a composite value is not a table row', () => {
  // `person(id integer PRIMARY KEY)` and `holder(p person)`: `ROW(NULL)::person` is a legal value of `holder.p`,
  // because PostgreSQL enforces a table's constraints on its rows, not on standalone composite values
  const db = printed(
    {
      relations: [
        table('public', 'person', [column('id', 'integer', 1, true), column('name', 'text', 2)]),
        table('public', 'holder', [
          column('id', 'integer', 1, true),
          column('p', 'public.person', 2),
        ]),
      ],
      composites: [
        {
          schema: 'public',
          name: 'wrapper',
          attributes: [{ name: 'inner', type: 'public.person', attnum: 1 }],
        },
      ],
      functions: [
        fn('echo_person', ['public.person'], {
          kind: 'composite',
          setof: false,
          type: 'public.person',
        }),
        fn('all_people', [], { kind: 'composite', setof: true, type: 'public.person' }),
      ],
    },
    [
      [
        'public.person',
        [
          plain('public', 'person', 'id', 'int4', false),
          plain('public', 'person', 'name', 'text', true),
        ],
      ],
      [
        'public.holder',
        [
          plain('public', 'holder', 'id', 'int4', false),
          plain('public', 'holder', 'p', 'public.person', true),
        ],
      ],
    ]
  )

  test('a column, an argument, a return and a composite attribute hold nullable attributes', () => {
    expectClean(
      db,
      `
import type { Equal, Expect } from './helpers'
type P = SupabaseDatabase['public']
type Person = { id: number | null; name: string | null }
export type Column = Expect<Equal<P['Tables']['holder']['Row']['p'], Person | null>>
export type Insert = Expect<Equal<P['Tables']['holder']['Insert']['p'], Person | null | undefined>>
export type Arg = Expect<Equal<P['Functions']['echo_person']['Args'], { a0: Person }>>
export type Return = Expect<Equal<P['Functions']['echo_person']['Returns'], Person>>
export type Set = Expect<Equal<P['Functions']['all_people']['Returns'], Person[]>>
export type Attribute = Expect<Equal<P['CompositeTypes']['wrapper'], { inner: Person | null }>>
// a table's own rows keep their constraints
export type Row = Expect<Equal<P['Tables']['person']['Row'], { id: number; name: string | null }>>
export const nullId: Person = { id: null, name: null }
`
    )
  })
})

describe('F7: the elements of a set of scalars can be null', () => {
  test('SupabaseDatabase prints them nullable', () => {
    const db = printed(
      {
        enums: [{ schema: 'public', name: 'status', labels: ['on', 'off'] }],
        functions: [
          fn('ints', [], { kind: 'scalar', setof: true, type: 'integer' }),
          fn('statuses', [], { kind: 'scalar', setof: true, type: 'public.status' }),
          fn('lists', [], { kind: 'scalar', setof: true, type: 'text[]' }),
          fn('one', [], { kind: 'scalar', setof: false, type: 'integer' }),
        ],
      },
      []
    )
    expectClean(
      db,
      `
import type { Equal, Expect } from './helpers'
type F = SupabaseDatabase['public']['Functions']
export type Ints = Expect<Equal<F['ints']['Returns'], (number | null)[]>>
export type Statuses = Expect<Equal<F['statuses']['Returns'], ('on' | 'off' | null)[]>>
export type Lists = Expect<Equal<F['lists']['Returns'], (string[] | null)[]>>
export type One = Expect<Equal<F['one']['Returns'], number | null>>
`
    )
  })

  test('the call entry of a set of scalars types the rows nullable', () => {
    const context = createSelectsContext({
      supplementary: supplementary({}),
      plans: new Map(),
      traces: new Map(),
      jsonSchemas: new Map(),
    })
    const plan: CallPlan = {
      form: 'setof-scalar',
      shape: null,
      rpc: null,
      routine: null,
      returns: { kind: 'scalar', multiplicity: 'setof', type: 'int4' },
      filters: [],
      degraded: [],
    }
    const entry = printRpcEntry(context, 'f|public|ints|*', '*', [
      { keys: [], method: 'POST', outcome: { plan } },
    ])
    expect(entry?.body).toContain("form: 'rows'")
    expect(entry?.body).toMatch(/row: number \| null\n/)
  })
})

describe('F15: names and labels are valid string literals whatever characters they hold', () => {
  const labels = ['a\rb', 'c\nd', "e'f", 'g\\h', 'i\u2028j', 'k\u2029l', 'm\u0001n', 'o\tp']
  const db = printed(
    {
      enums: [
        { schema: 'public', name: 'weird\nenum\r', labels },
        { schema: 'public', name: 'plain', labels: ['x'] },
      ],
      relations: [
        table('public', 'tab\rle\u2028', [
          column('co\nl', 'public."weird\nenum\r"', 1),
          column('id', 'integer', 2, true),
        ]),
      ],
    },
    [
      [
        'public.tab\rle\u2028',
        [
          plain('public', 'tab\rle\u2028', 'co\nl', 'public.weird\nenum\r', true),
          plain('public', 'tab\rle\u2028', 'id', 'int4', false),
        ],
      ],
    ]
  )

  test('the module declares them, and a consumer reads the exact characters back', () => {
    expectClean(
      db,
      `
import type { Equal, Expect } from './helpers'
type P = SupabaseDatabase['public']
type Weird = 'a\\rb' | 'c\\nd' | "e'f" | 'g\\\\h' | 'i\\u2028j' | 'k\\u2029l' | 'm\\u0001n' | 'o\\tp'
export type Enum = Expect<Equal<P['Enums']['weird\\nenum\\r'], Weird>>
export type Col = Expect<Equal<P['Tables']['tab\\rle\\u2028']['Row']['co\\nl'], Weird | null>>
`
    )
  })

  test('a literal reads back as the text it was made from, on one line', () => {
    const samples = [
      ...labels,
      '"',
      '\ud800 lone',
      'lone \udc00',
      '\u{1f600} pair',
      '\u007f\u0000',
      "\\'",
    ]
    for (const sample of samples) {
      for (const literal of [quote(sample), quoteDouble(sample)]) {
        expect(literal).not.toMatch(/[\n\r\u2028\u2029]/)
        expect(new Function(`return ${literal}`)()).toBe(sample)
      }
    }
  })

  test('a select entry key and a planner message with line breaks stay on one line', () => {
    const context = createSelectsContext({
      supplementary: supplementary({}),
      plans: new Map(),
      traces: new Map(),
      jsonSchemas: new Map(),
    })
    const { text } = printSelects(context, [
      { key: 'r|public|a\rb\u2028|*', error: 'no \u2028 relation "x\r"' },
    ])
    expect(text).not.toMatch(/[\r\u2028\u2029]/)
    expect(text).toContain("'r|public|a\\rb\\u2028|*'")
    expect(text).toContain('error: "no \\u2028 relation \\"x\\r\\""')
  })
})

describe('F16: an aggregate that keeps the value keeps the column override', () => {
  const context = createSelectsContext({
    supplementary: supplementary({
      relations: [
        table('public', 'pets', [column('kind', 'text', 1, true), column('n', 'integer', 2, true)]),
      ],
    }),
    plans: new Map([
      [
        'public.pets',
        [
          plain('public', 'pets', 'kind', 'text', false),
          plain('public', 'pets', 'n', 'int4', false),
        ],
      ],
    ]),
    traces: new Map(),
    jsonSchemas: new Map(),
  })
  const source = (c: string) => ({ schema: 'public', relation: 'pets', column: c })
  const aggregate = (
    name: string,
    fnName: string,
    of: string | null,
    pgType: string,
    nullable = true
  ): ShapeField => ({
    name,
    pgType,
    nullable,
    provenance: {
      kind: 'aggregate',
      function: fnName,
      of: of === null ? null : { kind: 'plain', source: source(of) },
    },
  })
  const shape: ResultShape = {
    relation: { schema: 'public', name: 'pets' },
    fields: [
      aggregate('latest', 'max', 'kind', 'text'),
      aggregate('first', 'min', 'kind', 'text'),
      aggregate('c', 'count', null, 'int8', false),
      aggregate('s', 'sum', 'n', 'int8'),
      aggregate('a', 'avg', 'n', 'numeric'),
    ],
    embeds: [],
  }

  test('min and max wrap the source column, count, sum and avg replace it', () => {
    const { text } = printSelects(context, [{ key: 'r|public|pets|aggs', shape }])
    expect(text).toContain(
      "row: { latest: SupabaseColumnType<'public.pets.kind', string> | null; first: SupabaseColumnType<'public.pets.kind', string> | null; c: number; s: number | null; a: number | null }"
    )
  })
})
