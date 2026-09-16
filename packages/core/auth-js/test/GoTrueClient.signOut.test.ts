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
