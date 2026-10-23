import { jsonSchemaToTs } from '../src'

const ts = (schema: unknown) => jsonSchemaToTs(schema)

describe('jsonSchemaToTs: type', () => {
  it.each([
    [{ type: 'string' }, 'string'],
    [{ type: 'number' }, 'number'],
    [{ type: 'integer' }, 'number'],
    [{ type: 'boolean' }, 'boolean'],
    [{ type: 'null' }, 'null'],
    [{ type: ['string', 'null'] }, 'string | null'],
    [{ type: ['integer', 'number'] }, 'number'],
    [{ type: 'array' }, 'Json[]'],
    [{ type: 'object' }, '{ [k: string]: Json }'],
    [{ type: 'madeup' }, 'unknown'],
    [{ type: ['string', 'madeup'] }, 'unknown'],
  ])('%j -> %s', (schema, expected) => {
    expect(ts(schema)).toBe(expected)
  })

  it('treats schemas without a usable type as any JSON value', () => {
    expect(ts({})).toBe('Json')
    expect(ts(true)).toBe('Json')
    expect(ts({ minimum: 1, pattern: '^a', format: 'email', title: 'x', description: 'y' })).toBe(
      'Json'
    )
    // type-specific keywords do not constrain other types
    expect(ts({ properties: { a: { type: 'string' } }, required: ['a'] })).toBe('Json')
    expect(ts({ items: { type: 'string' } })).toBe('Json')
  })

  it('maps false to never and ignores narrowing-only keywords', () => {
    expect(ts(false)).toBe('never')
    expect(ts({ type: 'string', minLength: 3, maxLength: 9, pattern: 'x', format: 'uuid' })).toBe(
      'string'
    )
    expect(ts({ type: 'number', minimum: 0, exclusiveMaximum: 9, multipleOf: 2 })).toBe('number')
    expect(ts({ type: 'string', not: { const: 'x' } })).toBe('string')
    expect(ts({ type: 'string', if: {}, then: {}, else: {} })).toBe('string')
  })

  it('widens non-schema input to unknown', () => {
    expect(ts(null)).toBe('unknown')
    expect(ts('string')).toBe('unknown')
    expect(ts(42)).toBe('unknown')
    expect(ts([])).toBe('unknown')
  })
})

describe('jsonSchemaToTs: enum and const', () => {
  it('emits literal unions', () => {
    expect(ts({ enum: ['a', 'b', 1, true, null] })).toBe("'a' | 'b' | 1 | true | null")
    expect(ts({ const: 'x' })).toBe("'x'")
    expect(ts({ const: null })).toBe('null')
    expect(ts({ const: 1.5 })).toBe('1.5')
    expect(ts({ const: { a: 1, 'b-c': [true, 'x'] } })).toBe("{ a: 1; 'b-c': [true, 'x'] }")
    expect(ts({ const: [] })).toBe('[]')
    expect(ts({ const: {} })).toBe('{}')
  })

  it('escapes quotes, backslashes and control characters', () => {
    expect(ts({ const: "it's \\ \n\t\r \u0001  " })).toBe("'it\\'s \\\\ \\n\\t\\r \\u0001 \\u2028'")
  })

  it('filters enum members against a declared type and dedupes', () => {
    expect(ts({ type: 'string', enum: ['a', 1, 'a'] })).toBe("'a'")
    expect(ts({ type: 'integer', enum: [1, 1.5, 2] })).toBe('1 | 2')
    expect(ts({ type: ['string', 'null'], enum: ['a', null, 3] })).toBe("'a' | null")
    expect(ts({ type: 'string', enum: [1] })).toBe('never')
    expect(ts({ enum: [] })).toBe('never')
  })

  it('lets const win over type and enum', () => {
    expect(ts({ type: 'string', const: 'x', enum: ['y'] })).toBe("'x'")
  })
})

