import { version } from '../src/version'
import { DEFAULT_HEADERS } from '../src/constants'

describe('version', () => {
  test('should export version string', () => {
    expect(version).toBe('0.0.0-automated')
  })
})

describe('constants', () => {
  test('should have X-Client-Info header with correct format', () => {
    expect(DEFAULT_HEADERS).toHaveProperty('X-Client-Info')
    expect(DEFAULT_HEADERS['X-Client-Info']).toBe(`postgrest-js/${version}`)
  })
})
