import { stripTrailingSlash } from '../src/lib/helpers'

test('Strip trailing slash from URL', () => {
  const URL = 'http://localhost:3000/'
  const expectedURL = URL.slice(0, -1)
  expect(stripTrailingSlash(URL)).toBe(expectedURL)
})

test('Return the original URL if there is no slash at the end', () => {
  const URL = 'http://localhost:3000'
  const expectedURL = URL
  expect(stripTrailingSlash(URL)).toBe(expectedURL)
})
