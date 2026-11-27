import GoTrueClient from '../src/GoTrueClient'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'

const nowSeconds = () => Math.floor(Date.now() / 1000)
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
const jwt = (sub: string, exp: number) =>
  `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, exp, role: 'authenticated', aud: 'authenticated' })}.sig`
const user = (id: string) => ({
  id,
  aud: 'authenticated',
  role: 'authenticated',
  email: `${id}@example.test`,
  app_metadata: {},
  user_metadata: {},
  created_at: new Date(0).toISOString(),
})
const session = (id: string, refreshToken: string, expiresIn: number) => {
  const expiresAt = nowSeconds() + expiresIn
  return {
    access_token: jwt(id, expiresAt),
    refresh_token: refreshToken,
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: expiresAt,
    user: user(id),
  }
}

describe('_callRefreshToken with a refresh for another refresh token in flight', () => {
  it('setSession refreshes its own token instead of returning the in-flight refresh of the stored session', async () => {
    const storageKey = 'test-refresh-in-flight'
    const storage = memoryLocalStorageAdapter({})
    // Mock /token: refresh tokens rotate, and each refresh takes 100 ms.
    const owners = new Map([
      ['rt-A-0', 'user-A'],
      ['rt-B-0', 'user-B'],
    ])
    const refreshTokensSent: string[] = []
    let counter = 0
    const mockFetch = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const { refresh_token } = JSON.parse(String(init.body))
      refreshTokensSent.push(refresh_token)
      await new Promise((resolve) => setTimeout(resolve, 100))
      const owner = owners.get(refresh_token)
      if (!owner) {
        return new Response(
          JSON.stringify({ code: 'refresh_token_not_found', msg: 'Refresh Token Not Found' }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        )
      }
      owners.delete(refresh_token)
      const next = `rt-${owner.slice(-1)}-${++counter}`
      owners.set(next, owner)
      return new Response(JSON.stringify(session(owner, next, 3600)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const client = new GoTrueClient({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      storage,
      storageKey,
      fetch: mockFetch,
    })

    try {
      await storage.setItem(storageKey, JSON.stringify(session('user-A', 'rt-A-0', 3600)))
      await client.initialize()
      // User A's access token is about to expire, so the next read refreshes it.
      await storage.setItem(storageKey, JSON.stringify(session('user-A', 'rt-A-0', 60)))
      const inFlight = client.getSession()
      await new Promise((resolve) => setTimeout(resolve, 20))

      // Switch to user B, whose access token has expired.
      const { data, error } = await client.setSession({
        access_token: jwt('user-B', nowSeconds() - 3600),
        refresh_token: 'rt-B-0',
      })
      await inFlight

      expect(error).toBeNull()
      expect(data.user?.id).toBe('user-B')
      expect(data.session?.user.id).toBe('user-B')
      expect(refreshTokensSent).toEqual(['rt-A-0', 'rt-B-0'])
      const stored = JSON.parse((await storage.getItem(storageKey)) as string)
      expect(stored.user.id).toBe('user-B')
      expect(stored.refresh_token).toMatch(/^rt-B-/)
    } finally {
      await client.dispose()
    }
  })

  it('still shares the in-flight refresh with callers passing the same refresh token', async () => {
    const storageKey = 'test-refresh-in-flight-same-token'
    const storage = memoryLocalStorageAdapter({})
    const mockFetch = jest.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
      return new Response(JSON.stringify(session('user-A', 'rt-A-1', 3600)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const client = new GoTrueClient({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      storage,
      storageKey,
      fetch: mockFetch,
    })

    try {
      await storage.setItem(storageKey, JSON.stringify(session('user-A', 'rt-A-0', 3600)))
      await client.initialize()
      await storage.setItem(storageKey, JSON.stringify(session('user-A', 'rt-A-0', 60)))
      const [first, second] = await Promise.all([client.getSession(), client.getSession()])

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(first.data.session?.refresh_token).toBe('rt-A-1')
      expect(second.data.session?.refresh_token).toBe('rt-A-1')
    } finally {
      await client.dispose()
    }
  })

  it('getSession does not refresh a stale stored token after setSession commits another session', async () => {
    const storageKey = 'test-refresh-in-flight-stale-getsession'
    const storage = memoryLocalStorageAdapter({})
    const owners = new Map([
      ['rt-A-0', 'user-A'],
      ['rt-B-0', 'user-B'],
    ])
    const refreshTokensSent: string[] = []
    let counter = 0
    const mockFetch = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const { refresh_token } = JSON.parse(String(init.body))
      refreshTokensSent.push(refresh_token)
      await new Promise((resolve) => setTimeout(resolve, 100))
      const owner = owners.get(refresh_token)
      if (!owner) {
        return new Response(
          JSON.stringify({ code: 'refresh_token_not_found', msg: 'Refresh Token Not Found' }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        )
      }
      owners.delete(refresh_token)
      const next = `rt-${owner.slice(-1)}-${++counter}`
      owners.set(next, owner)
      return new Response(JSON.stringify(session(owner, next, 3600)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const client = new GoTrueClient({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      storage,
      storageKey,
      fetch: mockFetch,
    })

    try {
      await storage.setItem(storageKey, JSON.stringify(session('user-A', 'rt-A-0', 3600)))
      await client.initialize()
      // User A's access token is about to expire, so getSession will try to refresh it.
      await storage.setItem(storageKey, JSON.stringify(session('user-A', 'rt-A-0', 60)))

      // setSession(B) starts refreshing first. Storage still holds A until B commits.
      const setSessionPromise = client.setSession({
        access_token: jwt('user-B', nowSeconds() - 3600),
        refresh_token: 'rt-B-0',
      })
      await new Promise((resolve) => setTimeout(resolve, 20))

      const { data, error } = await client.getSession()
      const setResult = await setSessionPromise

      expect(setResult.error).toBeNull()
      expect(setResult.data.user?.id).toBe('user-B')
      expect(error).toBeNull()
      expect(data.session?.user.id).toBe('user-B')
      expect(refreshTokensSent).toEqual(['rt-B-0'])
      const stored = JSON.parse((await storage.getItem(storageKey)) as string)
      expect(stored.user.id).toBe('user-B')
      expect(stored.refresh_token).toMatch(/^rt-B-/)
    } finally {
      await client.dispose()
    }
  })
})
