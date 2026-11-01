import {
  resolveFetch,
  resolveHeadersConstructor,
  fetchWithAuth,
  checkApiKeyFormat,
  _resetTracingRuntimeWarning,
  _resetNonW3CPropagatorWarning,
} from '../../src/lib/fetch'
import {
  registerTraceContextExtractor,
  _unregisterTraceContextExtractor,
} from '../../src/lib/tracingRegistry'

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

      test('warns once for all sb_ keys without a parseable subtype', () => {
        // Keys with no second underscore share one dedup bucket ('unknown'), so the
        // full key value is never stored for deduplication.
        expect(() => checkApiKeyFormat('sb_')).not.toThrow()
        expect(warnSpy).toHaveBeenCalledTimes(1)

        expect(() => checkApiKeyFormat('sb_unknowntype')).not.toThrow()
        expect(warnSpy).toHaveBeenCalledTimes(1)
      })
    })

    describe('trace propagation', () => {
      // Same traceparent the OTel runtime would extract; trace flags `00` =
      // not sampled, so the sampling-gate tests exercise both branches.
      const UNSAMPLED_TRACEPARENT = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00'
      const SAMPLED_TRACEPARENT = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'

      beforeEach(() => {
        // What `import '@supabase/supabase-js/tracing'` does at runtime,
        // minus the OpenTelemetry dependency.
        registerTraceContextExtractor(() => ({ traceparent: UNSAMPLED_TRACEPARENT }))
      })

      afterEach(() => {
        _unregisterTraceContextExtractor()
        _resetTracingRuntimeWarning()
        _resetNonW3CPropagatorWarning()
      })

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

      test('should send only traceparent for non-sampled traces by default', async () => {
        // Full context from the propagator; only traceparent may go out.
        registerTraceContextExtractor(() => ({
          traceparent: UNSAMPLED_TRACEPARENT,
          tracestate: 'vendor1=value1',
          baggage: 'key1=value1',
        }))

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

        // trace_id still flows for log correlation, sampled flag untouched…
        expect(mockSet).toHaveBeenCalledWith('traceparent', UNSAMPLED_TRACEPARENT)
        // …but the vendor/application data channels are withheld.
        expect(mockSet).not.toHaveBeenCalledWith('tracestate', expect.anything())
        expect(mockSet).not.toHaveBeenCalledWith('baggage', expect.anything())
      })

      test('should inject the full trace context when sampling decision is disabled', async () => {
        registerTraceContextExtractor(() => ({
          traceparent: UNSAMPLED_TRACEPARENT,
          tracestate: 'vendor1=value1',
          baggage: 'key1=value1',
        }))

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

        // All three headers go out even though the trace is not sampled
        expect(mockSet).toHaveBeenCalledWith('traceparent', UNSAMPLED_TRACEPARENT)
        expect(mockSet).toHaveBeenCalledWith('tracestate', 'vendor1=value1')
        expect(mockSet).toHaveBeenCalledWith('baggage', 'key1=value1')
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

      test('warns once and skips tracing when enabled without the tracing runtime', async () => {
        _unregisterTraceContextExtractor()
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

        const mockSet = jest.fn()
        ;(global as any).fetch = jest.fn().mockResolvedValue({ ok: true })
        ;(global as any).Headers = jest.fn().mockReturnValue({
          has: jest.fn().mockReturnValue(false),
          set: mockSet,
        })

        const authFetch = fetchWithAuth(
          'test-key',
          'https://myproject.supabase.co',
          jest.fn().mockResolvedValue('test-token'),
          undefined,
          { enabled: true, respectSamplingDecision: false }
        )
        await authFetch('https://myproject.supabase.co/rest/v1/table')
        await authFetch('https://myproject.supabase.co/rest/v1/table')

        expect(mockSet).not.toHaveBeenCalledWith('traceparent', expect.anything())
        expect(warnSpy).toHaveBeenCalledTimes(1)
        expect(warnSpy.mock.calls[0][0]).toContain("import '@supabase/supabase-js/tracing'")

        warnSpy.mockRestore()
      })

      test('does not warn when trace propagation is disabled', async () => {
        _unregisterTraceContextExtractor()
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

        ;(global as any).fetch = jest.fn().mockResolvedValue({ ok: true })
        ;(global as any).Headers = jest.fn().mockReturnValue({
          has: jest.fn().mockReturnValue(false),
          set: jest.fn(),
        })

        const authFetch = fetchWithAuth(
          'test-key',
          'https://myproject.supabase.co',
          jest.fn().mockResolvedValue('test-token')
        )
        await authFetch('https://myproject.supabase.co/rest/v1/table')

        expect(warnSpy).not.toHaveBeenCalled()

        warnSpy.mockRestore()
      })

      test('picks up an extractor registered after the client was created', async () => {
        _unregisterTraceContextExtractor()
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

        const mockSet = jest.fn()
        ;(global as any).fetch = jest.fn().mockResolvedValue({ ok: true })
        ;(global as any).Headers = jest.fn().mockReturnValue({
          has: jest.fn().mockReturnValue(false),
          set: mockSet,
        })

        const authFetch = fetchWithAuth(
          'test-key',
          'https://myproject.supabase.co',
          jest.fn().mockResolvedValue('test-token'),
          undefined,
          { enabled: true, respectSamplingDecision: false }
        )

        // Before registration: warns and sends without trace headers.
        await authFetch('https://myproject.supabase.co/rest/v1/table')
        expect(mockSet).not.toHaveBeenCalledWith('traceparent', expect.anything())
        expect(warnSpy).toHaveBeenCalledTimes(1)

        // After registration (e.g. the tracing subpath finished evaluating):
        // the same fetch instance starts attaching headers.
        registerTraceContextExtractor(() => ({ traceparent: SAMPLED_TRACEPARENT }))
        await authFetch('https://myproject.supabase.co/rest/v1/table')
        expect(mockSet).toHaveBeenCalledWith('traceparent', SAMPLED_TRACEPARENT)

        warnSpy.mockRestore()
      })

      test('warns once when an active propagator emits no traceparent', async () => {
        // What the extractor returns under a Sentry propagator with the
        // default `propagateTraceparent: false`: vendor headers were written
        // to the carrier, but no W3C traceparent.
        registerTraceContextExtractor(() => ({ carrierKeys: ['sentry-trace', 'baggage'] }))
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

        const mockSet = jest.fn()
        ;(global as any).fetch = jest.fn().mockResolvedValue({ ok: true })
        ;(global as any).Headers = jest.fn().mockReturnValue({
          has: jest.fn().mockReturnValue(false),
          set: mockSet,
        })

        const authFetch = fetchWithAuth(
          'test-key',
          'https://myproject.supabase.co',
          jest.fn().mockResolvedValue('test-token'),
          undefined,
          { enabled: true }
        )
        await authFetch('https://myproject.supabase.co/rest/v1/table')
        await authFetch('https://myproject.supabase.co/rest/v1/table')

        expect(mockSet).not.toHaveBeenCalledWith('traceparent', expect.anything())
        expect(mockSet).not.toHaveBeenCalledWith('baggage', expect.anything())
        expect(warnSpy).toHaveBeenCalledTimes(1)
        expect(warnSpy.mock.calls[0][0]).toContain('sentry-trace')
        expect(warnSpy.mock.calls[0][0]).toContain('propagateTraceparent: true')

        warnSpy.mockRestore()
      })

      test('non-traceparent warning is generic when the propagator is not Sentry', async () => {
        registerTraceContextExtractor(() => ({ carrierKeys: ['b3'] }))
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

        ;(global as any).fetch = jest.fn().mockResolvedValue({ ok: true })
        ;(global as any).Headers = jest.fn().mockReturnValue({
          has: jest.fn().mockReturnValue(false),
          set: jest.fn(),
        })

        const authFetch = fetchWithAuth(
          'test-key',
          'https://myproject.supabase.co',
          jest.fn().mockResolvedValue('test-token'),
          undefined,
          { enabled: true }
        )
        await authFetch('https://myproject.supabase.co/rest/v1/table')

        expect(warnSpy).toHaveBeenCalledTimes(1)
        expect(warnSpy.mock.calls[0][0]).toContain('b3')
        expect(warnSpy.mock.calls[0][0]).not.toContain('Sentry')
        expect(warnSpy.mock.calls[0][0]).toContain('W3C trace context')

        warnSpy.mockRestore()
      })

      test('does not warn when there is no active trace', async () => {
        // Empty carrier: the propagator had nothing to write. Normal — the
        // warning must not fire for apps that simply have no span open.
        registerTraceContextExtractor(() => null)
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

        ;(global as any).fetch = jest.fn().mockResolvedValue({ ok: true })
        ;(global as any).Headers = jest.fn().mockReturnValue({
          has: jest.fn().mockReturnValue(false),
          set: jest.fn(),
        })

        const authFetch = fetchWithAuth(
          'test-key',
          'https://myproject.supabase.co',
          jest.fn().mockResolvedValue('test-token'),
          undefined,
          { enabled: true }
        )
        await authFetch('https://myproject.supabase.co/rest/v1/table')

        expect(warnSpy).not.toHaveBeenCalled()

        warnSpy.mockRestore()
      })
    })
  })
})
