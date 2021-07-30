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
    assert.strictEqual(convertCell('int8', '10'), 10)

    assert.deepEqual(convertCell('_int4', '{1,2,3,4}'), [1, 2, 3, 4])
  })

  it('toArray', () => {
    assert.deepEqual(toArray('{1,2,3,4}', 'int4'), [1, 2, 3, 4])
    assert.deepEqual(toArray('{}', 'int4'), [])
  })

  it('toTimestampString', () => {
    assert.deepEqual(
      toTimestampString('2019-09-10 00:00:00'),
      '2019-09-10T00:00:00'
    )
  })
})
