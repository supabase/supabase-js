import PostgrestClient from '../src/PostgrestClient'

describe('Automatic Retries', () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    fetchMock = jest.fn()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  /**
   * Helper to run async code with fake timers
   */
  async function runWithTimers<T>(promise: PromiseLike<T>): Promise<T> {
    let result: T | undefined
    let error: Error | undefined
    let resolved = false

    promise.then(
      (r) => {
        result = r
        resolved = true
      },
      (e) => {
        error = e
        resolved = true
      }
    )

    // Keep advancing timers until promise resolves
    while (!resolved) {
      await jest.advanceTimersByTimeAsync(100)
    }

    if (error) throw error
    return result as T
  }

  describe('default retry behavior', () => {
    it('should retry GET requests on 520 errors by default', async () => {
      // First two calls return 520, third succeeds
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 520,
          statusText: 'Origin Error',
          text: () => Promise.resolve('Cloudflare timeout'),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 520,
          statusText: 'Origin Error',
          text: () => Promise.resolve('Cloudflare timeout'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: () => Promise.resolve(JSON.stringify([{ id: 1, name: 'test' }])),
          headers: new Headers(),
        })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select())

      expect(result.error).toBeNull()
      expect(result.data).toEqual([{ id: 1, name: 'test' }])
      expect(fetchMock).toHaveBeenCalledTimes(3)

      // Verify X-Retry-Count header was sent on retries
      const [, firstRetryCall] = fetchMock.mock.calls
      const firstRetryHeaders = firstRetryCall[1].headers as Record<string, string>
      expect(firstRetryHeaders['X-Retry-Count']).toBe('1')

      const [, , secondRetryCall] = fetchMock.mock.calls
      const secondRetryHeaders = secondRetryCall[1].headers as Record<string, string>
      expect(secondRetryHeaders['X-Retry-Count']).toBe('2')
    })

    it('should NOT retry POST requests even on 520 errors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 520,
        statusText: 'Origin Error',
        text: () => Promise.resolve('Cloudflare timeout'),
      })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').insert({ name: 'test' }))

      expect(result.error).not.toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(1) // No retries
    })

    it('should NOT retry on non-520 errors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error'),
      })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select())

      expect(result.error).not.toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(1) // No retries
    })

    it('should stop retrying after max retries (default 3)', async () => {
      // All calls return 520
      fetchMock.mockResolvedValue({
        ok: false,
        status: 520,
        statusText: 'Origin Error',
        text: () => Promise.resolve('Cloudflare timeout'),
      })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select())

      expect(result.error).not.toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
    })
  })

  describe('disabling retries', () => {
    it('should not retry when retry is set to false globally', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 520,
        statusText: 'Origin Error',
        text: () => Promise.resolve('Cloudflare timeout'),
      })

      const client = new PostgrestClient('http://localhost:3000', {
        fetch: fetchMock,
        retry: false,
      })
      const result = await runWithTimers(client.from('users').select())

      expect(result.error).not.toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(1) // No retries
    })

    it('should not retry when retry is set to false per-request', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 520,
        statusText: 'Origin Error',
        text: () => Promise.resolve('Cloudflare timeout'),
      })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select().retry(false))

      expect(result.error).not.toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(1) // No retries
    })

    it('per-request retry(false) should override global retry(true)', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 520,
        statusText: 'Origin Error',
        text: () => Promise.resolve('Cloudflare timeout'),
      })

      // Global: retries enabled (default)
      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select().retry(false))

      expect(result.error).not.toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(1) // No retries due to per-request override
    })

    it('per-request retry(true) should override global retry(false)', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 520,
          statusText: 'Origin Error',
          text: () => Promise.resolve('Cloudflare timeout'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: () => Promise.resolve(JSON.stringify([{ id: 1 }])),
          headers: new Headers(),
        })

      // Global: retries disabled
      const client = new PostgrestClient('http://localhost:3000', {
        fetch: fetchMock,
        retry: false,
      })
      const result = await runWithTimers(client.from('users').select().retry(true))

      expect(result.error).toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(2) // Retried once due to per-request override
    })
  })

  describe('exponential backoff', () => {
    it('should use exponential backoff delays', async () => {
      let delaysSeen: number[] = []
      const originalSleep = globalThis.setTimeout
      jest.spyOn(globalThis, 'setTimeout').mockImplementation((fn, delay) => {
        delaysSeen.push(delay as number)
        return originalSleep(fn, 0) // Run immediately for testing
      })

      // All calls return 520 to trigger retries
      fetchMock.mockResolvedValue({
        ok: false,
        status: 520,
        statusText: 'Origin Error',
        text: () => Promise.resolve('Cloudflare timeout'),
      })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      await runWithTimers(client.from('users').select())

      // Verify exponential backoff: 1000ms, 2000ms, 4000ms
      expect(delaysSeen).toContain(1000) // First retry
      expect(delaysSeen).toContain(2000) // Second retry
      expect(delaysSeen).toContain(4000) // Third retry
    })
  })

  describe('retry with RPC', () => {
    it('should retry GET RPC calls on 520 errors', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 520,
          statusText: 'Origin Error',
          text: () => Promise.resolve('Cloudflare timeout'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: () => Promise.resolve(JSON.stringify({ result: 42 })),
          headers: new Headers(),
        })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.rpc('my_function', {}, { get: true }))

      expect(result.error).toBeNull()
      expect(result.data).toEqual({ result: 42 })
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('should NOT retry POST RPC calls', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 520,
        statusText: 'Origin Error',
        text: () => Promise.resolve('Cloudflare timeout'),
      })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.rpc('my_function', { arg: 1 }))

      expect(result.error).not.toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(1) // No retries
    })
  })

  describe('network errors', () => {
    it('should retry on network errors for GET requests', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(JSON.stringify([{ id: 1 }])),
        headers: new Headers(),
      })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select())

      expect(result.error).toBeNull()
      expect(result.data).toEqual([{ id: 1 }])
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('should NOT retry on network errors for POST requests', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'))

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').insert({ name: 'test' }))

      expect(result.error).not.toBeNull()
      expect(result.error?.message).toContain('Network error')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('should not retry network errors when retry is disabled', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'))

      const client = new PostgrestClient('http://localhost:3000', {
        fetch: fetchMock,
        retry: false,
      })
      const result = await runWithTimers(client.from('users').select())

      expect(result.error).not.toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('503 / PGRST002 (schema cache not ready)', () => {
    it('should retry on 503 with Retry-After header and succeed', async () => {
      const pgrst002Body = JSON.stringify({
        code: 'PGRST002',
        details: null,
        hint: null,
        message: 'Could not query the database for the schema cache. Retrying.',
      })

      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Retry-After': '0', 'Content-Type': 'application/json' }),
          text: () => Promise.resolve(pgrst002Body),
          body: { cancel: jest.fn().mockResolvedValue(undefined) },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          text: () => Promise.resolve(JSON.stringify([{ id: 1 }])),
        })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select())

      expect(result.error).toBeNull()
      expect(result.data).toEqual([{ id: 1 }])
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('should surface the error if retry also returns 503', async () => {
      const pgrst002Body = JSON.stringify({
        code: 'PGRST002',
        details: null,
        hint: null,
        message: 'Could not query the database for the schema cache. Retrying.',
      })
      const mockBody = { cancel: jest.fn().mockResolvedValue(undefined) }

      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'Retry-After': '0', 'Content-Type': 'application/json' }),
        text: () => Promise.resolve(pgrst002Body),
        body: mockBody,
      })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select())

      expect(result.error).not.toBeNull()
      expect(result.error?.code).toBe('PGRST002')
      expect(result.status).toBe(503)
      expect(fetchMock).toHaveBeenCalledTimes(4) // 1 original + 3 retries
    })

    it('should drain the response body before retrying', async () => {
      const textMock = jest.fn().mockResolvedValue(
        JSON.stringify({
          code: 'PGRST002',
          details: null,
          hint: null,
          message: 'err',
        })
      )

      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Retry-After': '0', 'Content-Type': 'application/json' }),
          text: textMock,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          text: () => Promise.resolve('[]'),
        })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      await runWithTimers(client.from('users').select())

      // text() is called once to drain body before retry, once by processResponse for the retry
      expect(textMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('Retry-After header', () => {
    // `Retry-After` is either delay-seconds or an HTTP-date (RFC 9110 §10.2.3).
    // Capture the delay actually slept so each form can be asserted directly.
    let delaysSeen: number[]

    beforeEach(() => {
      delaysSeen = []
      const realSetTimeout = globalThis.setTimeout
      jest.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: any, delay?: number) => {
        delaysSeen.push(delay as number)
        return realSetTimeout(fn, 0)
      }) as any)
    })

    const unavailable = (retryAfter: string) => ({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({ 'Retry-After': retryAfter, 'Content-Type': 'application/json' }),
      text: () => Promise.resolve(JSON.stringify({ code: 'PGRST002', message: 'retrying' })),
    })

    const success = () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: () => Promise.resolve('[]'),
    })

    /** Delay slept before the single retry triggered by a 503 carrying `retryAfter`. */
    async function delayFor(retryAfter: string): Promise<number> {
      fetchMock.mockResolvedValueOnce(unavailable(retryAfter)).mockResolvedValueOnce(success())
      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select())
      expect(result.error).toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(2)
      return delaysSeen[0]
    }

    it('should honour delay-seconds', async () => {
      expect(await delayFor('2')).toBe(2000)
    })

    it('should treat delay-seconds of 0 as an immediate retry', async () => {
      expect(await delayFor('0')).toBe(0)
    })

    it('should honour an HTTP-date instead of retrying immediately', async () => {
      const retryAt = new Date(Date.now() + 5000).toUTCString()
      const delay = await delayFor(retryAt)
      // Whole-second header resolution means the delay lands just under 5s.
      expect(delay).toBeGreaterThan(3000)
      expect(delay).toBeLessThanOrEqual(5000)
    })

    it('should retry immediately for an HTTP-date already in the past', async () => {
      expect(await delayFor(new Date(Date.now() - 60_000).toUTCString())).toBe(0)
    })

    it('should fall back to exponential backoff for an unparseable value', async () => {
      // Previously parsed as 0 via `parseInt`, producing an immediate hot retry.
      expect(await delayFor('soon')).toBe(1000)
    })

    it('should fall back to exponential backoff for an empty value', async () => {
      expect(await delayFor('')).toBe(1000)
    })

    it('should not read a trailing-unit value as a bare number of seconds', async () => {
      expect(await delayFor('30s')).toBe(1000)
    })

    it('should cap a very large delay-seconds value', async () => {
      // A day-long Retry-After previously stalled the request for 24 hours.
      expect(await delayFor('86400')).toBe(30000)
    })

    it('should cap a far-future HTTP-date', async () => {
      const farFuture = new Date(Date.now() + 86_400_000).toUTCString()
      expect(await delayFor(farFuture)).toBe(30000)
    })
  })

  describe('AbortError handling', () => {
    it('should rethrow AbortError immediately without retrying', async () => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'

      fetchMock.mockRejectedValue(abortError)

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select())

      expect(result.error).not.toBeNull()
      expect(result.error?.message).toContain('AbortError')
      expect(fetchMock).toHaveBeenCalledTimes(1) // No retries
    })

    // Serverless / realm-crossing runtimes (Netlify Functions, AWS Lambda)
    // can reject native fetch with values that do not pass `instanceof Error`
    // against the consumer realm. The abort branch must still recognise them by
    // their `name`/`code` shape.
    it('should rethrow plain-object AbortError-shaped rejections without retrying', async () => {
      fetchMock.mockRejectedValue({ name: 'AbortError', message: 'aborted' })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select())

      expect(result.error).not.toBeNull()
      expect(result.error?.message).toContain('AbortError')
      expect(fetchMock).toHaveBeenCalledTimes(1) // No retries
    })

    it('should rethrow plain-object ABORT_ERR-coded rejections without retrying', async () => {
      fetchMock.mockRejectedValue({ code: 'ABORT_ERR', message: 'aborted' })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select())

      expect(result.error).not.toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(1) // No retries
    })
  })

  describe('shouldThrowOnError interaction', () => {
    it('should NOT retry a non-retryable error with throwOnError()', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () =>
          Promise.resolve(
            JSON.stringify({ code: 'PGRST000', message: 'bad input', hint: null, details: null })
          ),
        headers: new Headers(),
      })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      await expect(runWithTimers(client.from('users').select().throwOnError())).rejects.toThrow(
        'bad input'
      )

      expect(fetchMock).toHaveBeenCalledTimes(1) // No retries for application-level errors
    })

    it('should NOT retry a retryable status code after exhaustion when using throwOnError()', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 520,
        statusText: 'Origin Error',
        text: () => Promise.resolve('Cloudflare timeout'),
        headers: new Headers(),
      })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      await expect(runWithTimers(client.from('users').select().throwOnError())).rejects.toThrow()

      expect(fetchMock).toHaveBeenCalledTimes(4) // 1 initial + 3 retries, then throws
    })
  })

  describe('schema switching', () => {
    it('should preserve retry setting when switching schemas', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 520,
        statusText: 'Origin Error',
        text: () => Promise.resolve('Cloudflare timeout'),
      })

      const client = new PostgrestClient('http://localhost:3000', {
        fetch: fetchMock,
        retry: false,
      })
      const result = await runWithTimers(client.schema('other_schema').from('users').select())

      expect(result.error).not.toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(1) // No retries - setting preserved
    })
  })
})
