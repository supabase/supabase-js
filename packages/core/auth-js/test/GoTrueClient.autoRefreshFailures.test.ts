import GoTrueClient from '../src/GoTrueClient'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'
import { setItemAsync } from '../src/lib/helpers'
import { AuthRetryableFetchError, AuthApiError } from '../src/lib/errors'
import type { AuthChangeEvent, LockFunc, Session } from '../src/lib/types'

const GOTRUE_URL = 'http://localhost:9999'

/**
 * Creates a session that the tick considers "needs refresh" (within threshold).
 */
function sessionNeedingRefresh(): Session {
  const expiresAt = Math.floor(Date.now() / 1000) + 60

  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 60,
    expires_at: expiresAt,
    token_type: 'bearer',
    user: {
      id: 'test-user-id',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'test@example.com',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }
}

/**
 * Creates a GoTrueClient with _useSession mocked to always return a session
 * that is about to expire.
 */
function createTestClient(options: { maxAutoRefreshFailures?: number; useLock?: boolean } = {}) {
  const storage = memoryLocalStorageAdapter()

  const lockMock: LockFunc | undefined = options.useLock
    ? (jest.fn(async (_name: string, _timeout: number, fn: () => Promise<any>) => await fn()) as unknown as LockFunc)
    : undefined

  const client = new GoTrueClient({
    url: GOTRUE_URL,
    autoRefreshToken: false,
    persistSession: true,
    storage,
    fetch: jest.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    maxAutoRefreshFailures: options.maxAutoRefreshFailures ?? 0,
    skipAutoInitialize: true,
    ...(lockMock ? { lock: lockMock } : {}),
  })

  // Mock _useSession to bypass storage/initialization and directly provide a session
  const session = sessionNeedingRefresh()
  jest.spyOn(client as any, '_useSession').mockImplementation(async (fn: any) => {
    return await fn({ data: { session }, error: null })
  })

  return { client, storage, lockMock }
}

function retryableError() {
  return new AuthRetryableFetchError('Network error', 0)
}

function nonRetryableError() {
  return new AuthApiError('Token revoked', 401, 'refresh_token_not_found')
}

