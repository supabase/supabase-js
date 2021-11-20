import { DEFAULT_HEADERS } from '../src/lib/constants'
import { version } from '../src/lib/version'

test('it has the correct type of returning with the correct value', () => {
  const expected = {
    'X-Client-Info': `supabase-js/${version}`,
  }
  expect(DEFAULT_HEADERS).toEqual(expected)
  expect(typeof DEFAULT_HEADERS).toBe('object')
  expect(typeof DEFAULT_HEADERS['X-Client-Info']).toBe('string')
  expect(Object.keys(DEFAULT_HEADERS).length).toBe(1)
})
