import assert from 'assert'
import { test } from 'vitest'

import {
  convertCell,
  convertChangeData,
  convertColumn,
  toArray,
  httpEndpointURL,
  toJson,
  toTimestampString,
} from '../src/lib/transformers'

test('convertChangeData', () => {
  assert.deepEqual(
    convertChangeData(
      [
        { name: 'first_name', type: 'text' },
        { name: 'age', type: 'int4' },
      ],
      { first_name: 'Paul', age: '33' },
      {}
    ),
    { first_name: 'Paul', age: 33 }
  )

  assert.deepEqual(
    convertChangeData(
      [
        { name: 'first_name', type: 'text' },
        { name: 'age', type: 'int4' },
      ],
      { first_name: 'Mark', age: 23 },
      {}
    ),
    { first_name: 'Mark', age: 23 }
  )

  assert.deepEqual(
    convertChangeData(
      [
        { name: 'first_name', type: 'text' },
        { name: 'age', type: 'int4' },
      ],
      { first_name: 'Paul', age: null },
      {}
    ),
    { first_name: 'Paul', age: null }
  )

  assert.deepEqual(
    convertChangeData(
      [
        { name: 'first_name', type: 'text' },
        { name: 'age', type: 'int4' },
      ],
      null,
      {}
    ),
    {}
  )
})

test('convertColumn', () => {
  assert.strictEqual(
    convertColumn(
      'age',
      [
        { name: 'first_name', type: 'text' },
        { name: 'age', type: 'int4' },
      ],
      { first_name: 'Paul', age: '33' },
      []
    ),
    33
  )
  assert.strictEqual(
    convertColumn(
      'age',
      [
        { name: 'first_name', type: 'text' },
        { name: 'age', type: 'int4' },
      ],
      { first_name: 'Paul', age: '33' },
      ['int4']
    ),
    '33'
  )
})

test('convertCell', () => {
  assert.strictEqual(convertCell('bool', 't'), true)
  assert.strictEqual(convertCell('bool', 'f'), false)
  assert.strictEqual(convertCell('bool', true), true)

  assert.strictEqual(convertCell('float4', '3.14'), 3.14)
  assert.strictEqual(convertCell('int8', '10'), 10)
  assert.strictEqual(convertCell('int8', 10), 10)

  assert.strictEqual(convertCell('numeric', '12345.12345'), 12345.12345)
  assert.strictEqual(convertCell('numeric', 12345.12345), 12345.12345)

  assert.strictEqual(convertCell('int4range', '[1,10)'), '[1,10)')

  assert.strictEqual(convertCell('float8', null), null)

  assert.strictEqual(convertCell('json', '"[1,2,3]"'), '[1,2,3]')
  assert.strictEqual(convertCell('json', 'invalid'), 'invalid') // JSON parse error

  assert.deepEqual(convertCell('_int4', '{1,2,3,4}'), [1, 2, 3, 4])

  // Test uncovered branches
  assert.strictEqual(convertCell('timestamp', '2021-01-01 12:00:00'), '2021-01-01T12:00:00')
  assert.strictEqual(convertCell('unknown_type', 'value'), 'value')
})

test('toArray', () => {
  assert.deepEqual(toArray('{}', 'int4'), [])
  assert.deepEqual(toArray('{1,2,3,4}', 'int4'), [1, 2, 3, 4])
  assert.deepEqual(toArray('{"[2021-01-01,2021-12-31)","(2021-01-01,2021-12-32]"}', 'daterange'), [
    '[2021-01-01,2021-12-31)',
    '(2021-01-01,2021-12-32]',
  ])
  assert.deepEqual(toArray('{a,b,c}', 'text'), ['a', 'b', 'c'])
  assert.deepEqual(toArray([99, 999, 9999, 99999], 'int8'), [99, 999, 9999, 99999])

  // Test non-string input to cover the return statement
  assert.strictEqual(toArray(null, 'int4'), null)
  assert.strictEqual(toArray(123, 'int4'), 123)
})

test('toTimestampString', () => {
  assert.deepEqual(toTimestampString('2019-09-10 00:00:00'), '2019-09-10T00:00:00')
  // Test non-string input to cover uncovered branch
  assert.deepEqual(toTimestampString(123), 123)
  assert.deepEqual(toTimestampString(null), null)
})

test('toJson with non-string values', () => {
  assert.strictEqual(toJson(123), 123)
  assert.strictEqual(toJson(null), null)
  assert.strictEqual(toJson(true), true)
  assert.deepEqual(toJson({ foo: 'bar' }), { foo: 'bar' })
  assert.deepEqual(toJson([1, 2, 3]), [1, 2, 3])
})

test('toArray with non-array strings', () => {
  assert.strictEqual(toArray('not an array', 'text'), 'not an array')
  assert.strictEqual(toArray('simple string', 'int4'), 'simple string')
  assert.strictEqual(toArray('no braces here', 'json'), 'no braces here')
  assert.strictEqual(toArray('missing_closing', 'text'), 'missing_closing')
  assert.strictEqual(toArray('missing_opening}', 'text'), 'missing_opening}')
})

test('httpEndpointURL', () => {
  // Test basic ws to http conversion
  assert.strictEqual(
    httpEndpointURL('ws://example.com/socket/websocket'),
    'http://example.com/api/broadcast'
  )

  // Test wss to https conversion
  assert.strictEqual(
    httpEndpointURL('wss://example.com/socket/websocket'),
    'https://example.com/api/broadcast'
  )

  // Test with /socket path
  assert.strictEqual(httpEndpointURL('ws://example.com/socket'), 'http://example.com/api/broadcast')

  // Test with /websocket path
  assert.strictEqual(
    httpEndpointURL('ws://example.com/websocket'),
    'http://example.com/api/broadcast'
  )

  // Test with trailing slash
  assert.strictEqual(
    httpEndpointURL('ws://example.com/socket/websocket/'),
    'http://example.com/api/broadcast'
  )

  // Test with port number
  assert.strictEqual(
    httpEndpointURL('ws://example.com:8080/socket/websocket'),
    'http://example.com:8080/api/broadcast'
  )

  // Test with path prefix
  assert.strictEqual(
    httpEndpointURL('ws://example.com/prefix/socket/websocket'),
    'http://example.com/prefix/api/broadcast'
  )

  // Test with query parameters
  assert.strictEqual(
    httpEndpointURL('ws://example.com/socket/websocket?apikey=test'),
    'http://example.com/api/broadcast?apikey=test'
  )

  // Test already http protocol (should remain unchanged)
  assert.strictEqual(
    httpEndpointURL('http://example.com/socket/websocket'),
    'http://example.com/api/broadcast'
  )

  // Test already https protocol (should remain unchanged)
  assert.strictEqual(
    httpEndpointURL('https://example.com/socket/websocket'),
    'https://example.com/api/broadcast'
  )

  // Test with multiple trailing slashes
  assert.strictEqual(
    httpEndpointURL('ws://example.com/socket/websocket///'),
    'http://example.com/api/broadcast'
  )

  // Test with no websocket-specific paths
  assert.strictEqual(
    httpEndpointURL('ws://example.com/some/path'),
    'http://example.com/some/path/api/broadcast'
  )
})
