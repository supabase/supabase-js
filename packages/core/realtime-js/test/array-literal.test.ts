import { describe, expect, test } from 'vitest'
import { toArray } from '../src/lib/transformers'

// Postgres quotes an array element whenever it is empty, spells `NULL`, or
// contains a delimiter, brace, quote, backslash or whitespace — so a single
// literal routinely mixes quoted and unquoted elements.
describe('toArray with quoted and unquoted elements mixed', () => {
  test.each([
    ['{"a,b",c}', ['a,b', 'c']],
    ['{"hello world",plain}', ['hello world', 'plain']],
    ['{plain,"hello world"}', ['plain', 'hello world']],
    ['{"x\\"y",z}', ['x"y', 'z']],
    ['{"e\\\\f",z}', ['e\\f', 'z']],
    ['{"p{q",z}', ['p{q', 'z']],
    ['{"",z}', ['', 'z']],
  ])('parses %s', (literal, expected) => {
    expect(toArray(literal, 'text')).toEqual(expected)
  })

  test('an unquoted NULL is the null element', () => {
    expect(toArray('{a,NULL,b}', 'text')).toEqual(['a', null, 'b'])
  })

  test('a quoted NULL is the four-character string', () => {
    expect(toArray('{"NULL"}', 'text')).toEqual(['NULL'])
  })
})
