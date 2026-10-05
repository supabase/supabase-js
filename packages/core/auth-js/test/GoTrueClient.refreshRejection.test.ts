import GoTrueClient from '../src/GoTrueClient'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'

const makeSession = (suffix: string) => ({
  access_token: `test-access-token-${suffix}`,
  refresh_token: `test-refresh-token-${suffix}`,
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

describe('single-caller refresh failure', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('rejects the caller without producing an unhandled rejection', async () => {
    const storageKey = 'test-refresh-rejection'
    const storage = memoryLocalStorageAdapter({
      [storageKey]: JSON.stringify(makeSession('stored')),
    })
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(makeSession('refreshed')), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const client = new GoTrueClient({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      persistSession: true,
      storage,
      storageKey,
      fetch: mockFetch,
    })

    // A subscriber throwing on TOKEN_REFRESHED escapes `_callRefreshToken` as
    // a non-AuthError: the caller must receive it, and the refresh dedupe
    // deferred (which has no concurrent subscriber here) must not leak it as
    // an unhandled rejection.
    const {
      data: { subscription },
    } = client.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') {
        throw new Error('subscriber boom')
      }
    })

    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)

    try {
      await expect(client.refreshSession()).rejects.toThrow('subscriber boom')

      // Unhandled rejections are reported on later ticks — drain a few so a
      // leak would have fired the listener before we assert.
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setImmediate(resolve))
    } finally {
      process.removeListener('unhandledRejection', onUnhandled)
      subscription.unsubscribe()
      await client.dispose()
    }

    expect(unhandled).toEqual([])
  })
})
