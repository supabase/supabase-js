import { PostgrestClient } from '../src/index'
import { mergeHeaders } from '../src/utils'

const REST_URL = 'http://localhost:3000'

function okFetch(body = '[]') {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    text: async () => body,
  })
}

// PostgrestBuilder hands headers to fetch as a plain object with lower-cased keys.
function requestHeaders(mock: jest.Mock, call = 0): Record<string, string> {
  const [, init] = mock.mock.calls[call] as [string, RequestInit]
  return init.headers as Record<string, string>
}

describe('mergeHeaders', () => {
  test('returns a copy of the base headers when nothing is merged in', () => {
    const base = new Headers({ 'X-Base': 'base' })
    const merged = mergeHeaders(base)

    expect(merged.get('X-Base')).toBe('base')
    merged.set('X-Base', 'changed')
    expect(base.get('X-Base')).toBe('base')
  })

  test('adds new keys and lets the merged side win on shared keys, case-insensitively', () => {
    const base = new Headers({ 'X-Shared': 'base', 'X-Base-Only': 'kept' })
    const merged = mergeHeaders(base, { 'x-shared': 'override', 'X-Extra': 'added' })

    expect(merged.get('X-Shared')).toBe('override')
    expect(merged.get('X-Base-Only')).toBe('kept')
    expect(merged.get('X-Extra')).toBe('added')
    expect(base.get('X-Shared')).toBe('base')
  })

  test('accepts every HeadersInit shape', () => {
    const base = new Headers({ 'X-Base': 'base' })

    expect(mergeHeaders(base, new Headers({ 'X-From': 'headers' })).get('X-From')).toBe('headers')
    expect(mergeHeaders(base, [['X-From', 'tuples']]).get('X-From')).toBe('tuples')
    expect(mergeHeaders(base, { 'X-From': 'record' }).get('X-From')).toBe('record')
  })
})

describe('PostgrestClient.from per-request options', () => {
  test('without options the query uses the client defaults', async () => {
    const clientFetch = okFetch()
    const client = new PostgrestClient(REST_URL, {
      fetch: clientFetch as any,
      headers: { 'X-Client': 'client' },
    })

    await client.from('users').select()

    expect(clientFetch).toHaveBeenCalledTimes(1)
    expect(requestHeaders(clientFetch)['x-client']).toBe('client')
  })

  test('merges per-request headers over client headers, per-request winning on shared keys', async () => {
    const clientFetch = okFetch()
    const client = new PostgrestClient(REST_URL, {
      fetch: clientFetch as any,
      headers: { 'X-Client': 'client', 'X-Shared': 'client' },
    })

    await client
      .from('users', { headers: { 'X-Shared': 'request', 'X-Request': 'request' } })
      .select()

    const headers = requestHeaders(clientFetch)
    expect(headers['x-client']).toBe('client')
    expect(headers['x-shared']).toBe('request')
    expect(headers['x-request']).toBe('request')
  })

  test('per-request headers do not leak into the client or later queries', async () => {
    const clientFetch = okFetch()
    const client = new PostgrestClient(REST_URL, {
      fetch: clientFetch as any,
      headers: { 'X-Shared': 'client' },
    })

    await client.from('users', { headers: { 'X-Shared': 'request', 'X-Request': 'once' } }).select()
    await client.from('users').select()

    expect(client.headers.get('X-Shared')).toBe('client')
    expect(client.headers.has('X-Request')).toBe(false)
    const second = requestHeaders(clientFetch, 1)
    expect(second['x-shared']).toBe('client')
    expect(second['x-request']).toBeUndefined()
  })

  test('uses the per-request fetch instead of the client fetch', async () => {
    const clientFetch = okFetch()
    const requestFetch = okFetch()
    const client = new PostgrestClient(REST_URL, { fetch: clientFetch as any })

    await client.from('users', { fetch: requestFetch as any }).select()

    expect(requestFetch).toHaveBeenCalledTimes(1)
    expect(clientFetch).not.toHaveBeenCalled()
  })

  test('per-request urlLengthLimit controls the URL length hint on aborted requests', async () => {
    const abortingFetch = () => {
      const error = new Error('The operation was aborted')
      error.name = 'AbortError'
      return Promise.reject(error)
    }
    const client = new PostgrestClient(REST_URL, { fetch: abortingFetch as any })

    const { error: withDefaultLimit } = await client.from('users').select()
    expect(withDefaultLimit?.hint).not.toContain('Your request URL is')

    const { error: withTightLimit } = await client.from('users', { urlLengthLimit: 10 }).select()
    expect(withTightLimit?.hint).toContain('Your request URL is')
  })

  describe('retry', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    // Advances fake timers until the query settles so retry backoff does not stall the test.
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

      while (!resolved) {
        await jest.advanceTimersByTimeAsync(100)
      }

      if (error) throw error
      return result as T
    }

    const originError = () => ({
      ok: false,
      status: 520,
      statusText: 'Origin Error',
      text: () => Promise.resolve('Cloudflare timeout'),
    })

    test('retry: false disables retries for that query only', async () => {
      const fetchMock = jest.fn().mockResolvedValue(originError())
      const client = new PostgrestClient(REST_URL, { fetch: fetchMock as any })

      const result = await runWithTimers(client.from('users', { retry: false }).select())

      expect(result.error).not.toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    test('retry: true re-enables retries when the client disabled them', async () => {
      const fetchMock = jest.fn().mockResolvedValue(originError())
      const client = new PostgrestClient(REST_URL, { fetch: fetchMock as any, retry: false })

      const result = await runWithTimers(client.from('users', { retry: true }).select())

      expect(result.error).not.toBeNull()
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1)
    })
  })
})

