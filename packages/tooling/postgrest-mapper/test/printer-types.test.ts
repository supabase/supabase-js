import { normalizeType, tsTypeOf, type TypeContext } from '../src'

/** The pg to TS mapping is a pure table; everything else of the printer is covered through the consumer type-check. */
const ctx: TypeContext = {
  enums: new Set(['public.user_status', 'personal.user_status']),
  composites: new Set(['public.address']),
  relations: new Map([
    [
      'public.users',
      [
        { name: 'id', type: 'int4' },
        { name: 'status', type: 'public.user_status' },
      ],
    ],
    ['public.active_users', [{ name: 'odd name', type: 'text' }]],
    ['public.nothing', []],
  ]),
  domains: new Map([
    ['public.positive_int', 'int4'],
    ['public.tags', 'text[]'],
  ]),
}

const DB = 'SupabaseDatabase'

const TABLE: [string, string][] = [
  // builtins, internal and format_type spellings
  ['bool', 'boolean'],
  ['boolean', 'boolean'],
  ['int2', 'number'],
  ['smallint', 'number'],
  ['int4', 'number'],
  ['integer', 'number'],
  ['int8', 'number'],
  ['bigint', 'number'],
  ['float4', 'number'],
  ['real', 'number'],
  ['float8', 'number'],
  ['double precision', 'number'],
  ['numeric', 'number'],
  ['numeric(10,2)', 'number'],
  ['text', 'string'],
  ['varchar', 'string'],
  ['character varying(255)', 'string'],
  ['bpchar', 'string'],
  ['character(3)', 'string'],
  ['uuid', 'string'],
  ['bytea', 'string'],
  ['date', 'string'],
  ['timestamptz', 'string'],
  ['timestamp with time zone', 'string'],
  ['timestamp(3) without time zone', 'string'],
  ['time with time zone', 'string'],
  ['extensions.citext', 'string'],
  ['extensions.vector', 'string'],
  ['json', 'Json'],
  ['jsonb', 'Json'],
  ['void', 'undefined'],
  ['record', 'Record<string, unknown>'],
  // no TS counterpart gen types commits to
  ['tsvector', 'unknown'],
  ['int4range', 'unknown'],
  ['inet', 'unknown'],
  ['interval', 'unknown'],
  // arrays: external, internal and multi-dimensional spellings
  ['text[]', 'string[]'],
  ['_int4', 'number[]'],
  ['integer[]', 'number[]'],
  ['jsonb[]', 'Json[]'],
  ['int4[][]', 'number[][]'],
  // enums, composites and rows reference the emitted database
  ['public.user_status', `${DB}['public']['Enums']['user_status']`],
  ['user_status', `${DB}['public']['Enums']['user_status']`],
  ['personal.user_status', `${DB}['personal']['Enums']['user_status']`],
  ['public.user_status[]', `${DB}['public']['Enums']['user_status'][]`],
  ['public.address', `${DB}['public']['CompositeTypes']['address']`],
  // a relation used as a type is a composite value: its attributes are all nullable, whatever the table enforces
  ['public.users', `{ id: number | null; status: ${DB}['public']['Enums']['user_status'] | null }`],
  [
    'public.users[]',
    `({ id: number | null; status: ${DB}['public']['Enums']['user_status'] | null })[]`,
  ],
  ['public.active_users', `{ 'odd name': string | null }`],
  ['public.nothing', '{ [_ in never]: never }'],
  // domains resolve to what they are defined over
  ['public.positive_int', 'number'],
  ['public.tags', 'string[]'],
  ['public.tags[]', 'string[][]'],
  // a type nobody described
  ['public.mystery', 'unknown'],
]

describe('pg type to TypeScript type', () => {
  test.each(TABLE)('%s -> %s', (pg, ts) => {
    expect(tsTypeOf(pg, ctx)).toBe(ts)
  })

  test('json prints as JsonIn when asked (function arguments)', () => {
    expect(tsTypeOf('jsonb', { ...ctx, jsonType: 'JsonIn' })).toBe('JsonIn')
    expect(tsTypeOf('json[]', { ...ctx, jsonType: 'JsonIn' })).toBe('JsonIn[]')
  })

  test('names are normalised without losing the schema or the dimensions', () => {
    expect(normalizeType('character varying(20)[]')).toEqual({ name: 'varchar', dims: 1 })
    expect(normalizeType('"MyType"')).toEqual({ name: 'MyType', dims: 0 })
    expect(normalizeType('public."Odd Name"[][]')).toEqual({
      schema: 'public',
      name: 'Odd Name',
      dims: 2,
    })
    expect(normalizeType('timestamp(3) with time zone')).toEqual({ name: 'timestamptz', dims: 0 })
  })

  test('dots, modifiers and quotes inside a quoted name belong to the name', () => {
    expect(normalizeType('public."mood(1)"')).toEqual({
      schema: 'public',
      name: 'mood(1)',
      dims: 0,
    })
    expect(normalizeType('"mood(1)"[]')).toEqual({ name: 'mood(1)', dims: 1 })
    expect(normalizeType('public."a.b"')).toEqual({ schema: 'public', name: 'a.b', dims: 0 })
    expect(normalizeType('"public.a".b')).toEqual({ schema: 'public.a', name: 'b', dims: 0 })
    expect(normalizeType('public."say ""hi"""')).toEqual({
      schema: 'public',
      name: 'say "hi"',
      dims: 0,
    })
    expect(normalizeType('"integer"')).toEqual({ name: 'integer', dims: 0 })
  })
})
