import {
  DEFAULT_HEADERS,
  DEFAULT_GLOBAL_OPTIONS,
  DEFAULT_DB_OPTIONS,
  DEFAULT_AUTH_OPTIONS,
  DEFAULT_REALTIME_OPTIONS,
} from '../../src/lib/constants'
import { version } from '../../src/lib/version'

describe('constants', () => {
  const originalEnv = process.env
  const originalWindow = global.window
  const originalDocument = global.document
  const originalNavigator = global.navigator
  const originalDeno = (global as any).Deno

  beforeEach(() => {
    jest.resetModules()
    // Reset globals
    delete (global as any).window
    delete (global as any).document
    delete (global as any).navigator
    delete (global as any).Deno
  })

  afterEach(() => {
    // Restore globals
    if (originalWindow) global.window = originalWindow
    if (originalDocument) global.document = originalDocument
    if (originalNavigator) global.navigator = originalNavigator
    if (originalDeno) (global as any).Deno = originalDeno
  })

  test('DEFAULT_HEADERS should contain X-Client-Info', () => {
    expect(DEFAULT_HEADERS).toHaveProperty('X-Client-Info')
    expect(DEFAULT_HEADERS['X-Client-Info']).toMatch(/^supabase-js-.*\/.*$/)
  })

  test('DEFAULT_GLOBAL_OPTIONS should contain headers', () => {
    expect(DEFAULT_GLOBAL_OPTIONS).toHaveProperty('headers')
    expect(DEFAULT_GLOBAL_OPTIONS.headers).toBe(DEFAULT_HEADERS)
  })

  test('DEFAULT_DB_OPTIONS should have schema set to public', () => {
    expect(DEFAULT_DB_OPTIONS).toHaveProperty('schema')
    expect(DEFAULT_DB_OPTIONS.schema).toBe('public')
  })

  test('DEFAULT_AUTH_OPTIONS should have correct default values', () => {
    expect(DEFAULT_AUTH_OPTIONS).toHaveProperty('autoRefreshToken')
    expect(DEFAULT_AUTH_OPTIONS.autoRefreshToken).toBe(true)
    expect(DEFAULT_AUTH_OPTIONS).toHaveProperty('persistSession')
    expect(DEFAULT_AUTH_OPTIONS.persistSession).toBe(true)
    expect(DEFAULT_AUTH_OPTIONS).toHaveProperty('detectSessionInUrl')
    expect(DEFAULT_AUTH_OPTIONS.detectSessionInUrl).toBe(true)
    expect(DEFAULT_AUTH_OPTIONS).toHaveProperty('flowType')
    expect(DEFAULT_AUTH_OPTIONS.flowType).toBe('implicit')
  })

  test('DEFAULT_REALTIME_OPTIONS should be an empty object', () => {
    expect(DEFAULT_REALTIME_OPTIONS).toEqual({})
  })

  describe('JS_ENV detection', () => {
    test('should detect Deno environment', () => {
      ;(global as any).Deno = {}

      // Re-import to trigger the detection logic
      jest.resetModules()
      const { DEFAULT_HEADERS: newHeaders } = require('../../src/lib/constants')

      expect(newHeaders['X-Client-Info']).toContain('supabase-js-deno')
    })

    test('should detect web environment', () => {
      global.document = {} as any

      // Re-import to trigger the detection logic
      jest.resetModules()
      const { DEFAULT_HEADERS: newHeaders } = require('../../src/lib/constants')

      expect(newHeaders['X-Client-Info']).toContain('supabase-js-web')
    })

    test('should detect React Native environment', () => {
      global.navigator = { product: 'ReactNative' } as any

      // Re-import to trigger the detection logic
      jest.resetModules()
      const { DEFAULT_HEADERS: newHeaders } = require('../../src/lib/constants')

      expect(newHeaders['X-Client-Info']).toContain('supabase-js-react-native')
    })

    test('should default to node environment when no specific environment is detected', () => {
      // No globals set

      // Re-import to trigger the detection logic
      jest.resetModules()
      const { DEFAULT_HEADERS: newHeaders } = require('../../src/lib/constants')

      expect(newHeaders['X-Client-Info']).toContain('supabase-js-node')
    })
  })
})
