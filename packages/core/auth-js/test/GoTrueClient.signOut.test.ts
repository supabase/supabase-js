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
    jest.useRealTimers()
  })

  test.each(
    (['global', 'local', 'others'] as const).flatMap((scope) => [
      { scope, failure: 'offline' },
      { scope, failure: 'rejected' },
    ])
  )(
    'handles a $failure refresh during $scope signOut with an expired session',
    async ({ scope, failure }) => {
      jest.useFakeTimers()
      const storageKey = `test-signout-expired-${scope}`
      const session = createStoredSession()
      const storage = memoryLocalStorageAdapter({
        [storageKey]: JSON.stringify(session),
        [`${storageKey}-code-verifier`]: 'test-code-verifier',
      })
      const mockFetch =
        failure === 'offline'
          ? jest.fn().mockRejectedValue(new TypeError('Network request failed'))
          : jest.fn().mockResolvedValue(
              new Response(
                JSON.stringify({
                  code: 'refresh_token_not_found',
                  message: 'Invalid Refresh Token: Refresh Token Not Found',
                }),
                { status: 400, headers: { 'content-type': 'application/json' } }
              )
            )
      const client = new GoTrueClient({
        url: 'http://localhost:9999',
        autoRefreshToken: false,
        storage,
        storageKey,
        fetch: mockFetch,
      })
      await client.initialize()

      const onAuthStateChange = jest.fn()
      await new Promise<void>((resolve) => {
        client.onAuthStateChange((event, session) => {
          onAuthStateChange(event, session)
          if (event === 'INITIAL_SESSION') resolve()
        })
      })
      await storage.setItem(
        storageKey,
        JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) - 60 })
      )

      const signOut = client.signOut({ scope })
      await jest.advanceTimersByTimeAsync(30_000)
      const { error } = await signOut

      expect(error?.name).toBe(failure === 'offline' ? 'AuthRetryableFetchError' : 'AuthApiError')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/token?grant_type=refresh_token'),
        expect.any(Object)
      )
      if (scope === 'others' && failure === 'offline') {
        expect(await storage.getItem(storageKey)).not.toBeNull()
        expect(await storage.getItem(`${storageKey}-code-verifier`)).not.toBeNull()
        expect(onAuthStateChange).not.toHaveBeenCalledWith('SIGNED_OUT', null)
      } else {
        expect(await storage.getItem(storageKey)).toBeNull()
        expect(await storage.getItem(`${storageKey}-code-verifier`)).toBeNull()
        expect(onAuthStateChange).toHaveBeenCalledWith('SIGNED_OUT', null)
        expect(
          onAuthStateChange.mock.calls.filter(([event]) => event === 'SIGNED_OUT')
        ).toHaveLength(1)
      }
    }
  )

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
