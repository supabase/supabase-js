import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
    expect(DEFAULT_HEADERS['X-Client-Info']).toMatch(/^supabase-js\/[^;]+; runtime=node/)
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
      ;(global as any).Deno = { version: { deno: '1.37.0' } }

      // Re-import to trigger the detection logic
      jest.resetModules()
      const { DEFAULT_HEADERS: newHeaders } = require('../../src/lib/constants')

      expect(newHeaders['X-Client-Info']).toContain('runtime=deno')
      expect(newHeaders['X-Client-Info']).toContain('runtime-version=1.37.0')
    })

    test('should detect Deno environment without version', () => {
      ;(global as any).Deno = {}

      // Re-import to trigger the detection logic
      jest.resetModules()
      const { DEFAULT_HEADERS: newHeaders } = require('../../src/lib/constants')

      expect(newHeaders['X-Client-Info']).toContain('runtime=deno')
      expect(newHeaders['X-Client-Info']).not.toContain('runtime-version=')
    })

    test('should report a browser as the platform without a runtime', () => {
      global.document = {} as any

      // Re-import to trigger the detection logic
      jest.resetModules()
      const { DEFAULT_HEADERS: newHeaders } = require('../../src/lib/constants')

      expect(newHeaders['X-Client-Info']).toBe(`supabase-js/${version}; platform=browser`)
    })

    test('should report React Native as the framework without a runtime', () => {
      global.navigator = { product: 'ReactNative' } as any

      // Re-import to trigger the detection logic
      jest.resetModules()
      const { DEFAULT_HEADERS: newHeaders } = require('../../src/lib/constants')

      expect(newHeaders['X-Client-Info']).toBe(`supabase-js/${version}; framework=react-native`)
    })

    test('should default to node environment with process version', () => {
      // No globals set - falls through to node branch

      // Re-import to trigger the detection logic
      jest.resetModules()
      const { DEFAULT_HEADERS: newHeaders } = require('../../src/lib/constants')

      expect(newHeaders['X-Client-Info']).toContain('runtime=node')
      expect(newHeaders['X-Client-Info']).toMatch(/runtime-version=\d+\.\d+\.\d+/)
    })

    test('should avoid static process.version access for Edge runtimes', () => {
      const source = readFileSync(join(__dirname, '../../src/lib/constants.ts'), 'utf8')

      expect(source).not.toContain('process.version')
    })
  })

  describe('detectClientEnvironment', () => {
    const { detectClientEnvironment, formatClientEnvironment } = require('../../src/lib/constants')
    const describeEnvironment = (globals: object) =>
      formatClientEnvironment(detectClientEnvironment(globals)).join('; ')

    test('reports Bun as the runtime instead of its Node compatibility version', () => {
      expect(
        describeEnvironment({
          Bun: { version: '1.3.14' },
          navigator: { userAgent: 'Bun/1.3.14' },
          process: { version: 'v24.3.0', versions: { bun: '1.3.14' } },
        })
      ).toBe('runtime=bun; runtime-version=1.3.14')
    })

    test('reports Cloudflare Workers as the platform without a runtime', () => {
      expect(
        describeEnvironment({
          navigator: { userAgent: 'Cloudflare-Workers' },
          process: { version: 'v22.0.0' },
        })
      ).toBe('platform=cloudflare-workers')
    })

    test('reports the Vercel edge runtime as the platform without a runtime', () => {
      expect(describeEnvironment({ EdgeRuntime: 'edge-runtime' })).toBe(
        'platform=vercel-edge-runtime'
      )
    })

    test('reports Supabase Edge Runtime as the platform together with Deno', () => {
      expect(
        describeEnvironment({
          Deno: { version: { deno: '2.1.4' } },
          EdgeRuntime: { waitUntil: jest.fn() },
          SUPABASE_VERSION: '1.67.0',
        })
      ).toBe('platform=edge-runtime; platform-version=1.67.0; runtime=deno; runtime-version=2.1.4')
    })

    test('reports Supabase Edge Runtime without a platform version when it is unknown', () => {
      expect(
        describeEnvironment({
          Deno: { version: { deno: '2.1.4' } },
          EdgeRuntime: { waitUntil: jest.fn() },
        })
      ).toBe('platform=edge-runtime; runtime=deno; runtime-version=2.1.4')
    })

    test('reports Netlify Edge Functions as the platform together with Deno', () => {
      expect(
        describeEnvironment({
          Deno: { version: { deno: '2.1.4' } },
          Netlify: { env: {} },
        })
      ).toBe('platform=netlify-edge; runtime=deno; runtime-version=2.1.4')
    })

    test('reports a Web Worker as a browser', () => {
      expect(
        describeEnvironment({
          WorkerGlobalScope: jest.fn(),
          navigator: { userAgent: 'Mozilla/5.0 Chrome/130.0.0.0' },
        })
      ).toBe('platform=browser')
    })

    test('reports Electron as the framework in a renderer process', () => {
      expect(
        describeEnvironment({
          document: {},
          navigator: { userAgent: 'Mozilla/5.0 Chrome/130.0.0.0 Electron/33.2.1 Safari/537.36' },
        })
      ).toBe('platform=browser; framework=electron; framework-version=33.2.1')
    })

    test('extracts only the Electron version when the user agent has extra tokens', () => {
      expect(
        describeEnvironment({
          document: {},
          navigator: { userAgent: 'SomeAppName/2.0/Electron/1.0.0;build=5' },
        })
      ).toBe('platform=browser; framework=electron; framework-version=1.0.0')
    })

    test('reports React Native even when browser globals are polyfilled', () => {
      expect(
        describeEnvironment({
          document: {},
          WorkerGlobalScope: jest.fn(),
          navigator: { product: 'ReactNative' },
        })
      ).toBe('framework=react-native')
    })

    test('reports Electron as the framework in the main process', () => {
      expect(
        describeEnvironment({
          process: { version: 'v20.18.1', versions: { electron: '33.2.1' } },
        })
      ).toBe('runtime=node; runtime-version=20.18.1; framework=electron; framework-version=33.2.1')
    })

    test('reports Node without a version when process is unavailable', () => {
      expect(describeEnvironment({})).toBe('runtime=node')
    })
  })
})
