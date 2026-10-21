import GoTrueClient from '../src/GoTrueClient'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'

const createStoredSession = () => ({
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: 'test-user-id',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'user@example.com',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date(0).toISOString(),
  },
})

describe('GoTrueClient signOut offline cleanup', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  test.each(['global', 'local'] as const)(
    'removes the local session when %s signOut cannot reach the auth server',
    async (scope) => {
      const storageKey = `test-signout-offline-${scope}`
      const storage = memoryLocalStorageAdapter({
        [storageKey]: JSON.stringify(createStoredSession()),
        [`${storageKey}-code-verifier`]: 'test-code-verifier',
      })
      const mockFetch = jest.fn().mockRejectedValue(new Error('offline'))
      const client = new GoTrueClient({
        url: 'http://localhost:9999',
        autoRefreshToken: false,
        persistSession: true,
        storage,
        storageKey,
        fetch: mockFetch,
      })

      const { error } = await client.signOut({ scope })

      expect(error?.name).toBe('AuthRetryableFetchError')
      expect(await storage.getItem(storageKey)).toBeNull()
      expect(await storage.getItem(`${storageKey}-code-verifier`)).toBeNull()
    }
  )

  test('keeps the current session for others scope when remote signOut fails', async () => {
    const storageKey = 'test-signout-offline-others'
    const storage = memoryLocalStorageAdapter({
      [storageKey]: JSON.stringify(createStoredSession()),
    })
    const mockFetch = jest.fn().mockRejectedValue(new Error('offline'))
    const client = new GoTrueClient({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      persistSession: true,
      storage,
      storageKey,
      fetch: mockFetch,
    })

    const { error } = await client.signOut({ scope: 'others' })

    expect(error?.name).toBe('AuthRetryableFetchError')
    expect(await storage.getItem(storageKey)).not.toBeNull()
  })
})

describe('GoTrueClient signOut with keepLocalSessionOnError', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  const jsonResponse = (status: number) =>
    new Response(JSON.stringify({ code: status, msg: 'logout failed' }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  const setup = (storageKey: string, mockFetch: jest.Mock) => {
    const storage = memoryLocalStorageAdapter({
      [storageKey]: JSON.stringify(createStoredSession()),
    })
    const client = new GoTrueClient({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      persistSession: true,
      storage,
      storageKey,
      fetch: mockFetch,
    })
    const events: string[] = []
    client.onAuthStateChange((event) => {
      events.push(event)
    })
    return { storage, client, events }
  }

  test('clears the session on a 5xx global signOut by default', async () => {
    const storageKey = 'test-signout-5xx-default'
    const mockFetch = jest.fn().mockResolvedValue(jsonResponse(500))
    const { storage, client, events } = setup(storageKey, mockFetch)

    const { error } = await client.signOut({ scope: 'global' })

    expect(error?.name).toBe('AuthRetryableFetchError')
    expect(await storage.getItem(storageKey)).toBeNull()
    expect(events).toContain('SIGNED_OUT')
  })

  test.each([
    ['a 5xx response', () => jest.fn().mockResolvedValue(jsonResponse(500))],
    ['a network error', () => jest.fn().mockRejectedValue(new Error('offline'))],
  ])('keeps the session and allows a retry after %s', async (_, makeFetch) => {
    const storageKey = 'test-signout-keep-session'
    const mockFetch = makeFetch()
    const { storage, client, events } = setup(storageKey, mockFetch)

    const { error } = await client.signOut({ scope: 'global', keepLocalSessionOnError: true })

    expect(error?.name).toBe('AuthRetryableFetchError')
    expect(await storage.getItem(storageKey)).not.toBeNull()
    expect(events).not.toContain('SIGNED_OUT')

    const callsBeforeRetry = mockFetch.mock.calls.length
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }))

    const retry = await client.signOut({ scope: 'global', keepLocalSessionOnError: true })

    expect(retry.error).toBeNull()
    expect(mockFetch.mock.calls.length).toBe(callsBeforeRetry + 1)
    expect(await storage.getItem(storageKey)).toBeNull()
    expect(events).toContain('SIGNED_OUT')
  })

  test('keeps the session when the server responds with another 4xx', async () => {
    const storageKey = 'test-signout-keep-session-429'
    const mockFetch = jest.fn().mockResolvedValue(jsonResponse(429))
    const { storage, client, events } = setup(storageKey, mockFetch)

    const { error } = await client.signOut({ scope: 'global', keepLocalSessionOnError: true })

    expect(error).not.toBeNull()
    expect(await storage.getItem(storageKey)).not.toBeNull()
    expect(events).not.toContain('SIGNED_OUT')
  })

  test.each([401, 403, 404])(
    'still clears the session when the server responds %s',
    async (status) => {
      const storageKey = `test-signout-keep-session-${status}`
      const mockFetch = jest.fn().mockResolvedValue(jsonResponse(status))
      const { storage, client, events } = setup(storageKey, mockFetch)

      const { error } = await client.signOut({ scope: 'global', keepLocalSessionOnError: true })

      expect(error).toBeNull()
      expect(await storage.getItem(storageKey)).toBeNull()
      expect(events).toContain('SIGNED_OUT')
    }
  )
})
