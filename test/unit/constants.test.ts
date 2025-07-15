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

  // Check all required headers are present
  expect(DEFAULT_HEADERS).toHaveProperty('X-Client-Info')
  expect(DEFAULT_HEADERS).toHaveProperty('X-Supabase-Client-Platform')
  expect(DEFAULT_HEADERS).toHaveProperty('X-Supabase-Client-Platform-Version')
  expect(DEFAULT_HEADERS).toHaveProperty('X-Supabase-Client-Runtime')
  expect(DEFAULT_HEADERS).toHaveProperty('X-Supabase-Client-Runtime-Version')

  expect(Object.keys(DEFAULT_HEADERS).length).toBe(5)
})

describe('Client Platform Detection', () => {
  test('getClientPlatform returns correct platform', () => {
    const platform = getClientPlatform()
    expect(typeof platform).toBe('string')
    expect(platform.length).toBeGreaterThan(0)
  })

  test('getClientPlatformVersion returns version string', () => {
    const version = getClientPlatformVersion()
    expect(typeof version).toBe('string')
    expect(version.length).toBeGreaterThan(0)
  })
})

describe('Client Runtime Detection', () => {
  test('getClientRuntime returns correct runtime', () => {
    const runtime = getClientRuntime()
    expect(typeof runtime).toBe('string')
    expect(runtime.length).toBeGreaterThan(0)
    expect(['node', 'deno', 'bun', 'web'].includes(runtime)).toBe(true)
  })

  test('getClientRuntimeVersion returns version string', () => {
    const version = getClientRuntimeVersion()
    expect(typeof version).toBe('string')
    expect(version.length).toBeGreaterThan(0)
  })
})

describe('Header Constants', () => {
  test('X-Client-Info header format', () => {
    const header = DEFAULT_HEADERS['X-Client-Info']
    expect(header).toMatch(/^supabase-js-.+\/\d+\.\d+\.\d+/)
  })

  test('All required headers are present', () => {
    expect(DEFAULT_HEADERS).toHaveProperty('X-Client-Info')
  })

  test('Headers are properly formatted', () => {
    Object.values(DEFAULT_HEADERS).forEach((value) => {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    })
  })
})
