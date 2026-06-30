import { describe, test, expect } from 'vitest'
import {
  RealtimePostgresFilterBuilder,
  postgresChangesFilter,
} from '../src/RealtimePostgresFilterBuilder'

describe('RealtimePostgresFilterBuilder', () => {
  test('postgresChangesFilter() returns a fresh builder instance each call', () => {
    expect(postgresChangesFilter()).toBeInstanceOf(RealtimePostgresFilterBuilder)
    expect(postgresChangesFilter()).not.toBe(postgresChangesFilter())
  })

  test('empty builder serializes to an empty string', () => {
    expect(postgresChangesFilter().build()).toBe('')
    expect(postgresChangesFilter().toString()).toBe('')
  })

  describe('comparison operators', () => {
    test.each([
      ['eq', postgresChangesFilter().eq('id', 1), 'id=eq.1'],
      ['neq', postgresChangesFilter().neq('id', 1), 'id=neq.1'],
      ['gt', postgresChangesFilter().gt('age', 18), 'age=gt.18'],
      ['gte', postgresChangesFilter().gte('age', 18), 'age=gte.18'],
      ['lt', postgresChangesFilter().lt('age', 65), 'age=lt.65'],
      ['lte', postgresChangesFilter().lte('age', 65), 'age=lte.65'],
      ['like', postgresChangesFilter().like('title', '%foo%'), 'title=like.%foo%'],
      ['ilike', postgresChangesFilter().ilike('title', '%FOO%'), 'title=ilike.%FOO%'],
      ['match', postgresChangesFilter().match('title', '^foo'), 'title=match.^foo'],
      ['imatch', postgresChangesFilter().imatch('title', '^foo'), 'title=imatch.^foo'],
      ['isdistinct', postgresChangesFilter().isDistinct('value', 1), 'value=isdistinct.1'],
    ])('%s serializes correctly', (_name, builder, expected) => {
      expect(builder.build()).toBe(expected)
    })
  })

  describe('value types', () => {
    test.each([
      ['integer', postgresChangesFilter().eq('n', 42), 'n=eq.42'],
      ['zero', postgresChangesFilter().eq('n', 0), 'n=eq.0'],
      ['negative', postgresChangesFilter().gt('balance', -100), 'balance=gt.-100'],
      ['decimal', postgresChangesFilter().lt('price', 9.99), 'price=lt.9.99'],
      ['boolean true', postgresChangesFilter().eq('active', true), 'active=eq.true'],
      ['boolean false', postgresChangesFilter().eq('active', false), 'active=eq.false'],
      ['null', postgresChangesFilter().eq('deleted', null), 'deleted=eq.null'],
      ['empty string', postgresChangesFilter().eq('note', ''), 'note=eq.'],
      ['plain string', postgresChangesFilter().eq('name', 'Realtime'), 'name=eq.Realtime'],
    ])('%s', (_name, builder, expected) => {
      expect(builder.build()).toBe(expected)
    })
  })

  describe('verbatim values (no reserved characters)', () => {
    test('keeps internal spaces verbatim — does NOT quote', () => {
      expect(postgresChangesFilter().eq('status', 'in progress').build()).toBe(
        'status=eq.in progress'
      )
    })

    test('keeps apostrophes verbatim', () => {
      expect(postgresChangesFilter().eq('name', "O'Brien").build()).toBe("name=eq.O'Brien")
    })

    test('keeps unicode verbatim', () => {
      expect(postgresChangesFilter().eq('city', 'São Paulo').build()).toBe('city=eq.São Paulo')
    })
  })

  describe('quoting reserved characters (PostgREST-style)', () => {
    test('quotes a value containing a comma so it does not split the filter', () => {
      expect(postgresChangesFilter().eq('name', 'a,b').build()).toBe('name=eq."a,b"')
    })

    test('quotes a regex whose quantifier contains a comma', () => {
      expect(postgresChangesFilter().match('code', 'a{1,2}').build()).toBe('code=match."a{1,2}"')
    })

    test('quotes a value containing parentheses', () => {
      expect(postgresChangesFilter().match('code', '^(a|b)$').build()).toBe('code=match."^(a|b)$"')
    })

    test('escapes embedded double quotes', () => {
      expect(postgresChangesFilter().eq('name', 'say "hi"').build()).toBe('name=eq."say \\"hi\\""')
    })

    test('escapes embedded backslashes', () => {
      expect(postgresChangesFilter().eq('path', 'C:\\tmp').build()).toBe('path=eq."C:\\\\tmp"')
    })

    test('quotes a value with surrounding whitespace (server trims unquoted)', () => {
      expect(postgresChangesFilter().eq('name', ' a ').build()).toBe('name=eq." a "')
    })

    test.each([
      // [description, value, expected serialized string]
      ['LIKE % wildcard', '50%', 'path=eq.50%'],
      ['LIKE _ wildcard', 'a_b', 'path=eq.a_b'],
      ['equals sign in value', '1=1', 'path=eq.1=1'],
      ['dot in value', 'eq.value', 'path=eq.eq.value'],
      ['colon in value', 'a:b', 'path=eq.a:b'],
      ['ampersand in value', 'a&b', 'path=eq.a&b'],
    ])('%s is passed through unquoted', (_desc, value, expected) => {
      expect(postgresChangesFilter().eq('path', value).build()).toBe(expected)
    })

    test('LIKE pattern wildcards (% and _) are kept verbatim', () => {
      expect(postgresChangesFilter().like('name', 'jo_n%').build()).toBe('name=like.jo_n%')
    })

    test('unquoted values survive AND composition', () => {
      expect(postgresChangesFilter().eq('a', '100%').like('b', 'x_y').build()).toBe(
        'a=eq.100%,b=like.x_y'
      )
    })

    test('quotes only the in() elements that contain reserved chars', () => {
      expect(postgresChangesFilter().in('tag', ['a%b', 'c_d', 'e\\f']).build()).toBe(
        'tag=in.(a%b,c_d,"e\\\\f")'
      )
    })
  })

  describe('is operator', () => {
    test.each([
      [null, 'deleted_at=is.null'],
      [true, 'deleted_at=is.true'],
      [false, 'deleted_at=is.false'],
      ['null', 'deleted_at=is.null'],
      ['true', 'deleted_at=is.true'],
      ['false', 'deleted_at=is.false'],
      ['unknown', 'deleted_at=is.unknown'],
    ] as const)('is(%s)', (value, expected) => {
      expect(postgresChangesFilter().is('deleted_at', value).build()).toBe(expected)
    })
  })

  describe('in operator', () => {
    test('serializes an array into parentheses', () => {
      expect(postgresChangesFilter().in('status', ['active', 'pending']).build()).toBe(
        'status=in.(active,pending)'
      )
    })

    test('serializes a single-element array', () => {
      expect(postgresChangesFilter().in('id', [1]).build()).toBe('id=in.(1)')
    })

    test('throws on an empty array', () => {
      expect(() => postgresChangesFilter().in('id', [])).toThrow(/at least one value/)
    })

    test('quotes an element containing a comma', () => {
      expect(postgresChangesFilter().in('label', ['a,b', 'c']).build()).toBe('label=in.("a,b",c)')
    })

    test('serializes a numeric array', () => {
      expect(postgresChangesFilter().in('id', [1, 2, 3]).build()).toBe('id=in.(1,2,3)')
    })

    test('removes duplicate values', () => {
      expect(postgresChangesFilter().in('id', [1, 1, 2]).build()).toBe('id=in.(1,2)')
    })

    test('treats distinct types as distinct when de-duplicating', () => {
      // 1 (number) and '1' (string) serialize the same but Set keeps both
      expect(postgresChangesFilter().in('id', [1, '1']).build()).toBe('id=in.(1,1)')
    })

    test('serializes booleans in a list', () => {
      expect(postgresChangesFilter().in('flag', [true, false]).build()).toBe('flag=in.(true,false)')
    })
  })

  describe('not (negation)', () => {
    test.each([
      [postgresChangesFilter().not('status', 'eq', 'draft'), 'status=not.eq.draft'],
      [postgresChangesFilter().not('id', 'gt', 5), 'id=not.gt.5'],
      [postgresChangesFilter().not('title', 'like', '%foo%'), 'title=not.like.%foo%'],
      [postgresChangesFilter().not('title', 'ilike', '%foo%'), 'title=not.ilike.%foo%'],
      [postgresChangesFilter().not('deleted_at', 'is', null), 'deleted_at=not.is.null'],
      [postgresChangesFilter().not('flag', 'is', true), 'flag=not.is.true'],
      [postgresChangesFilter().not('flag', 'is', 'unknown'), 'flag=not.is.unknown'],
      [
        postgresChangesFilter().not('status', 'in', ['draft', 'archived']),
        'status=not.in.(draft,archived)',
      ],
      [postgresChangesFilter().not('id', 'in', [1, 2]), 'id=not.in.(1,2)'],
    ])('serializes negated operators', (builder, expected) => {
      expect(builder.build()).toBe(expected)
    })
  })

  describe('AND composition', () => {
    test('joins multiple conditions with commas', () => {
      expect(postgresChangesFilter().eq('id', 1).lt('age', 30).build()).toBe('id=eq.1,age=lt.30')
    })

    test('composes many conditions of mixed operators', () => {
      const built = postgresChangesFilter()
        .eq('schema', 'public')
        .gte('age', 18)
        .in('status', ['active', 'pending'])
        .like('name', '%a%')
        .not('deleted_at', 'is', null)
        .build()
      expect(built).toBe(
        'schema=eq.public,age=gte.18,status=in.(active,pending),name=like.%a%,deleted_at=not.is.null'
      )
    })

    test('repeats the same column (server applies all as AND)', () => {
      expect(postgresChangesFilter().gt('age', 18).lt('age', 65).build()).toBe(
        'age=gt.18,age=lt.65'
      )
    })

    test('an in() condition is not split because its commas are inside parens', () => {
      // mirrors the server scanner: commas inside (...) do not break segments
      const built = postgresChangesFilter().in('id', [1, 2, 3]).eq('details', 'active').build()
      expect(built).toBe('id=in.(1,2,3),details=eq.active')
      expect(built.split(',').length).toBe(4) // naive split sees 4; server splits to 2
    })
  })

  describe('builder reuse & immutability of output', () => {
    test('build() is idempotent', () => {
      const builder = postgresChangesFilter().eq('id', 1)
      expect(builder.build()).toBe('id=eq.1')
      expect(builder.build()).toBe('id=eq.1')
    })

    test('build() reflects conditions added after a previous build()', () => {
      const builder = postgresChangesFilter().eq('id', 1)
      expect(builder.build()).toBe('id=eq.1')
      builder.gt('age', 18)
      expect(builder.build()).toBe('id=eq.1,age=gt.18')
    })

    test('chaining returns the same instance', () => {
      const builder = postgresChangesFilter()
      expect(builder.eq('id', 1)).toBe(builder)
    })

    test('toString() equals build() and works in template strings', () => {
      const builder = postgresChangesFilter().eq('id', 1).eq('active', true)
      expect(`${builder}`).toBe(builder.build())
      expect(String(builder)).toBe('id=eq.1,active=eq.true')
    })
  })
})
