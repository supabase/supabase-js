import PostgrestClient from '../src/PostgrestClient'
import { fetchWithRetry } from '../src/fetchWithRetry'
import { getRetryDelay } from '../src/types/common/common'

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

  /**
   * Record the delay of every setTimeout call while running timers immediately.
   */
  function captureDelays(): number[] {
    const delaysSeen: number[] = []
    const originalSetTimeout = globalThis.setTimeout
    jest.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, delay?: number) => {
      delaysSeen.push(delay as number)
      return originalSetTimeout(fn, 0)
    }) as typeof setTimeout)
    return delaysSeen
  }

  function retryableResponse(status: number, headers: Record<string, string> = {}) {
    return {
      ok: false,
      status,
      statusText: 'Service Unavailable',
      headers: new Headers(headers),
      text: () => Promise.resolve('unavailable'),
    }
  }

  const okResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    text: () => Promise.resolve('[]'),
  }

  describe('exponential backoff', () => {
    it('should use exponential backoff delays with full jitter', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5)
      const delaysSeen = captureDelays()

      // All calls return 520 to trigger retries
      fetchMock.mockResolvedValue({
        ok: false,
        status: 520,
        statusText: 'Origin Error',
        text: () => Promise.resolve('Cloudflare timeout'),
      })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      await runWithTimers(client.from('users').select())

      // Half of the 1000ms, 2000ms, 4000ms upper bounds
      expect(delaysSeen).toEqual([500, 1000, 2000])
      expect(Math.random).toHaveBeenCalledTimes(3)
    })

    it('should keep jittered delays within [0, min(30s, 1s * 2^attempt))', () => {
      const random = jest.spyOn(Math, 'random')

      random.mockReturnValue(0)
      expect(getRetryDelay(0)).toBe(0)
      expect(getRetryDelay(10)).toBe(0)

      random.mockReturnValue(0.999)
      expect(getRetryDelay(0)).toBeCloseTo(999)
      expect(getRetryDelay(2)).toBeCloseTo(3996)
      expect(getRetryDelay(10)).toBeCloseTo(29970)
    })

    it('should jitter network error retries', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.25)
      const delaysSeen = captureDelays()

      fetchMock.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce(okResponse)

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select())

      expect(result.error).toBeNull()
      expect(delaysSeen).toEqual([250])
    })
  })

  describe('Retry-After header', () => {
    beforeEach(() => {
      jest.setSystemTime(new Date('2026-10-21T07:28:00Z'))
      jest.spyOn(Math, 'random').mockReturnValue(0.25)
    })

    it('should wait for a delta-seconds Retry-After', async () => {
      const delaysSeen = captureDelays()
      fetchMock
        .mockResolvedValueOnce(retryableResponse(503, { 'Retry-After': '2' }))
        .mockResolvedValueOnce(okResponse)

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select())

      expect(result.error).toBeNull()
      expect(delaysSeen).toEqual([2000])
    })

    it.each([
      ['IMF-fixdate', 'Wed, 21 Oct 2026 07:28:05 GMT'],
      ['obsolete RFC 850', 'Wednesday, 21-Oct-26 07:28:05 GMT'],
      ['obsolete asctime', 'Wed Oct 21 07:28:05 2026'],
    ])('should wait until an HTTP-date Retry-After (%s)', async (_label, retryAfter) => {
      const delaysSeen = captureDelays()
      fetchMock
        .mockResolvedValueOnce(retryableResponse(503, { 'Retry-After': retryAfter }))
        .mockResolvedValueOnce(okResponse)

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select())

      expect(result.error).toBeNull()
      expect(delaysSeen).toEqual([5000])
    })

    it.each([
      ['0', '0'],
      ['a date that has passed', 'Wed, 21 Oct 2026 07:27:00 GMT'],
      ['an unparseable value', 'soon'],
      ['a negative number', '-5'],
      ['an ISO date that is not an HTTP-date', '2099-01-01'],
    ])('should fall back to the jittered wait for %s', async (_label, retryAfter) => {
      const delaysSeen = captureDelays()
      fetchMock
        .mockResolvedValueOnce(retryableResponse(503, { 'Retry-After': retryAfter }))
        .mockResolvedValueOnce(okResponse)

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select())

      expect(result.error).toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(delaysSeen).toEqual([250])
    })

    it.each([
      ['delta-seconds', '3600'],
      ['an HTTP-date', 'Wed, 21 Oct 2026 07:29:00 GMT'],
    ])(
      'should stop retrying and return the response when %s Retry-After exceeds 30s',
      async (_label, retryAfter) => {
        const delaysSeen = captureDelays()
        fetchMock.mockResolvedValue(retryableResponse(503, { 'Retry-After': retryAfter }))

        const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
        const result = await runWithTimers(client.from('users').select())

        expect(result.error).not.toBeNull()
        expect(result.status).toBe(503)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(delaysSeen).toEqual([])
      }
    )

    it('should still wait for a Retry-After of exactly 30s', async () => {
      const delaysSeen = captureDelays()
      fetchMock
        .mockResolvedValueOnce(retryableResponse(503, { 'Retry-After': '30' }))
        .mockResolvedValueOnce(okResponse)

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select())

      expect(result.error).toBeNull()
      expect(delaysSeen).toEqual([30000])
    })
  })

  describe('retryable methods', () => {
    it('should NOT retry OPTIONS requests', async () => {
      fetchMock.mockResolvedValue(retryableResponse(520))

      const res = await runWithTimers(
        fetchWithRetry(
          fetchMock,
          'http://localhost:3000/users',
          { method: 'OPTIONS', headers: {} },
          true
        )
      )

      expect(res.status).toBe(520)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('should retry HEAD requests', async () => {
      fetchMock.mockResolvedValueOnce(retryableResponse(520)).mockResolvedValueOnce(okResponse)

      const res = await runWithTimers(
        fetchWithRetry(
          fetchMock,
          'http://localhost:3000/users',
          { method: 'HEAD', headers: {} },
          true
        )
      )

      expect(res.status).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
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

    // AbortSignal.timeout() rejects with TimeoutError, not AbortError.
    it('should rethrow TimeoutError immediately without retrying when the request signal is aborted', async () => {
      const timeoutError = new Error('The operation was aborted due to timeout')
      timeoutError.name = 'TimeoutError'

      fetchMock.mockRejectedValue(timeoutError)

      const controller = new AbortController()
      controller.abort()

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(
        client.from('users').select().abortSignal(controller.signal)
      )

      expect(result.error).not.toBeNull()
      expect(result.error?.message).toContain('TimeoutError')
      expect(fetchMock).toHaveBeenCalledTimes(1) // No retries
    })

    // A custom fetch implementation can throw its own TimeoutError for a
    // timeout unrelated to our AbortSignal; that one is still a transient,
    // retryable network error.
    it('should retry a TimeoutError that is not tied to an aborted request signal', async () => {
      const timeoutError = new Error('socket timeout')
      timeoutError.name = 'TimeoutError'

      fetchMock.mockRejectedValueOnce(timeoutError).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('[]'),
        headers: new Headers(),
      })

      const client = new PostgrestClient('http://localhost:3000', { fetch: fetchMock })
      const result = await runWithTimers(client.from('users').select())

      expect(result.error).toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(2) // Retried once
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
