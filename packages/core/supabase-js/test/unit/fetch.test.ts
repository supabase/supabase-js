import {
  resolveFetch,
  resolveHeadersConstructor,
  fetchWithAuth,
  checkApiKeyFormat,
} from '../../src/lib/fetch'

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

    describe('omitApiKeyAsBearer option', () => {
      const setupHeaders = (existing: string[] = []) => {
        const mockSet = jest.fn()
        const mockHeadersImpl = jest.fn().mockReturnValue({
          has: jest.fn().mockImplementation((key) => existing.includes(key)),
          set: mockSet,
        })
        ;(global as any).fetch = jest.fn().mockResolvedValue({ ok: true })
        ;(global as any).Headers = mockHeadersImpl
        return mockSet
      }

      test('omits Authorization for a new-format key when there is no session', async () => {
        const mockSet = setupHeaders()
        const supabaseKey = 'sb_publishable_abc123'
        const getAccessToken = jest.fn().mockResolvedValue(null)

        const authFetch = fetchWithAuth(
          supabaseKey,
          'https://myproject.supabase.co',
          getAccessToken,
          undefined,
          undefined,
          { omitApiKeyAsBearer: true }
        )
        await authFetch('https://example.com')

        expect(mockSet).toHaveBeenCalledWith('apikey', supabaseKey)
        expect(mockSet).not.toHaveBeenCalledWith('Authorization', expect.stringContaining('Bearer'))
      })

      test('sends Authorization for a new-format key when a session token exists', async () => {
        const mockSet = setupHeaders()
        const supabaseKey = 'sb_publishable_abc123'
        const getAccessToken = jest.fn().mockResolvedValue('user-jwt')

        const authFetch = fetchWithAuth(
          supabaseKey,
          'https://myproject.supabase.co',
          getAccessToken,
          undefined,
          undefined,
          { omitApiKeyAsBearer: true }
        )
        await authFetch('https://example.com')

        expect(mockSet).toHaveBeenCalledWith('Authorization', 'Bearer user-jwt')
      })

      test('keeps sending a legacy (JWT) key in Authorization when there is no session', async () => {
        const mockSet = setupHeaders()
        const supabaseKey = 'header.payload.signature'
        const getAccessToken = jest.fn().mockResolvedValue(null)

        const authFetch = fetchWithAuth(
          supabaseKey,
          'https://myproject.supabase.co',
          getAccessToken,
          undefined,
          undefined,
          { omitApiKeyAsBearer: true }
        )
        await authFetch('https://example.com')

        expect(mockSet).toHaveBeenCalledWith('Authorization', `Bearer ${supabaseKey}`)
      })

      test('preserves a caller-supplied Authorization header', async () => {
        const mockSet = setupHeaders(['Authorization'])
        const supabaseKey = 'sb_publishable_abc123'
        const getAccessToken = jest.fn().mockResolvedValue('user-jwt')

        const authFetch = fetchWithAuth(
          supabaseKey,
          'https://myproject.supabase.co',
          getAccessToken,
          undefined,
          undefined,
          { omitApiKeyAsBearer: true }
        )
        await authFetch('https://example.com')

        expect(mockSet).not.toHaveBeenCalledWith('Authorization', expect.anything())
      })

      test('without the option, a new-format key is still sent in Authorization (scoping guard)', async () => {
        const mockSet = setupHeaders()
        const supabaseKey = 'sb_publishable_abc123'
        const getAccessToken = jest.fn().mockResolvedValue(null)

        const authFetch = fetchWithAuth(
          supabaseKey,
          'https://myproject.supabase.co',
          getAccessToken
        )
        await authFetch('https://example.com')

        expect(mockSet).toHaveBeenCalledWith('Authorization', `Bearer ${supabaseKey}`)
      })

      test('sends a temporary key as apikey AND Bearer fallback on the regular path', async () => {
        const mockSet = setupHeaders()
        const supabaseKey = 'sb_temp_nonce123_payload456'
        const getAccessToken = jest.fn().mockResolvedValue(null)

        const authFetch = fetchWithAuth(
          supabaseKey,
          'https://myproject.supabase.co',
          getAccessToken
        )
        await authFetch('https://example.com')

        expect(mockSet).toHaveBeenCalledWith('apikey', supabaseKey)
        expect(mockSet).toHaveBeenCalledWith('Authorization', `Bearer ${supabaseKey}`)
      })

      test('omitApiKeyAsBearer does not suppress Bearer for a temporary key', async () => {
        // Bearer omission is scoped to new-format keys; temp keys keep the legacy fallback.
        const mockSet = setupHeaders()
        const supabaseKey = 'sb_temp_nonce123_payload456'
        const getAccessToken = jest.fn().mockResolvedValue(null)

        const authFetch = fetchWithAuth(
          supabaseKey,
          'https://myproject.supabase.co',
          getAccessToken,
          undefined,
          undefined,
          { omitApiKeyAsBearer: true }
        )
        await authFetch('https://example.com')

        expect(mockSet).toHaveBeenCalledWith('Authorization', `Bearer ${supabaseKey}`)
      })
    })

    describe('checkApiKeyFormat', () => {
      // NOTE: warn deduplication is per subtype and module-scoped, so every test in this
      // block must use a key subtype not used anywhere else in this file.
      let warnSpy: jest.SpyInstance

      beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      })

      afterEach(() => {
        warnSpy.mockRestore()
      })

      test('accepts a temporary key silently', () => {
        expect(() => checkApiKeyFormat('sb_temp_nonce123_payload456')).not.toThrow()
        expect(warnSpy).not.toHaveBeenCalled()
      })

      test('warns, but does not throw, for an unrecognized sb_ key subtype', () => {
        expect(() => checkApiKeyFormat('sb_unknown_abc123')).not.toThrow()
        expect(warnSpy).toHaveBeenCalledTimes(1)
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringMatching(/Unrecognized Supabase API key format/)
        )
      })

      test('never includes the key in the warning message', () => {
        const key = 'sb_futuretype_supersecretvalue'
        checkApiKeyFormat(key)
        expect(warnSpy).toHaveBeenCalledTimes(1)
        expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining(key))
      })

      test('warns only once per subtype', () => {
        checkApiKeyFormat('sb_once_key1')
        checkApiKeyFormat('sb_once_key2')
        expect(warnSpy).toHaveBeenCalledTimes(1)

        checkApiKeyFormat('sb_other_key1')
        expect(warnSpy).toHaveBeenCalledTimes(2)
      })

      test.each([
        'sb_publishable_abc123',
        'sb_secret_abc123',
        'sb_temp_abc123',
        'header.payload.signature',
        'anon-key',
      ])('accepts recognized / legacy key %p without warning', (key) => {
        expect(() => checkApiKeyFormat(key)).not.toThrow()
        expect(warnSpy).not.toHaveBeenCalled()
      })

      test.each(['sb_', 'sb_unknowntype'])(
        'warns for malformed sb_ key %p without throwing',
        (key) => {
          expect(() => checkApiKeyFormat(key)).not.toThrow()
          expect(warnSpy).toHaveBeenCalledTimes(1)
        }
      )
    })

    describe('trace propagation', () => {
      test('should not inject trace headers by default (no options)', async () => {
        const mockResponse = { ok: true }
        const mockFetchImpl = jest.fn().mockResolvedValue(mockResponse)
        const mockSet = jest.fn()
        const mockHeadersImpl = jest.fn().mockReturnValue({
          has: jest.fn().mockReturnValue(false),
          set: mockSet,
        })

        ;(global as any).fetch = mockFetchImpl
        ;(global as any).Headers = mockHeadersImpl

        const authFetch = fetchWithAuth(
          'test-key',
          'https://myproject.supabase.co',
          jest.fn().mockResolvedValue('test-token')
        )
        await authFetch('https://myproject.supabase.co/rest/v1/table')

        expect(mockSet).not.toHaveBeenCalledWith('traceparent', expect.anything())
        expect(mockSet).not.toHaveBeenCalledWith('tracestate', expect.anything())
        expect(mockSet).not.toHaveBeenCalledWith('baggage', expect.anything())
      })

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