describe('jsonSchemaToTs: objects', () => {
  it('marks optional properties and adds a covering index signature', () => {
    expect(
      ts({
        type: 'object',
        properties: { a: { type: 'string' }, b: { type: 'integer' } },
        required: ['a'],
      })
    ).toBe('{ a: string; b?: number; [k: string]: Json | undefined }')
  })

  it('has no index signature value beyond the named ones for a closed object', () => {
    expect(
      ts({
        type: 'object',
        properties: { a: { type: 'string' }, b: { type: 'integer' } },
        required: ['a', 'b'],
        additionalProperties: false,
      })
    ).toBe('{ a: string; b: number }')
    expect(
      ts({
        type: 'object',
        properties: { a: { type: 'string' } },
        additionalProperties: false,
      })
    ).toBe('{ a?: string }')
    expect(ts({ type: 'object', additionalProperties: false })).toBe('{ [k: string]: never }')
  })

  it('unions the additionalProperties schema with the named property types', () => {
    expect(
      ts({
        type: 'object',
        properties: { a: { type: 'string' }, b: { type: 'integer' } },
        required: ['a', 'b'],
        additionalProperties: { type: 'boolean' },
      })
    ).toBe('{ a: string; b: number; [k: string]: boolean | string | number }')
    expect(ts({ type: 'object', additionalProperties: { type: 'string' } })).toBe(
      '{ [k: string]: string }'
    )
    expect(ts({ type: 'object', additionalProperties: true })).toBe('{ [k: string]: Json }')
  })

  it('keeps JSON-typed named properties out of the Json index signature', () => {
    expect(
      ts({
        type: 'object',
        properties: { a: { type: 'string' } },
        required: ['a'],
      })
    ).toBe('{ a: string; [k: string]: Json }')
  })

  it('widens named properties that are not JSON into the index signature', () => {
    expect(
      ts({
        type: 'object',
        properties: { a: { type: 'madeup' } },
        required: ['a'],
      })
    ).toBe('{ a: unknown; [k: string]: unknown }')
  })

  it('widens the open positions to unknown when patternProperties is present', () => {
    expect(
      ts({
        type: 'object',
        properties: { a: { type: 'string' } },
        patternProperties: { '^x-': { type: 'number' } },
        additionalProperties: false,
      })
    ).toBe('{ a?: string; [k: string]: unknown }')
  })

  it('types required names that have no properties entry from the open positions', () => {
    expect(ts({ type: 'object', required: ['x'] })).toBe('{ x: Json; [k: string]: Json }')
    expect(ts({ type: 'object', required: ['x'], additionalProperties: false })).toBe('{ x: Json }')
    expect(ts({ type: 'object', required: ['x'], additionalProperties: { type: 'string' } })).toBe(
      '{ x: string; [k: string]: string }'
    )
  })

  it('quotes property names that are not identifiers', () => {
    expect(
      ts({
        type: 'object',
        properties: {
          'a-b': { type: 'string' },
          ok_1: { type: 'string' },
          '1x': { type: 'string' },
        },
        required: ['a-b', 'ok_1', '1x'],
        additionalProperties: false,
      })
    ).toBe("{ 'a-b': string; ok_1: string; '1x': string }")
  })

  it('handles nested objects and arrays of objects', () => {
    expect(
      ts({
        type: 'object',
        properties: {
          tags: { type: 'array', items: { type: 'string' } },
          owner: {
            type: 'object',
            properties: { id: { type: 'integer' } },
            required: ['id'],
            additionalProperties: false,
          },
        },
        required: ['tags', 'owner'],
        additionalProperties: false,
      })
    ).toBe('{ tags: string[]; owner: { id: number } }')
  })
})