describe('PostgrestClient fetch decoration', () => {
  // Marks each pass through the wrapper so double wrapping shows up as 'w,w'.
  const tagging = (fetch: typeof globalThis.fetch): typeof globalThis.fetch => {
    return (input, init) => {
      const headers = new Headers(init?.headers)
      headers.set('X-Wrapped', headers.has('X-Wrapped') ? `${headers.get('X-Wrapped')},w` : 'w')
      return fetch(input, { ...init, headers })
    }
  }

  function wrappedHeader(mock: jest.Mock, call = 0): string | null {
    const [, init] = mock.mock.calls[call] as [string, RequestInit]
    return new Headers(init.headers).get('X-Wrapped')
  }

  test('wrapFetch is applied to the client-level fetch', async () => {
    const clientFetch = okFetch()
    const client = new PostgrestClient(REST_URL, { fetch: clientFetch as any, wrapFetch: tagging })

    await client.from('users').select()

    expect(wrappedHeader(clientFetch)).toBe('w')
  })

  test('wrapFetch is applied to a per-request fetch', async () => {
    const clientFetch = okFetch()
    const requestFetch = okFetch()
    const client = new PostgrestClient(REST_URL, { fetch: clientFetch as any, wrapFetch: tagging })

    await client.from('users', { fetch: requestFetch as any }).select()

    expect(clientFetch).not.toHaveBeenCalled()
    expect(wrappedHeader(requestFetch)).toBe('w')
  })

  test('schema() carries wrapFetch over without wrapping the client fetch twice', async () => {
    const clientFetch = okFetch()
    const requestFetch = okFetch()
    const client = new PostgrestClient(REST_URL, { fetch: clientFetch as any, wrapFetch: tagging })
    const schemaClient = client.schema('other')

    await schemaClient.from('users').select()
    await schemaClient.from('users', { fetch: requestFetch as any }).select()

    expect(wrappedHeader(clientFetch)).toBe('w')
    expect(wrappedHeader(requestFetch)).toBe('w')
  })

  test('timeout applies to a per-request fetch', async () => {
    const requestFetch = okFetch()
    const withTimeout = new PostgrestClient(REST_URL, { timeout: 5000 })
    const withoutTimeout = new PostgrestClient(REST_URL)

    await withTimeout.from('users', { fetch: requestFetch as any }).select()
    await withoutTimeout.from('users', { fetch: requestFetch as any }).select()

    const [, timedInit] = requestFetch.mock.calls[0] as [string, RequestInit]
    const [, plainInit] = requestFetch.mock.calls[1] as [string, RequestInit]
    expect(timedInit.signal).toBeInstanceOf(AbortSignal)
    expect(plainInit.signal).toBeUndefined()
  })

  test('schema() carries timeout over to per-request fetches', async () => {
    const requestFetch = okFetch()
    const client = new PostgrestClient(REST_URL, { timeout: 5000 })

    await client
      .schema('other')
      .from('users', { fetch: requestFetch as any })
      .select()

    const [, init] = requestFetch.mock.calls[0] as [string, RequestInit]
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
})
