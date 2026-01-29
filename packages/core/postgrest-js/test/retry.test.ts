import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import PostgrestClient from '../src/PostgrestClient'

describe('Automatic Retries', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /**
   * Helper to run async code with fake timers
   */
  async function runWithTimers<T>(promise: Promise<T>): Promise<T> {
    let result: T | undefined
    let error: Error | undefined
    let resolved = false

    promise
      .then((r) => {
        result = r
        resolved = true
      })
      .catch((e) => {
        error = e
        resolved = true
      })

    // Keep advancing timers until promise resolves
    while (!resolved) {
      await vi.advanceTimersByTimeAsync(100)
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
      const firstRetryHeaders = firstRetryCall[1].headers as Headers
      expect(firstRetryHeaders.get('X-Retry-Count')).toBe('1')

      const [, , secondRetryCall] = fetchMock.mock.calls
      const secondRetryHeaders = secondRetryCall[1].headers as Headers
      expect(secondRetryHeaders.get('X-Retry-Count')).toBe('2')
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
      vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, delay) => {
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