describe('jsonSchemaToTs: arrays', () => {
  it('types items and parenthesizes unions in element position', () => {
    expect(ts({ type: 'array', items: { type: 'string' } })).toBe('string[]')
    expect(ts({ type: 'array', items: { type: ['string', 'number'] } })).toBe('(string | number)[]')
    expect(ts({ type: 'array', items: true })).toBe('Json[]')
    expect(ts({ type: 'array', items: false })).toBe('[]')
    expect(ts({ type: 'array', items: { type: 'array', items: { type: 'integer' } } })).toBe(
      'number[][]'
    )
    expect(ts({ type: 'array', minItems: 1, uniqueItems: true, maxItems: 4 })).toBe('Json[]')
  })

  it('emits tuples for prefixItems and for array-form items', () => {
    expect(
      ts({ type: 'array', prefixItems: [{ type: 'string' }, { type: 'number' }], items: false })
    ).toBe('[string?, number?]')
    expect(
      ts({
        type: 'array',
        prefixItems: [{ type: 'string' }, { type: 'number' }],
        minItems: 2,
        items: false,
      })
    ).toBe('[string, number]')
    expect(
      ts({
        type: 'array',
        prefixItems: [{ type: 'string' }, { type: 'number' }],
        minItems: 1,
        items: { type: 'boolean' },
      })
    ).toBe('[string, number?, ...boolean[]]')
    expect(
      ts({ type: 'array', items: [{ type: 'string' }], minItems: 1, additionalItems: false })
    ).toBe('[string]')
    expect(ts({ type: 'array', items: [{ type: 'string' }], minItems: 1 })).toBe(
      '[string, ...Json[]]'
    )
    expect(
      ts({ type: 'array', prefixItems: [{ type: ['string', 'null'] }], minItems: 5, items: false })
    ).toBe('[string | null]')
  })

  it('widens an element that is not JSON', () => {
    expect(ts({ type: 'array', items: { type: 'madeup' } })).toBe('unknown[]')
  })
})

describe('jsonSchemaToTs: composition', () => {
  it('unions anyOf and oneOf', () => {
    expect(ts({ anyOf: [{ type: 'string' }, { type: 'null' }] })).toBe('string | null')
    expect(ts({ oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'string' }] })).toBe(
      'string | number'
    )
    expect(ts({ anyOf: [{ type: 'string' }, {}] })).toBe('string | Json')
    expect(ts({ anyOf: [{ type: 'string' }, { type: 'madeup' }] })).toBe('unknown')
    expect(ts({ anyOf: [{ const: 'a' }, false] })).toBe("'a'")
    expect(ts({ anyOf: [] })).toBe('Json')
  })

  it('parenthesizes unions inside arrays', () => {
    expect(ts({ type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'null' }] } })).toBe(
      '(string | null)[]'
    )
  })

  it('intersects allOf members', () => {
    expect(
      ts({
        allOf: [
          { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
          { type: 'object', properties: { b: { type: 'number' } }, required: ['b'] },
        ],
      })
    ).toBe('{ a: string; [k: string]: Json } & { b: number; [k: string]: Json }')
    expect(ts({ allOf: [{ type: 'string' }, { type: 'string' }] })).toBe('string')
    expect(ts({ allOf: [{ type: 'string' }, {}] })).toBe('string')
    expect(ts({ allOf: [{ type: 'string' }, false] })).toBe('never')
    expect(ts({ allOf: [{ type: 'string' }, { type: 'madeup' }] })).toBe('string')
  })

  it('combines a base type with anyOf and allOf', () => {
    expect(ts({ type: 'string', anyOf: [{ const: 'a' }, { const: 'b' }] })).toBe(
      "string & ('a' | 'b')"
    )
    expect(ts({ type: 'object', allOf: [{ required: ['x'] }] })).toBe('{ [k: string]: Json }')
  })

  it('ignores not, if/then/else and dependent keywords', () => {
    expect(ts({ not: { type: 'string' } })).toBe('Json')
    expect(ts({ if: { type: 'string' }, then: { type: 'number' } })).toBe('Json')
  })
})

