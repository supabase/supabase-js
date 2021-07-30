import doctest from '@supabase/doctest-js'
import assert from 'assert'
import {
  convertColumn,
} from '../dist/main/lib/transformers'

describe('Doctests', () => {
  // file paths are relative to root of directory
  doctest('dist/main/lib/transformers.js')
})

describe('transformers', () => {
  it('convertColumn', () => {
    assert.strictEqual(
      convertColumn(
        'age',
        [
          { name: 'first_name', type: 'text' },
          { name: 'age', type: 'int4' },
        ],
        ['Paul', '33'],
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
        ['Paul', '33'],
        ['int4']
      ),
      '33'
    )
  })
})
