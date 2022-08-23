import { cleanUrl } from '../src/lib/helpers'

test('Strip trailing slash from URL', () => {
  const URL = 'http://localhost:3000/'
  const expectedURL = URL.slice(0, -1)
  expect(cleanUrl(URL)).toBe(expectedURL)
})

test('Return the original URL if there is no slash or white space at the end', () => {
  const URL = 'http://localhost:3000'
  const expectedURL = URL
  expect(cleanUrl(URL)).toBe(expectedURL)
})

test('Strip trailing white space from URL', () => {
  const URL = 'http://localhost:3000 '
  const expectedURL = URL.slice(0, -1)
  expect(cleanUrl(URL)).toBe(expectedURL)
})

test('Strip trailing slash followed by white space from URL', () => {
  const URL = 'http://localhost:3000/ '
  const expectedURL = URL.slice(0, -2)
  expect(cleanUrl(URL)).toBe(expectedURL)
})