describe('jsonSchemaToTs: nullable', () => {
  it('adds null for OpenAPI-style nullable', () => {
    expect(ts({ type: 'string', nullable: true })).toBe('string | null')
    expect(ts({ type: 'string', nullable: false })).toBe('string')
    expect(ts({ nullable: true })).toBe('Json')
    expect(ts({ type: ['string', 'null'], nullable: true })).toBe('string | null')
  })
})

describe('jsonSchemaToTs: $ref', () => {
  const root = {
    $defs: {
      id: { type: 'integer' },
      user: {
        type: 'object',
        properties: { id: { $ref: '#/$defs/id' }, friend: { $ref: '#/$defs/user' } },
        required: ['id'],
        additionalProperties: false,
      },
      'a/b': { type: 'string' },
      'c~d': { type: 'boolean' },
      'e f': { type: 'null' },
    },
    definitions: { legacy: { type: 'string' } },
    prefix: [{ type: 'number' }],
  }

  it('resolves local pointers, including escapes and array indexes', () => {
    expect(ts({ ...root, $ref: '#/$defs/id' })).toBe('number')
    expect(ts({ ...root, $ref: '#/$defs/a~1b' })).toBe('string')
    expect(ts({ ...root, $ref: '#/$defs/c~0d' })).toBe('boolean')
    expect(ts({ ...root, $ref: '#/$defs/e%20f' })).toBe('null')
    expect(ts({ ...root, $ref: '#/definitions/legacy' })).toBe('string')
    expect(ts({ ...root, $ref: '#/prefix/0' })).toBe('number')
    expect(ts({ ...root, $ref: '#' })).toBe('unknown')
  })

  it('widens a recursive reference to unknown at the cycle', () => {
    expect(ts({ ...root, $ref: '#/$defs/user' })).toBe('{ id: number; friend?: unknown }')
  })

  it('widens unresolvable, remote and malformed references to unknown', () => {
    expect(ts({ ...root, $ref: '#/$defs/missing' })).toBe('unknown')
    expect(ts({ ...root, $ref: 'https://example.com/schema.json' })).toBe('unknown')
    expect(ts({ ...root, $ref: 'other.json#/x' })).toBe('unknown')
    expect(ts({ ...root, $ref: '#/prefix/x' })).toBe('unknown')
    expect(ts({ ...root, $ref: '#/prefix/-1' })).toBe('unknown')
    expect(ts({ ...root, $ref: '#/$defs/%E0' })).toBe('unknown')
    expect(ts({ ...root, $ref: 7 })).toBe('unknown')
  })

  it('treats $ref siblings as ignored', () => {
    expect(ts({ ...root, $ref: '#/$defs/id', type: 'string' })).toBe('number')
  })
})

describe('jsonSchemaToTs: options and limits', () => {
  it('uses the configured JSON type name', () => {
    expect(jsonSchemaToTs({ type: 'array' }, { jsonType: 'MyJson' })).toBe('MyJson[]')
    expect(jsonSchemaToTs({}, { jsonType: 'MyJson' })).toBe('MyJson')
    expect(
      jsonSchemaToTs(
        { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
        { jsonType: 'MyJson' }
      )
    ).toBe('{ a: string; [k: string]: MyJson }')
  })

  it('widens schemas nested deeper than the limit to unknown without overflowing the stack', () => {
    let schema: Record<string, unknown> = { type: 'string' }
    for (let i = 0; i < 200; i++) schema = { type: 'array', items: schema }
    const out = ts(schema)
    expect(out.endsWith('unknown' + '[]'.repeat(65))).toBe(true)
  })

  it('is deterministic and does not mutate its input', () => {
    const schema = { type: 'object', properties: { b: { type: 'string' }, a: { type: 'number' } } }
    const copy = JSON.parse(JSON.stringify(schema))
    expect(ts(schema)).toBe(ts(copy))
    expect(schema).toEqual(copy)
    expect(ts(schema)).toBe('{ b?: string; a?: number; [k: string]: Json | undefined }')
  })
})
