import GoTrueClient from '../src/GoTrueClient'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'

const storageKey = 'test-initial-session'

const makeStoredSession = (overrides: Record<string, unknown>) => ({
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: 'test-user-id',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date(0).toISOString(),
  },
  ...overrides,
})

async function collectInitialSession(
  storedSession: Record<string, unknown>,
  { isServer = false }: { isServer?: boolean } = {}
) {
  const storage = Object.assign(
    memoryLocalStorageAdapter({ [storageKey]: JSON.stringify(storedSession) }),
    { isServer }
  )
  const client = new GoTrueClient({
    url: 'http://localhost:9999',
    autoRefreshToken: false,
    persistSession: true,
    storage,
    storageKey,
    fetch: jest.fn().mockRejectedValue(new Error('no network in this test')),
  })

  const unhandled: unknown[] = []
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason)
  }
  process.on('unhandledRejection', onUnhandled)

  const events: [string, unknown][] = []
  let subscription: { unsubscribe: () => void } | undefined
  try {
    await new Promise<void>((resolve) => {
      ;({
        data: { subscription },
      } = client.onAuthStateChange((event, session) => {
        events.push([event, session])
        if (event === 'INITIAL_SESSION') resolve()
      }))
    })

    // Unhandled rejections are reported on later ticks, so drain a few.
    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))
  } finally {
    process.removeListener('unhandledRejection', onUnhandled)
    subscription?.unsubscribe()
    await client.dispose()
  }

  return { events, unhandled }
}

describe('onAuthStateChange INITIAL_SESSION when the stored session cannot be loaded', () => {
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

  it('emits INITIAL_SESSION with null for an expired session without a refresh token', async () => {
    const { events, unhandled } = await collectInitialSession(
      makeStoredSession({
        refresh_token: '',
        expires_at: Math.floor(Date.now() / 1000) - 60,
      })
    )

    expect(events.filter(([event]) => event === 'INITIAL_SESSION')).toEqual([
      ['INITIAL_SESSION', null],
    ])
    expect(unhandled).toEqual([])
  })

  it('emits INITIAL_SESSION with null when a server-side stored user is not an object', async () => {
    // Server storage (e.g. @supabase/ssr cookies) wraps the stored user in a
    // warning Proxy, which throws for a non-object user.
    const { events, unhandled } = await collectInitialSession(
      makeStoredSession({ user: 'not-an-object' }),
      { isServer: true }
    )

    expect(events.filter(([event]) => event === 'INITIAL_SESSION')).toEqual([
      ['INITIAL_SESSION', null],
    ])
    expect(unhandled).toEqual([])
  })
})