describe('GoTrueClient maxAutoRefreshFailures', () => {
  it('retries indefinitely when maxAutoRefreshFailures is 0 (default)', async () => {
    const { client } = createTestClient({ maxAutoRefreshFailures: 0 })

    jest.spyOn(client as any, '_callRefreshToken').mockResolvedValue({
      data: null,
      error: retryableError(),
    })

    for (let i = 0; i < 10; i++) {
      await (client as any)._autoRefreshTokenTick()
    }

    // Counter increments but auto-refresh is NOT stopped (no limit)
    expect((client as any).autoRefreshFailureCount).toBe(10)
  })

  it('stops auto-refresh and emits TOKEN_REFRESH_FAILED after reaching max failures', async () => {
    const { client } = createTestClient({ maxAutoRefreshFailures: 3 })

    jest.spyOn(client as any, '_callRefreshToken').mockResolvedValue({
      data: null,
      error: retryableError(),
    })

    const events: AuthChangeEvent[] = []
    client.onAuthStateChange((event) => {
      events.push(event)
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    events.length = 0

    await client.startAutoRefresh()
    expect((client as any).autoRefreshTicker).not.toBeNull()

    await (client as any)._autoRefreshTokenTick()
    await (client as any)._autoRefreshTokenTick()
    await (client as any)._autoRefreshTokenTick()

    expect(events).toContain('TOKEN_REFRESH_FAILED')
    expect((client as any).autoRefreshTicker).toBeNull()
  })

  it('resets the failure count on successful refresh (via _saveSession)', async () => {
    const { client } = createTestClient({ maxAutoRefreshFailures: 5 })

    const refreshSpy = jest.spyOn(client as any, '_callRefreshToken')
    refreshSpy.mockResolvedValueOnce({ data: null, error: retryableError() })
    refreshSpy.mockResolvedValueOnce({ data: null, error: retryableError() })

    await (client as any)._autoRefreshTokenTick()
    expect((client as any).autoRefreshFailureCount).toBe(1)

    await (client as any)._autoRefreshTokenTick()
    expect((client as any).autoRefreshFailureCount).toBe(2)

    // Simulate what happens when a refresh succeeds: _saveSession is called
    await (client as any)._saveSession(sessionNeedingRefresh())
    expect((client as any).autoRefreshFailureCount).toBe(0)
  })

  it('does not emit TOKEN_REFRESH_FAILED when failures stay below the limit', async () => {
    const { client } = createTestClient({ maxAutoRefreshFailures: 5 })

    const refreshSpy = jest.spyOn(client as any, '_callRefreshToken')
    refreshSpy.mockResolvedValue({ data: null, error: retryableError() })

    const events: AuthChangeEvent[] = []
    client.onAuthStateChange((event) => {
      events.push(event)
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    events.length = 0

    // Only 2 failures, limit is 5
    await (client as any)._autoRefreshTokenTick()
    await (client as any)._autoRefreshTokenTick()

    expect(events).not.toContain('TOKEN_REFRESH_FAILED')
    expect((client as any).autoRefreshFailureCount).toBe(2)
  })


  it('does not count non-retryable errors toward the limit', async () => {
    const { client } = createTestClient({ maxAutoRefreshFailures: 3 })

    // Non-retryable error (e.g. token revoked, 401)
    jest.spyOn(client as any, '_callRefreshToken').mockResolvedValue({
      data: null,
      error: nonRetryableError(),
    })

    await (client as any)._autoRefreshTokenTick()
    await (client as any)._autoRefreshTokenTick()
    await (client as any)._autoRefreshTokenTick()

    // Should NOT have counted these toward the limit
    expect((client as any).autoRefreshFailureCount).toBe(0)
  })

  it('increments failure count when _autoRefreshTokenTick throws', async () => {
    const { client } = createTestClient({ maxAutoRefreshFailures: 5 })

    jest.spyOn(client as any, '_callRefreshToken').mockRejectedValue(new Error('Unexpected crash'))

    await (client as any)._autoRefreshTokenTick()
    expect((client as any).autoRefreshFailureCount).toBe(1)

    await (client as any)._autoRefreshTokenTick()
    expect((client as any).autoRefreshFailureCount).toBe(2)
  })

  it('counts failures when _useSession returns a retryable error (expired session)', async () => {
    const { client } = createTestClient({ maxAutoRefreshFailures: 5 })

    jest.spyOn(client as any, '_useSession').mockImplementation(async (fn: any) => {
      return await fn({
        data: { session: null },
        error: retryableError(),
      })
    })

    await (client as any)._autoRefreshTokenTick()
    expect((client as any).autoRefreshFailureCount).toBe(1)

    await (client as any)._autoRefreshTokenTick()
    expect((client as any).autoRefreshFailureCount).toBe(2)
  })

  it('does not count when session is null without an error (user not logged in)', async () => {
    const { client } = createTestClient({ maxAutoRefreshFailures: 5 })

    jest.spyOn(client as any, '_useSession').mockImplementation(async (fn: any) => {
      return await fn({ data: { session: null }, error: null })
    })

    await (client as any)._autoRefreshTokenTick()
    expect((client as any).autoRefreshFailureCount).toBe(0)
  })

  it('resets the counter when _saveSession is called (new session acquired)', async () => {
    const { client } = createTestClient({ maxAutoRefreshFailures: 5 })

    jest.spyOn(client as any, '_callRefreshToken').mockResolvedValue({
      data: null,
      error: retryableError(),
    })

    await (client as any)._autoRefreshTokenTick()
    await (client as any)._autoRefreshTokenTick()
    expect((client as any).autoRefreshFailureCount).toBe(2)

    // Simulate a new session being saved (e.g. sign-in, setSession)
    await (client as any)._saveSession(sessionNeedingRefresh())
    expect((client as any).autoRefreshFailureCount).toBe(0)
  })

  it('resets the counter when _removeSession is called (sign-out)', async () => {
    const { client } = createTestClient({ maxAutoRefreshFailures: 5 })

    jest.spyOn(client as any, '_callRefreshToken').mockResolvedValue({
      data: null,
      error: retryableError(),
    })

    await (client as any)._autoRefreshTokenTick()
    expect((client as any).autoRefreshFailureCount).toBe(1)

    await (client as any)._removeSession()
    expect((client as any).autoRefreshFailureCount).toBe(0)
  })

  it('works with the legacy lock path', async () => {
    const { client } = createTestClient({ maxAutoRefreshFailures: 3, useLock: true })

    jest.spyOn(client as any, '_callRefreshToken').mockResolvedValue({
      data: null,
      error: retryableError(),
    })

    const events: AuthChangeEvent[] = []
    client.onAuthStateChange((event) => {
      events.push(event)
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    events.length = 0

    await client.startAutoRefresh()

    await (client as any)._autoRefreshTokenTick()
    await (client as any)._autoRefreshTokenTick()
    await (client as any)._autoRefreshTokenTick()

    expect(events).toContain('TOKEN_REFRESH_FAILED')
    expect((client as any).autoRefreshTicker).toBeNull()
  })

  it('does not fire TOKEN_REFRESH_FAILED twice if subscriber throws', async () => {
    const { client } = createTestClient({ maxAutoRefreshFailures: 2 })

    jest.spyOn(client as any, '_callRefreshToken').mockResolvedValue({
      data: null,
      error: retryableError(),
    })

    let eventCount = 0
    client.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESH_FAILED') {
        eventCount++
        throw new Error('Subscriber error')
      }
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    await client.startAutoRefresh()

    // 2 failures should trigger exactly one TOKEN_REFRESH_FAILED
    await (client as any)._autoRefreshTokenTick()
    await (client as any)._autoRefreshTokenTick()

    expect(eventCount).toBe(1)
  })

  it('counts failures through the real session load path', async () => {
    const storage = memoryLocalStorageAdapter()

    // Seed a session that's about to expire (within tick threshold)
    // 100s from now: NOT expired by __loadSession (100000 > 90000)
    // but tick triggers: Math.floor(100000/30000) = 3 <= 3
    const session = sessionNeedingRefresh()
    session.expires_at = Math.floor(Date.now() / 1000) + 100
    await setItemAsync(storage, 'supabase.auth.token', session)

    const client = new GoTrueClient({
      url: GOTRUE_URL,
      autoRefreshToken: false,
      persistSession: true,
      storage,
      fetch: jest.fn().mockResolvedValue(
        new Response('{}', { status: 200 })
      ),
      maxAutoRefreshFailures: 3,
      skipAutoInitialize: true,
    })

    // Mock _callRefreshToken but NOT _useSession — real __loadSession runs
    const refreshSpy = jest.spyOn(client as any, '_callRefreshToken').mockResolvedValue({
      data: null,
      error: retryableError(),
    })

    // Don't call initialize() — avoid any side effects on the seeded session.
    // The tick only needs storage to have a valid session.

    const events: AuthChangeEvent[] = []
    client.onAuthStateChange((event) => {
      events.push(event)
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    events.length = 0

    await client.startAutoRefresh()

    // Run ticks — each goes through real __loadSession, then hits mocked refresh
    await (client as any)._autoRefreshTokenTick()
    await (client as any)._autoRefreshTokenTick()
    await (client as any)._autoRefreshTokenTick()

    // Verify _callRefreshToken was actually called via real __loadSession path
    expect(refreshSpy).toHaveBeenCalled()
    expect((client as any).autoRefreshFailureCount).toBeGreaterThanOrEqual(3)
    expect(events).toContain('TOKEN_REFRESH_FAILED')
    expect((client as any).autoRefreshTicker).toBeNull()
  })
})
