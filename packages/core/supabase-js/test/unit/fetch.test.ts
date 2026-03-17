import { resolveFetch, resolveHeadersConstructor, fetchWithAuth } from '../../src/lib/fetch'

jest.mock('@supabase/tracing', () => {
  const actual = jest.requireActual('@supabase/tracing')
  return {
    ...actual,
    extractTraceContext: jest.fn().mockResolvedValue({
      traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00',
    }),
  }
})

// Mock fetch for testing
const mockFetch = jest.fn()
const mockHeaders = jest.fn()

describe('fetch module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset global fetch
    delete (global as any).fetch
    delete (global as any).Headers
  })

  describe('resolveFetch', () => {
    test('should use custom fetch when provided', () => {
      const customFetch = jest.fn()
      const result = resolveFetch(customFetch)
      expect(typeof result).toBe('function')
      // Test that it actually calls the custom fetch
      result('test')
      expect(customFetch).toHaveBeenCalledWith('test')
    })

    test('should use global fetch when available', () => {
      const globalFetch = jest.fn()
      ;(global as any).fetch = globalFetch

      const result = resolveFetch()
      expect(typeof result).toBe('function')
      // Test that it actually calls the global fetch
      result('test')
      expect(globalFetch).toHaveBeenCalledWith('test')
    })

    test('should return native fetch when no custom fetch provided', () => {
      const result = resolveFetch()
      expect(typeof result).toBe('function')
    })
  })

  describe('resolveHeadersConstructor', () => {
    test('should return native Headers', () => {
      const GlobalHeaders = jest.fn()
      ;(global as any).Headers = GlobalHeaders

      const result = resolveHeadersConstructor()
      expect(result).toBe(GlobalHeaders)
    })
  })

  describe('fetchWithAuth', () => {
    test('should add apikey and authorization headers', async () => {
      const mockResponse = { ok: true }
      const mockFetchImpl = jest.fn().mockResolvedValue(mockResponse)
      const mockHeadersImpl = jest.fn().mockReturnValue({
        has: jest.fn().mockReturnValue(false),
        set: jest.fn(),
      })

      ;(global as any).fetch = mockFetchImpl
      ;(global as any).Headers = mockHeadersImpl

      const supabaseKey = 'test-key'
      const supabaseUrl = 'https://myproject.supabase.co'
      const getAccessToken = jest.fn().mockResolvedValue('test-token')

      const authFetch = fetchWithAuth(supabaseKey, supabaseUrl, getAccessToken)
      await authFetch('https://example.com')

      expect(mockHeadersImpl).toHaveBeenCalled()
      expect(getAccessToken).toHaveBeenCalled()
    })

    test('should use supabaseKey as fallback when getAccessToken returns null', async () => {
      const mockResponse = { ok: true }
      const mockFetchImpl = jest.fn().mockResolvedValue(mockResponse)
      const mockHeadersImpl = jest.fn().mockReturnValue({
        has: jest.fn().mockReturnValue(false),
        set: jest.fn(),
      })

      ;(global as any).fetch = mockFetchImpl
      ;(global as any).Headers = mockHeadersImpl

      const supabaseKey = 'test-key'
      const supabaseUrl = 'https://myproject.supabase.co'
      const getAccessToken = jest.fn().mockResolvedValue(null)

      const authFetch = fetchWithAuth(supabaseKey, supabaseUrl, getAccessToken)
      await authFetch('https://example.com')

      expect(getAccessToken).toHaveBeenCalled()
    })

    test('should not override existing apikey header', async () => {
      const mockResponse = { ok: true }
      const mockFetchImpl = jest.fn().mockResolvedValue(mockResponse)
      const mockSet = jest.fn()
      const mockHeadersImpl = jest.fn().mockReturnValue({
        has: jest.fn().mockImplementation((key) => key === 'apikey'),
        set: mockSet,
      })

      ;(global as any).fetch = mockFetchImpl
      ;(global as any).Headers = mockHeadersImpl

      const supabaseKey = 'test-key'
      const supabaseUrl = 'https://myproject.supabase.co'
      const getAccessToken = jest.fn().mockResolvedValue('test-token')

      const authFetch = fetchWithAuth(supabaseKey, supabaseUrl, getAccessToken)
      await authFetch('https://example.com')

      expect(mockSet).not.toHaveBeenCalledWith('apikey', supabaseKey)
    })

    test('should not override existing authorization header', async () => {
      const mockResponse = { ok: true }
      const mockFetchImpl = jest.fn().mockResolvedValue(mockResponse)
      const mockSet = jest.fn()
      const mockHeadersImpl = jest.fn().mockReturnValue({
        has: jest.fn().mockImplementation((key) => key === 'Authorization'),
        set: mockSet,
      })

      ;(global as any).fetch = mockFetchImpl
      ;(global as any).Headers = mockHeadersImpl

      const supabaseKey = 'test-key'
      const supabaseUrl = 'https://myproject.supabase.co'
      const getAccessToken = jest.fn().mockResolvedValue('test-token')

      const authFetch = fetchWithAuth(supabaseKey, supabaseUrl, getAccessToken)
      await authFetch('https://example.com')

      expect(mockSet).not.toHaveBeenCalledWith('Authorization', expect.stringContaining('Bearer'))
    })

    describe('trace propagation', () => {
      test('should not inject trace headers when disabled', async () => {
        const mockResponse = { ok: true }
        const mockFetchImpl = jest.fn().mockResolvedValue(mockResponse)
        const mockSet = jest.fn()
        const mockHeadersImpl = jest.fn().mockReturnValue({
          has: jest.fn().mockReturnValue(false),
          set: mockSet,
        })

        ;(global as any).fetch = mockFetchImpl
        ;(global as any).Headers = mockHeadersImpl

        const supabaseKey = 'test-key'
        const supabaseUrl = 'https://myproject.supabase.co'
        const getAccessToken = jest.fn().mockResolvedValue('test-token')

        const tracePropagationOptions = {
          enabled: false,
        }

        const authFetch = fetchWithAuth(
          supabaseKey,
          supabaseUrl,
          getAccessToken,
          undefined,
          tracePropagationOptions
        )
        await authFetch('https://myproject.supabase.co/rest/v1/table')

        expect(mockSet).not.toHaveBeenCalledWith('traceparent', expect.anything())
        expect(mockSet).not.toHaveBeenCalledWith('tracestate', expect.anything())
        expect(mockSet).not.toHaveBeenCalledWith('baggage', expect.anything())
      })

      test('should not inject trace headers when explicitly disabled', async () => {
        const mockResponse = { ok: true }
        const mockFetchImpl = jest.fn().mockResolvedValue(mockResponse)
        const mockSet = jest.fn()
        const mockHeadersImpl = jest.fn().mockReturnValue({
          has: jest.fn().mockReturnValue(false),
          set: mockSet,
        })

        ;(global as any).fetch = mockFetchImpl
        ;(global as any).Headers = mockHeadersImpl

        const supabaseKey = 'test-key'
        const supabaseUrl = 'https://myproject.supabase.co'
        const getAccessToken = jest.fn().mockResolvedValue('test-token')

        const tracePropagationOptions = {
          enabled: false,
        }

        const authFetch = fetchWithAuth(
          supabaseKey,
          supabaseUrl,
          getAccessToken,
          undefined,
          tracePropagationOptions
        )
        await authFetch('https://myproject.supabase.co/rest/v1/table')

        expect(mockSet).not.toHaveBeenCalledWith('traceparent', expect.anything())
      })

      test('should not inject trace headers to non-Supabase domains', async () => {
        const mockResponse = { ok: true }
        const mockFetchImpl = jest.fn().mockResolvedValue(mockResponse)
        const mockSet = jest.fn()
        const mockHeadersImpl = jest.fn().mockReturnValue({
          has: jest.fn().mockReturnValue(false),
          set: mockSet,
        })

        ;(global as any).fetch = mockFetchImpl
        ;(global as any).Headers = mockHeadersImpl

        const supabaseKey = 'test-key'
        const supabaseUrl = 'https://myproject.supabase.co'
        const getAccessToken = jest.fn().mockResolvedValue('test-token')

        const tracePropagationOptions = {
          enabled: true,
        }

        const authFetch = fetchWithAuth(
          supabaseKey,
          supabaseUrl,
          getAccessToken,
          undefined,
          tracePropagationOptions
        )
        // Request to non-Supabase domain
        await authFetch('https://evil.com/api')

        expect(mockSet).not.toHaveBeenCalledWith('traceparent', expect.anything())
      })

      test('should respect sampling decision when enabled', async () => {
        const mockResponse = { ok: true }
        const mockFetchImpl = jest.fn().mockResolvedValue(mockResponse)
        const mockSet = jest.fn()
        const mockHeadersImpl = jest.fn().mockReturnValue({
          has: jest.fn().mockReturnValue(false),
          set: mockSet,
        })

        ;(global as any).fetch = mockFetchImpl
        ;(global as any).Headers = mockHeadersImpl

        const supabaseKey = 'test-key'
        const supabaseUrl = 'https://myproject.supabase.co'
        const getAccessToken = jest.fn().mockResolvedValue('test-token')

        const tracePropagationOptions = {
          enabled: true,
          respectSamplingDecision: true,
        }

        const authFetch = fetchWithAuth(
          supabaseKey,
          supabaseUrl,
          getAccessToken,
          undefined,
          tracePropagationOptions
        )
        await authFetch('https://myproject.supabase.co/rest/v1/table')

        // Should not inject because trace is not sampled
        expect(mockSet).not.toHaveBeenCalledWith('traceparent', expect.anything())
      })

      test('should inject trace headers when sampling decision is disabled', async () => {
        const mockResponse = { ok: true }
        const mockFetchImpl = jest.fn().mockResolvedValue(mockResponse)
        const mockSet = jest.fn()
        const mockHeadersImpl = jest.fn().mockReturnValue({
          has: jest.fn().mockReturnValue(false),
          set: mockSet,
        })

        ;(global as any).fetch = mockFetchImpl
        ;(global as any).Headers = mockHeadersImpl

        const supabaseKey = 'test-key'
        const supabaseUrl = 'https://myproject.supabase.co'
        const getAccessToken = jest.fn().mockResolvedValue('test-token')

        const tracePropagationOptions = {
          enabled: true,
          respectSamplingDecision: false,
        }

        const authFetch = fetchWithAuth(
          supabaseKey,
          supabaseUrl,
          getAccessToken,
          undefined,
          tracePropagationOptions
        )
        await authFetch('https://myproject.supabase.co/rest/v1/table')

        // Should inject even though trace is not sampled
        expect(mockSet).toHaveBeenCalledWith(
          'traceparent',
          '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00'
        )
      })

      test('should not override existing trace headers', async () => {
        const mockResponse = { ok: true }
        const mockFetchImpl = jest.fn().mockResolvedValue(mockResponse)
        const mockSet = jest.fn()
        const mockHeadersImpl = jest.fn().mockReturnValue({
          has: jest.fn().mockImplementation((key) => key === 'traceparent'),
          set: mockSet,
        })

        ;(global as any).fetch = mockFetchImpl
        ;(global as any).Headers = mockHeadersImpl

        const supabaseKey = 'test-key'
        const supabaseUrl = 'https://myproject.supabase.co'
        const getAccessToken = jest.fn().mockResolvedValue('test-token')

        const tracePropagationOptions = {
          enabled: true,
        }

        const authFetch = fetchWithAuth(
          supabaseKey,
          supabaseUrl,
          getAccessToken,
          undefined,
          tracePropagationOptions
        )
        await authFetch('https://myproject.supabase.co/rest/v1/table')

        // Should not override existing traceparent
        expect(mockSet).not.toHaveBeenCalledWith('traceparent', expect.anything())
      })
    })
  })
})
