import {
  DEFAULT_HEADERS,
  getClientPlatform,
  getClientPlatformVersion,
  getClientRuntime,
  getClientRuntimeVersion,
} from '../../src/lib/constants'
import { version } from '../../src/lib/version'

test('it has the correct type of returning with the correct value', () => {
  let JS_ENV = ''
  // @ts-ignore
  if (typeof Deno !== 'undefined') {
    JS_ENV = 'deno'
  } else if (typeof document !== 'undefined') {
    JS_ENV = 'web'
  } else if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    JS_ENV = 'react-native'
  } else {
    JS_ENV = 'node'
  }

  expect(typeof DEFAULT_HEADERS).toBe('object')
  expect(typeof DEFAULT_HEADERS['X-Client-Info']).toBe('string')
  expect(DEFAULT_HEADERS['X-Client-Info']).toBe(`supabase-js-${JS_ENV}/${version}`)

  // X-Client-Info should always be present
  expect(DEFAULT_HEADERS).toHaveProperty('X-Client-Info')

  // Other headers should only be present if they can be detected
  Object.keys(DEFAULT_HEADERS).forEach((key) => {
    expect(typeof DEFAULT_HEADERS[key]).toBe('string')
    expect(DEFAULT_HEADERS[key].length).toBeGreaterThan(0)
  })
})

describe('Client Platform Detection', () => {
  test('getClientPlatform returns platform or null', () => {
    const platform = getClientPlatform()
    expect(platform === null || typeof platform === 'string').toBe(true)
    if (platform) {
      expect(platform.length).toBeGreaterThan(0)
      expect(['macOS', 'Windows', 'Linux', 'iOS', 'Android'].includes(platform)).toBe(true)
    }
  })

  test('getClientPlatformVersion returns version string or null', () => {
    const version = getClientPlatformVersion()
    expect(version === null || typeof version === 'string').toBe(true)
    if (version) {
      expect(version.length).toBeGreaterThan(0)
    }
  })
})

describe('Client Runtime Detection', () => {
  test('getClientRuntime returns runtime or null', () => {
    const runtime = getClientRuntime()
    expect(runtime === null || typeof runtime === 'string').toBe(true)
    if (runtime) {
      expect(runtime.length).toBeGreaterThan(0)
      expect(['node', 'deno', 'bun'].includes(runtime)).toBe(true)
    }
  })

  test('getClientRuntimeVersion returns version string or null', () => {
    const version = getClientRuntimeVersion()
    expect(version === null || typeof version === 'string').toBe(true)
    if (version) {
      expect(version.length).toBeGreaterThan(0)
    }
  })
})

describe('Header Constants', () => {
  test('X-Client-Info header format', () => {
    const header = DEFAULT_HEADERS['X-Client-Info']
    expect(header).toMatch(/^supabase-js-.+\/\d+\.\d+\.\d+/)
  })

  test('X-Client-Info is always present', () => {
    expect(DEFAULT_HEADERS).toHaveProperty('X-Client-Info')
  })

  test('Optional headers are only present when detected', () => {
    // Test that optional headers are either not present or have valid values
    const optionalHeaders = [
      'X-Supabase-Client-Platform',
      'X-Supabase-Client-Platform-Version',
      'X-Supabase-Client-Runtime',
      'X-Supabase-Client-Runtime-Version',
    ]

    optionalHeaders.forEach((headerName) => {
      if (DEFAULT_HEADERS[headerName]) {
        expect(typeof DEFAULT_HEADERS[headerName]).toBe('string')
        expect(DEFAULT_HEADERS[headerName].length).toBeGreaterThan(0)
      }
    })
  })

  test('All present headers are properly formatted', () => {
    Object.values(DEFAULT_HEADERS).forEach((value) => {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    })
  })
})
