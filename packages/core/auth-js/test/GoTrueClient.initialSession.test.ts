import GoTrueClient from '../src/GoTrueClient'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'
import type { AuthChangeEvent, LockFunc, Session } from '../src/lib/types'

const makeExpiredSession = () => ({
  access_token: 'test-access-token-expired',
  refresh_token: 'test-refresh-token-expired',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) - 60,
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

const drainTicks = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve))
  }
}

describe('onAuthStateChange INITIAL_SESSION with throwOnError', () => {
  let consoleWarnSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  const cases: Array<[string, Record<string, unknown>]> = [
    ['default (no lock)', {}],
    ['legacy lock option', { lock: ((_name, _timeout, fn) => fn()) as LockFunc }],
  ]

  it.each(cases)(
    'emits INITIAL_SESSION with null and leaves no unhandled rejection when the initial refresh fails (%s)',
    async (_label, extraOptions) => {
      const storageKey = 'test-initial-session-throw-on-error'
      const storage = memoryLocalStorageAdapter({
        [storageKey]: JSON.stringify(makeExpiredSession()),
      })
      const mockFetch = jest.fn().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              code: 'refresh_token_not_found',
              error_code: 'refresh_token_not_found',
              msg: 'Invalid Refresh Token: Refresh Token Not Found',
            }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          )
      )

      const unhandled: unknown[] = []
      const onUnhandled = (reason: unknown) => {
        unhandled.push(reason)
      }
      process.on('unhandledRejection', onUnhandled)

      const client = new GoTrueClient({
        url: 'http://localhost:9999',
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false,
        throwOnError: true,
        storage,
        storageKey,
        fetch: mockFetch,
        ...extraOptions,
      })

      const events: Array<[AuthChangeEvent, Session | null]> = []
      let resolveInitial: () => void = () => {}
      const initialEmitted = new Promise<void>((resolve) => {
        resolveInitial = resolve
      })

      let subscription: { unsubscribe: () => void } | undefined
      try {
        await client.initialize().catch(() => {})

        subscription = client.onAuthStateChange((event, session) => {
          events.push([event, session])
          if (event === 'INITIAL_SESSION') resolveInitial()
        }).data.subscription

        await Promise.race([initialEmitted, new Promise((resolve) => setTimeout(resolve, 2000))])
        await drainTicks()
      } finally {
        process.removeListener('unhandledRejection', onUnhandled)
        subscription?.unsubscribe()
        await client.dispose()
      }

      expect(mockFetch).toHaveBeenCalled()
      expect(events).toContainEqual(['INITIAL_SESSION', null])
      expect(unhandled).toEqual([])
    }
  )
})
