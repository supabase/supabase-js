import assert from 'assert'

import {
  convertCell,
  convertChangeData,
  convertColumn,
  toArray,
  toTimestampString,
} from '../dist/main/lib/transformers.js'

describe('transformers', () => {
  it('convertChangeData', () => {
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
  })

  it('convertColumn', () => {
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

  it('convertCell', () => {
    assert.strictEqual(convertCell('bool', 't'), true)
    assert.strictEqual(convertCell('bool', true), true)

    assert.strictEqual(convertCell('int8', '10'), 10)
    assert.strictEqual(convertCell('int8', 10), 10)

    assert.strictEqual(convertCell('numeric', '12345.12345'), 12345.12345)
    assert.strictEqual(convertCell('numeric', 12345.12345), 12345.12345)

    assert.strictEqual(convertCell('int4range', '[1,10)'), '[1,10)')

    assert.strictEqual(convertCell('float8', null), null)

    assert.strictEqual(convertCell('json', '"[1,2,3]"'), '[1,2,3]')

    assert.deepEqual(convertCell('_int4', '{1,2,3,4}'), [1, 2, 3, 4])
  })

  it('toArray', () => {
    assert.deepEqual(toArray('{}', 'int4'), [])
    assert.deepEqual(toArray('{1,2,3,4}', 'int4'), [1, 2, 3, 4])
    assert.deepEqual(
      toArray(
        '{"[2021-01-01,2021-12-31)","(2021-01-01,2021-12-32]"}',
        'daterange'
      ),
      ['[2021-01-01,2021-12-31)', '(2021-01-01,2021-12-32]']
    )
    assert.deepEqual(toArray('{a,b,c}', 'text'), ['a', 'b', 'c'])
    assert.deepEqual(
      toArray([99, 999, 9999, 99999], 'int8'),
      [99, 999, 9999, 99999]
    )
  })

  it('toTimestampString', () => {
    assert.deepEqual(
      toTimestampString('2019-09-10 00:00:00'),
      '2019-09-10T00:00:00'
    )
  })
})
