import { ensureTrailingSlash } from '../../src/lib/helpers'

test('Adds trailing slash to URL if missing', () => {
  const input = 'http://localhost:3000'
  const expected = 'http://localhost:3000/'
  expect(ensureTrailingSlash(input)).toBe(expected)
})

test('Keeps trailing slash of URL if already present', () => {
  const input = 'http://localhost:3000/'
  const expected = 'http://localhost:3000/'
  expect(ensureTrailingSlash(input)).toBe(expected)
})

test('Adds trailing slash to URL with path if missing', () => {
  const input = 'http://localhost:3000/path/to/supabase'
  const expected = 'http://localhost:3000/path/to/supabase/'
  expect(ensureTrailingSlash(input)).toBe(expected)
})

test('Keeps trailing slash of URL with path if already present', () => {
  const input = 'http://localhost:3000/path/to/supabase/'
  const expected = 'http://localhost:3000/path/to/supabase/'
  expect(ensureTrailingSlash(input)).toBe(expected)
})
