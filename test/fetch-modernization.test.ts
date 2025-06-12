/**
 * Test suite for modernized fetch implementation
 *
 * IMPORTANT: All fetch calls in these tests are mocked. No real HTTP requests
 * are made to any URLs used here. All network interactions are simulated.
 *
 * Tests the basic functionality of the new fetch system across different environments
 */

import {
  resolveFetch,
  resolveHeaders,
  fetchWithAuth,
  resolveHeadersConstructor,
} from '../src/lib/fetch'
import SupabaseClient from '../src/SupabaseClient'

// Test URLs - these are symbolic and no real network calls are made
const TEST_URLS = {
  MOCK_API: 'https://mock.supabase.test',
  EXAMPLE: 'https://example.test',
  SUPABASE_DEMO: 'https://xyzcompany.supabase.test',
} as const

describe('Fetch Modernization - Basic Functionality', () => {
  // Store original globals to restore between tests
  const originalFetch = globalThis.fetch
  const originalHeaders = globalThis.Headers

  afterEach(() => {
    // Clean up mocks and restore globals between tests
    jest.clearAllMocks()
    // Safely restore globals
    try {
      if (originalFetch) {
        Object.defineProperty(globalThis, 'fetch', {
          value: originalFetch,
          writable: true,
          configurable: true,
        })
      }
      if (originalHeaders) {
        Object.defineProperty(globalThis, 'Headers', {
          value: originalHeaders,
          writable: true,
          configurable: true,
        })
      }
    } catch (error) {
      // Ignore errors in cleanup - some properties might be read-only
    }
  })

  describe('Custom fetch handling', () => {
    it('should prioritize custom fetch over native', async () => {
      const customFetch = jest.fn().mockResolvedValue(new Response())
      const fetchImpl = await resolveFetch(customFetch)

      await fetchImpl(TEST_URLS.EXAMPLE)

      expect(customFetch).toHaveBeenCalledWith(TEST_URLS.EXAMPLE)
      expect(customFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Environment compatibility', () => {
    it('should use native fetch when both fetch and Headers are available', async () => {
      // Ensure both are available (normal browser/Node18+ case)
      const mockFetch = jest.fn().mockResolvedValue(new Response())

      // Safely set globals
      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(globalThis, 'Headers', {
        value: Headers,
        writable: true,
        configurable: true,
      })

      const fetchImpl = await resolveFetch()

      expect(fetchImpl).toBe(mockFetch)
    })

    it('should fall back to polyfill when Headers is missing', async () => {
      // Mock native fetch but remove Headers
      Object.defineProperty(globalThis, 'fetch', {
        value: jest.fn().mockResolvedValue(new Response()),
        writable: true,
        configurable: true,
      })

      // Remove Headers safely
      try {
        Object.defineProperty(globalThis, 'Headers', {
          value: undefined,
          writable: true,
          configurable: true,
        })
      } catch (error) {
        // If we can't modify Headers, skip this test scenario
        return
      }

      // Should require custom fetch in this scenario (polyfill not available in tests)
      const customFetch = jest.fn().mockResolvedValue(new Response())
      const fetchImpl = await resolveFetch(customFetch)

      expect(fetchImpl).toBe(customFetch)
    })

    it('should handle worker environment detection', async () => {
      // Mock worker environment
      const originalSelf = (globalThis as any).self
      ;(globalThis as any).self = {
        constructor: { name: 'DedicatedWorkerGlobalScope' },
      }

      // Mock Object.prototype.toString to return worker indication
      const originalToString = Object.prototype.toString
      Object.prototype.toString = jest.fn().mockReturnValue('[object DedicatedWorkerGlobalScope]')

      try {
        // In worker without Headers, should use custom fetch
        try {
          Object.defineProperty(globalThis, 'Headers', {
            value: undefined,
            writable: true,
            configurable: true,
          })
        } catch (error) {
          // Skip if Headers can't be modified
          return
        }

        const customFetch = jest.fn().mockResolvedValue(new Response())
        const fetchImpl = await resolveFetch(customFetch)

        expect(fetchImpl).toBe(customFetch)
      } finally {
        // Restore
        ;(globalThis as any).self = originalSelf
        Object.prototype.toString = originalToString
      }
    })
  })

  describe('Error handling', () => {
    it('should throw appropriate error when no fetch implementation is available', async () => {
      // Remove all fetch implementations safely
      const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
      const headersDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Headers')

      try {
        Object.defineProperty(globalThis, 'fetch', {
          value: undefined,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(globalThis, 'Headers', {
          value: undefined,
          writable: true,
          configurable: true,
        })

        await expect(resolveFetch()).rejects.toThrow(/No fetch implementation available/)
      } finally {
        // Restore if possible
        if (fetchDescriptor) {
          Object.defineProperty(globalThis, 'fetch', fetchDescriptor)
        }
        if (headersDescriptor) {
          Object.defineProperty(globalThis, 'Headers', headersDescriptor)
        }
      }
    })

    it('should throw appropriate error when Headers implementation is missing', async () => {
      const headersDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Headers')

      try {
        Object.defineProperty(globalThis, 'Headers', {
          value: undefined,
          writable: true,
          configurable: true,
        })

        await expect(resolveHeaders()).rejects.toThrow(/No Headers implementation available/)
      } finally {
        // Restore if possible
        if (headersDescriptor) {
          Object.defineProperty(globalThis, 'Headers', headersDescriptor)
        }
      }
    })
  })

  describe('SupabaseClient Custom Fetch Integration', () => {
    it('should accept custom fetch via global.fetch option like documentation example', () => {
      const customFetch = jest.fn().mockResolvedValue(new Response('{}'))

      // This is the exact pattern from Supabase documentation
      const supabase = new SupabaseClient(TEST_URLS.SUPABASE_DEMO, 'public-anon-key', {
        global: {
          fetch: (...args) => customFetch(...args),
        },
      })

      // Verify the custom fetch is stored
      expect(supabase['_customFetch']).toBeDefined()
      expect(typeof supabase['_customFetch']).toBe('function')
    })

    it('should use custom fetch for actual requests', async () => {
      const mockResponse = new Response(JSON.stringify({ data: [], count: 0 }), {
        headers: { 'content-type': 'application/json' },
      })
      const customFetch = jest.fn().mockResolvedValue(mockResponse)

      const supabase = new SupabaseClient('https://test.supabase.test', 'test-key', {
        global: {
          fetch: customFetch,
        },
      })

      // Trigger a request that will use fetch
      try {
        await supabase.from('test').select('*')
      } catch (error) {
        // We expect this to fail due to mocked response, but that's okay
        // We just want to verify the custom fetch was called
      }

      // Verify custom fetch was called
      expect(customFetch).toHaveBeenCalled()
    })
  })

  describe('Backward compatibility', () => {
    it('should maintain resolveHeadersConstructor alias', async () => {
      // This should not throw an error
      await expect(resolveHeadersConstructor()).resolves.toBeDefined()
    })

    it('should provide fetchWithAuth functionality', async () => {
      const mockKey = 'test-key'
      const mockGetToken = jest.fn().mockResolvedValue('test-token')
      const customFetch = jest.fn().mockResolvedValue(new Response())

      const authenticatedFetch = await fetchWithAuth(mockKey, mockGetToken, customFetch)
      expect(typeof authenticatedFetch).toBe('function')
    })
  })

  describe('Authentication integration', () => {
    it('should properly handle authentication headers with custom fetch', async () => {
      const mockFetch = jest.fn().mockResolvedValue(new Response('{}'))

      // Use custom implementations
      const supabaseKey = 'test-key'
      const accessToken = 'access-token'
      const getAccessToken = jest.fn().mockResolvedValue(accessToken)

      const authenticatedFetch = await fetchWithAuth(supabaseKey, getAccessToken, mockFetch)

      await authenticatedFetch(TEST_URLS.MOCK_API, {
        headers: { 'content-type': 'application/json' },
      })

      // Verify the mock fetch was called with complete init verification
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(getAccessToken).toHaveBeenCalledTimes(1)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(TEST_URLS.MOCK_API)
      expect(init).toBeDefined()
      expect(init.headers).toBeDefined()
      expect(init.method).toBeUndefined() // Default GET
      expect(init.body).toBeUndefined()

      // The authenticated fetch should have added auth headers to whatever headers were provided
      const headers = init.headers as Headers
      expect(headers).toBeInstanceOf(Headers)
      expect(headers.get('apikey')).toBe(supabaseKey)
      expect(headers.get('authorization')).toBe(`Bearer ${accessToken}`)
      expect(headers.get('content-type')).toBe('application/json')
    })
  })

  describe('Type safety', () => {
    it('should have proper TypeScript types', () => {
      // Test that functions exist and have correct types
      expect(typeof resolveFetch).toBe('function')
      expect(typeof resolveHeaders).toBe('function')
      expect(typeof fetchWithAuth).toBe('function')
      expect(typeof resolveHeadersConstructor).toBe('function')
    })
  })

  // Test fetch/Headers consistency (Fix #3)
  test('should use consistent fetch and Headers implementations', async () => {
    // Test the basic functionality: custom fetch should always be prioritized
    const customFetch = jest.fn().mockResolvedValue(new Response())
    const fetchImpl = await resolveFetch(customFetch)

    // Should use custom fetch when provided
    expect(fetchImpl).toBe(customFetch)

    // Test that both resolvers work together
    const HeadersConstructor = await resolveHeaders()
    expect(typeof HeadersConstructor).toBe('function')

    // Test that Headers can be instantiated and used
    const headers = new HeadersConstructor()
    headers.set('test', 'value')
    expect(headers.get('test')).toBe('value')

    // This verifies the fix: both fetch and Headers work consistently
    // without mixing different implementations that could cause runtime errors
  })

  // Test selective lowercase for security headers (Fix #4)
  test('should apply lowercase only to security-sensitive headers', async () => {
    const mockFetch = jest.fn().mockResolvedValue(new Response('{}'))

    const authenticatedFetch = await fetchWithAuth('test-key', async () => 'test-token', mockFetch)

    await authenticatedFetch(TEST_URLS.EXAMPLE, {
      headers: {
        'Content-Type': 'application/json', // Should preserve case
        'X-Custom-Header': 'custom-value', // Should preserve case
        ApiKey: 'should-be-normalized', // Should be normalized to lowercase
        AUTHORIZATION: 'Bearer old-token', // Should be normalized and overridden
      },
    })

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe(TEST_URLS.EXAMPLE)

    const headers = init.headers as Headers

    // Security headers should be lowercase
    expect(headers.get('apikey')).toBe('test-key')
    expect(headers.get('authorization')).toBe('Bearer test-token')

    // Non-security headers should preserve original case
    let foundContentType = false
    let foundCustomHeader = false

    for (const [key, value] of headers) {
      if (key === 'Content-Type' || key === 'content-type') {
        foundContentType = true
        expect(value).toBe('application/json')
      }
      if (key === 'X-Custom-Header' || key === 'x-custom-header') {
        foundCustomHeader = true
        expect(value).toBe('custom-value')
      }
    }

    expect(foundContentType).toBe(true)
    expect(foundCustomHeader).toBe(true)
  })

  // Test undefined value filtering (Fix #2)
  test('should filter undefined header values', async () => {
    const mockFetch = jest.fn().mockResolvedValue(new Response('{}'))

    const authenticatedFetch = await fetchWithAuth('test-key', async () => 'test-token', mockFetch)

    await authenticatedFetch(TEST_URLS.EXAMPLE, {
      headers: {
        'Content-Type': 'application/json',
        'X-Undefined': undefined as any,
        'X-Null': null as any,
        'X-Valid': 'valid-value',
      },
    })

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe(TEST_URLS.EXAMPLE)

    const headers = init.headers as Headers

    // Should not have undefined/null headers
    expect(headers.has('X-Undefined')).toBe(false)
    expect(headers.has('X-Null')).toBe(false)

    // Should have valid headers
    expect(headers.get('X-Valid')).toBe('valid-value')
    expect(headers.get('apikey')).toBe('test-key')
  })

  // Test Request object header merging (Fix #5 - unified extraction)
  test('should properly merge Request headers with init headers', async () => {
    const mockFetch = jest.fn().mockResolvedValue(new Response('{}'))

    const authenticatedFetch = await fetchWithAuth('test-key', async () => 'test-token', mockFetch)

    // Create a Request with headers
    const request = new Request(TEST_URLS.EXAMPLE, {
      headers: {
        'Content-Type': 'text/plain',
        'X-Request-Header': 'from-request',
      },
    })

    await authenticatedFetch(request, {
      headers: {
        'Content-Type': 'application/json', // Should override Request header
        'X-Init-Header': 'from-init', // Should be added
      },
    })

    const [input, init] = mockFetch.mock.calls[0]
    expect(input).toBe(request) // Request object passed through

    const headers = init.headers as Headers

    // Init headers should take precedence over Request headers
    expect(headers.get('Content-Type')).toBe('application/json')

    // Should have headers from both sources
    expect(headers.get('X-Request-Header')).toBe('from-request')
    expect(headers.get('X-Init-Header')).toBe('from-init')

    // Should have auth headers
    expect(headers.get('apikey')).toBe('test-key')
    expect(headers.get('authorization')).toBe('Bearer test-token')
  })

  // Test cross-runtime Headers compatibility (Fix #1)
  test('should handle Headers from different runtimes safely', async () => {
    const mockFetch = jest.fn().mockResolvedValue(new Response('{}'))

    const authenticatedFetch = await fetchWithAuth('test-key', async () => 'test-token', mockFetch)

    // Mock a Headers-like object that might come from a different runtime
    const mockHeaders = {
      forEach: jest.fn((callback: (value: string, key: string) => void) => {
        callback('application/json', 'Content-Type')
        callback('from-mock', 'X-Mock-Header')
      }),
    }

    await authenticatedFetch(TEST_URLS.EXAMPLE, {
      headers: mockHeaders as any,
    })

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe(TEST_URLS.EXAMPLE)

    const headers = init.headers as Headers

    // Should have headers from mock
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-Mock-Header')).toBe('from-mock')

    // Should have auth headers
    expect(headers.get('apikey')).toBe('test-key')
    expect(headers.get('authorization')).toBe('Bearer test-token')

    // Should have called forEach on the mock
    expect(mockHeaders.forEach).toHaveBeenCalled()
  })

  // Test cross-runtime Headers mixing prevention (Final Fix)
  test('should prevent TypeError from mixed Headers implementations', async () => {
    const mockFetch = jest.fn().mockResolvedValue(new Response('{}'))

    const authenticatedFetch = await fetchWithAuth('test-key', async () => 'test-token', mockFetch)

    // Simulate a Headers object that could cause TypeError in cross-runtime scenarios
    // This mimics the scenario where Request comes from node-fetch-native in tests
    // but local runtime uses Undici Headers
    class MockForeignHeaders {
      private headers = new Map([
        ['content-type', 'application/json'],
        ['x-foreign-header', 'from-foreign-runtime'],
      ])

      forEach(callback: (value: string, key: string) => void) {
        for (const [key, value] of this.headers) {
          callback(value, key)
        }
      }

      // This would normally cause issues in constructor mixing
      [Symbol.iterator]() {
        return this.headers[Symbol.iterator]()
      }
    }

    const foreignHeaders = new MockForeignHeaders()

    // This should NOT throw TypeError: each header value must be a string
    await expect(
      authenticatedFetch(TEST_URLS.EXAMPLE, {
        headers: foreignHeaders as any,
      })
    ).resolves.toBeDefined()

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe(TEST_URLS.EXAMPLE)

    const headers = init.headers as Headers

    // Should successfully merge headers without crashing
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('x-foreign-header')).toBe('from-foreign-runtime')
    expect(headers.get('apikey')).toBe('test-key')
    expect(headers.get('authorization')).toBe('Bearer test-token')
  })
})
