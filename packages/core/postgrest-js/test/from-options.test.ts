import { PostgrestClient } from '../src/index'

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
