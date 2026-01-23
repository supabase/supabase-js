import {
  DEFAULT_HEADERS,
  DEFAULT_GLOBAL_OPTIONS,
  DEFAULT_DB_OPTIONS,
  DEFAULT_AUTH_OPTIONS,
  DEFAULT_REALTIME_OPTIONS,
} from '../../src/lib/constants'
import {
  getClientPlatform,
  getClientPlatformVersion,
  getClientRuntime,
  getClientRuntimeVersion,
} from '../../src/lib/constants'

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

      test('getClientPlatformVersion returns OS version in Node.js server environments', () => {
        // Only run this test in Node.js environment
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
          const platformVersion = getClientPlatformVersion()
          const runtimeVersion = getClientRuntimeVersion()

          // In server-side Node.js (typeof window === 'undefined'), platform version should exist
          if (typeof window === 'undefined') {
            expect(platformVersion).not.toBeNull()
            expect(runtimeVersion).not.toBeNull()

            // They should be DIFFERENT values
            if (platformVersion && runtimeVersion) {
              expect(platformVersion).not.toBe(runtimeVersion)
              // Platform version should NOT match Node.js version format
              expect(platformVersion).not.toBe(process.versions.node)
            }
          }
        }
      })

      test('getClientPlatformVersion uses os.release() in Node.js', () => {
        // Only run this test in server-side Node.js environment
        if (
          typeof process !== 'undefined' &&
          process.versions &&
          process.versions.node &&
          typeof window === 'undefined'
        ) {
          const platformVersion = getClientPlatformVersion()
          const os = require('os')
          const expectedVersion = os.release()

          expect(platformVersion).toBe(expectedVersion)
        }
      })

      test('X-Supabase-Client-Platform-Version header contains OS version, not runtime version', () => {
        const headers = DEFAULT_HEADERS

        if (
          headers['X-Supabase-Client-Platform-Version'] &&
          headers['X-Supabase-Client-Runtime-Version']
        ) {
          const platformVersion = headers['X-Supabase-Client-Platform-Version']
          const runtimeVersion = headers['X-Supabase-Client-Runtime-Version']

          // Platform version should be different from runtime version
          expect(platformVersion).not.toBe(runtimeVersion)

          // In Node.js, ensure platform version is not the Node.js version
          if (typeof process !== 'undefined' && process.versions && process.versions.node) {
            expect(platformVersion).not.toBe(process.version.slice(1))
            expect(platformVersion).not.toBe(process.versions.node)
          }
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
