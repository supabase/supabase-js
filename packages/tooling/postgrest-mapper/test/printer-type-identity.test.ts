import type { ShapeField } from '@supabase/postgrest-planner'
import {
  buildJsonSchemaInput,
  createSelectsContext,
  printRpcEntry,
  type CallPlan,
  type Supplementary,
} from '../src'
import { callReturnsOf } from '../src/printer'
import { column as columnOf, expectClean, printed, supplementary, table } from './support/printer'

/**
 * A type is a schema and a name, never a dotted string: `a."b.mood"` and `"a.b".mood` are two types, a name can hold
 * a dot or a parenthesis, and a name can read like a property of `Object.prototype`. The catalog and plans are built
 * by hand, printed like a generation does, and the module is type-checked as a consumer sees it.
 */

/** The columns here are NOT NULL unless a test says otherwise */
const column = (name: string, type: string, attnum: number) => columnOf(name, type, attnum, true)

const plain = (relation: string, name: string, pgType: string): ShapeField => ({
  name,
  pgType,
  nullable: false,
  provenance: { kind: 'plain', source: { schema: 'public', relation, column: name } },
})

const fn = (name: string, type: string) => ({
  schema: 'public',
  name,
  argTypes: [type],
  volatility: 'v',
  returns: { kind: 'scalar' as const, setof: false, type },
  outColumns: null,
  language: 'sql',
  source: null,
  argNames: ['v'],
  defaults: 0,
  searchPath: null,
})

describe('a type that a column, an argument and a return name with a quoted schema or name', () => {
  // `"a.b".mood` and `a."b.mood"` read alike once joined with a dot
  const db = printed(
    {
      enums: [
        { schema: 'a.b', name: 'mood', labels: ['x', 'y'] },
        { schema: 'a', name: 'b.mood', labels: ['z'] },
      ],
      relations: [
        table('public', 't', [column('m', '"a.b".mood', 1), column('n', 'a."b.mood"', 2)]),
      ],
      functions: [fn('echo_m', '"a.b".mood'), fn('echo_n', 'a."b.mood"')],
    },
    [['public.t', [plain('t', 'm', '"a.b".mood'), plain('t', 'n', 'a."b.mood"')]]],
    ['public']
  )

  test('prints each reference against its own schema and name', () => {
    expectClean(
      db,
      `
import type { Equal, Expect } from './helpers'
type P = SupabaseDatabase['public']
export type Declared = Expect<Equal<SupabaseDatabase['a.b']['Enums']['mood'], 'x' | 'y'>>
export type Other = Expect<Equal<SupabaseDatabase['a']['Enums']['b.mood'], 'z'>>
export type ColumnM = Expect<Equal<P['Tables']['t']['Row']['m'], 'x' | 'y'>>
export type ColumnN = Expect<Equal<P['Tables']['t']['Row']['n'], 'z'>>
export type ArgM = Expect<Equal<P['Functions']['echo_m']['Args'], { v: 'x' | 'y' }>>
export type ReturnN = Expect<Equal<P['Functions']['echo_n']['Returns'], 'z' | null>>
`
    )
  })
})

describe('a scalar rpc returning a type whose name holds a modifier', () => {
  test('reads the enum of that name, not the one the name without the modifier reaches', () => {
    const context = createSelectsContext({
      supplementary: supplementary({
        enums: [
          { schema: 'public', name: 'mood', labels: ['happy'] },
          { schema: 'public', name: 'mood(1)', labels: ['sad'] },
        ],
      }),
      plans: new Map(),
      traces: new Map(),
      jsonSchemas: new Map(),
    })
    const plan: CallPlan = {
      form: 'single-scalar',
      shape: null,
      rpc: null,
      routine: null,
      returns: callReturnsOf({
        returnType: {
          kind: 'scalar',
          multiplicity: 'single',
          type: { schema: 'public', name: 'mood(1)' },
        },
      }),
      filters: [],
      degraded: [],
    }
    const entry = printRpcEntry(context, 'f|public|current_mood|*', '*', [
      { keys: [], method: 'POST', outcome: { plan } },
    ])
    expect(entry?.body).toContain("row: SupabaseDatabase['public']['Enums']['mood(1)'] | null")
  })

  test('reads an array of a builtin as its element type', () => {
    const returns = callReturnsOf({
      returnType: {
        kind: 'scalar',
        multiplicity: 'setof',
        type: { schema: 'pg_catalog', name: '_int4' },
      },
    })
    expect(returns).toEqual({
      kind: 'scalar',
      multiplicity: 'setof',
      type: { name: 'int4', dims: 1 },
    })
  })
})

describe('a custom type named like a property of Object.prototype', () => {
  const names = ['constructor', 'toString', '__proto__']
  const db = printed(
    {
      relations: [
        table(
          'public',
          't',
          names.map((n, i) => column(`c${i}`, `analytics."${n}"`, i + 1))
        ),
      ],
      functions: [fn('echo', 'analytics.constructor')],
    },
    [['public.t', names.map((n, i) => plain('t', `c${i}`, `analytics."${n}"`))]],
    ['public']
  )

  test('is unknown, as any other custom type that is not an enum or a composite', () => {
    expectClean(
      db,
      `
import type { Equal, Expect } from './helpers'
type P = SupabaseDatabase['public']
export type C0 = Expect<Equal<P['Tables']['t']['Row']['c0'], unknown>>
export type C1 = Expect<Equal<P['Tables']['t']['Row']['c1'], unknown>>
export type C2 = Expect<Equal<P['Tables']['t']['Row']['c2'], unknown>>
export type Arg = Expect<Equal<P['Functions']['echo']['Args'], { v: unknown }>>
export type Return = Expect<Equal<P['Functions']['echo']['Returns'], unknown>>
`
    )
  })

  test('is unknown unqualified too', () => {
    const db = printed(
      {
        relations: [table('public', 't', [column('c', 'constructor', 1)])],
      },
      [['public.t', [plain('t', 'c', 'constructor')]]],
      ['public']
    )
    expectClean(
      db,
      `
import type { Equal, Expect } from './helpers'
export type C = Expect<Equal<SupabaseDatabase['public']['Tables']['t']['Row']['c'], unknown>>
`
    )
  })
})

describe('a CHECK constraint calling a function named like a property of Object.prototype', () => {
  test('is not read as a json schema check', async () => {
    const supplementary = {
      relations: [table('public', 't', [column('data', 'jsonb', 1)])],
      referencedRelations: [],
      jsonSchemaChecks: [
        {
          schema: 'public',
          table: 't',
          constraint: 't_data_check',
          definition: 'CHECK (constructor(\'{"type":"string"}\'::json, data))',
          columns: ['data'],
          validated: true,
        },
      ],
    } as unknown as Supplementary
    const input = await buildJsonSchemaInput(supplementary)
    expect(input.columns).toEqual([])
    expect(input.ignored).toEqual([
      expect.objectContaining({
        constraint: 't_data_check',
        reason: expect.stringContaining('not a call of json(b)_matches_schema'),
      }),
    ])
  })
})
