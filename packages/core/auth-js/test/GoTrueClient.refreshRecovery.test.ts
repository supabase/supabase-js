import GoTrueClient from '../src/GoTrueClient'
import { STORAGE_KEY } from '../src/lib/constants'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'
import { getItemAsync, setItemAsync } from '../src/lib/helpers'
import { Session, User } from '../src/lib/types'

describe('Issue #2767: auth refresh recovery after cached retryable failure', () => {
  const user: User = {
    id: 'u1',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'user@example.com',
    phone: '',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const generateJwt = (exp: number) =>
    `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', exp })}.signature`

  const createExpiredSession = (refreshToken = 'refresh-token-original'): Session => {
    const expired = Math.floor(Date.now() / 1000) - 16 * 60
    return {
      access_token: generateJwt(expired),
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: expired,
      user,
    }
  }

  const createValidSession = (
    refreshToken = 'refresh-token-valid',
    secondsRemaining = 600
  ): Session => {
    const exp = Math.floor(Date.now() / 1000) + secondsRemaining
    return {
      access_token: generateJwt(exp),
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: secondsRemaining,
      expires_at: exp,
      user,
    }
  }

  describe('Reproduction and lifecycle recovery', () => {
    test('Offline initialization & recovery after cooldown failure: supported recovery action causes a real request and succeeds', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] })
      try {
        const storage = memoryLocalStorageAdapter()
        await setItemAsync(storage, STORAGE_KEY, createExpiredSession())

        let online = false
        let tokenRequests = 0

        const customFetch = jest.fn(async (url: string | URL | Request) => {
          const urlStr = typeof url === 'string' ? url : url.toString()
          if (urlStr.includes('/token')) {
            tokenRequests += 1
          }

          if (!online) {
            throw new TypeError('Network request failed')
          }

          const exp = Math.floor(Date.now() / 1000) + 3600
          return new Response(
            JSON.stringify({
              access_token: generateJwt(exp),
              refresh_token: 'refresh-token-rotated',
              token_type: 'bearer',
              expires_in: 3600,
              expires_at: exp,
              user,
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }
          )
        })

        const client = new GoTrueClient({
          url: 'http://localhost:9999',
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          fetch: customFetch as any,
        })

        // 1. Initialize client while offline
        const initPromise = client.initialize()

        // Advance through retry backoff steps
        for (let i = 0; i < 10; i++) {
          await jest.advanceTimersByTimeAsync(3000)
        }

        const initResult = await initPromise
        expect(initResult.error).toBeNull()

        // 8 attempts made during exponential backoff
        expect(tokenRequests).toBe(8)

        // Session preserved in storage
        const storedAfterInit = (await getItemAsync(storage, STORAGE_KEY)) as Session | null
        expect(storedAfterInit?.refresh_token).toBe('refresh-token-original')

        // Stop auto refresh as mobile apps do in background
        await client.stopAutoRefresh()

        // 2. Network connectivity is restored
        online = true
        const beforeRecoveryRequests = tokenRequests

        // 3. Supported recovery operation: startAutoRefresh()
        await client.startAutoRefresh()

        // Advance timers for immediate tick at setTimeout(..., 0)
        await jest.advanceTimersByTimeAsync(10)

        // Fresh request sent upon recovery!
        expect(tokenRequests - beforeRecoveryRequests).toBe(1)

        // Session refreshed with rotated token
        const { data: sessionData, error: sessionError } = await client.getSession()
        expect(sessionError).toBeNull()
        expect(sessionData.session?.refresh_token).toBe('refresh-token-rotated')
      } finally {
        jest.useRealTimers()
      }
    })

    test('Network still offline: recovery does not produce an uncontrolled retry storm', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] })
      try {
        const storage = memoryLocalStorageAdapter()
        await setItemAsync(storage, STORAGE_KEY, createExpiredSession())

        let tokenRequests = 0
        const customFetch = jest.fn(async (url: string | URL | Request) => {
          const urlStr = typeof url === 'string' ? url : url.toString()
          if (urlStr.includes('/token')) {
            tokenRequests += 1
          }
          throw new TypeError('Network request failed')
        })

        const client = new GoTrueClient({
          url: 'http://localhost:9999',
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          fetch: customFetch as any,
        })

        // Initialize offline
        const initPromise = client.initialize()
        for (let i = 0; i < 10; i++) {
          await jest.advanceTimersByTimeAsync(3000)
        }
        await initPromise
        expect(tokenRequests).toBe(8)

        // First recovery attempt while still offline
        await client.stopAutoRefresh()
        await client.startAutoRefresh()

        // Advance timer to let recovery attempt run and exhaust its backoff
        for (let i = 0; i < 10; i++) {
          await jest.advanceTimersByTimeAsync(3000)
        }

        // Recovery attempt failed after 8 backoff steps
        expect(tokenRequests).toBe(16)

        // Rapid subsequent resume triggers within cooldown window (e.g. repeated app foregrounding)
        const requestsBeforeFlurry = tokenRequests
        for (let i = 0; i < 5; i++) {
          await client.stopAutoRefresh()
          await client.startAutoRefresh()
          await jest.advanceTimersByTimeAsync(100)
        }

        // No new requests sent during the cooldown window — bounded retry protection works!
        expect(tokenRequests).toBe(requestsBeforeFlurry)
      } finally {
        jest.useRealTimers()
      }
    })

    test('Repeated recovery triggers: calls remain bounded and concurrency-safe', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] })
      try {
        const storage = memoryLocalStorageAdapter()
        await setItemAsync(storage, STORAGE_KEY, createExpiredSession())

        let tokenRequests = 0
        const customFetch = jest.fn(async (url: string | URL | Request) => {
          const urlStr = typeof url === 'string' ? url : url.toString()
          if (urlStr.includes('/token')) {
            tokenRequests += 1
          }
          throw new TypeError('Network request failed')
        })

        const client = new GoTrueClient({
          url: 'http://localhost:9999',
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          fetch: customFetch as any,
        })

        const initPromise = client.initialize()
        for (let i = 0; i < 10; i++) {
          await jest.advanceTimersByTimeAsync(3000)
        }
        await initPromise

        const requestsAfterInit = tokenRequests

        // 20 rapid startAutoRefresh calls in parallel
        await Promise.all(Array.from({ length: 20 }, () => client.startAutoRefresh()))

        // Advance through backoff
        for (let i = 0; i < 10; i++) {
          await jest.advanceTimersByTimeAsync(3000)
        }

        // Exactly one recovery attempt was made (8 backoff fetches), never duplicated across concurrent calls
        expect(tokenRequests - requestsAfterInit).toBe(8)
      } finally {
        jest.useRealTimers()
      }
    })

    test('Multiple simultaneous callers: no duplicate network requests beyond single-flight dedupe', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] })
      try {
        const storage = memoryLocalStorageAdapter()
        await setItemAsync(storage, STORAGE_KEY, createExpiredSession())

        let online = false
        let tokenRequests = 0
        let resolveInFlight: (() => void) | null = null
        let notifyRequestStarted: (() => void) | null = null
        const requestStarted = new Promise<void>((r) => {
          notifyRequestStarted = r
        })
        const customFetch = jest.fn(async (url: string | URL | Request) => {
          const urlStr = typeof url === 'string' ? url : url.toString()
          if (urlStr.includes('/token')) {
            tokenRequests += 1
          }
          if (!online) {
            throw new TypeError('Network request failed')
          }
          notifyRequestStarted?.()
          await new Promise<void>((r) => {
            resolveInFlight = r
          })
          const exp = Math.floor(Date.now() / 1000) + 3600
          return new Response(
            JSON.stringify({
              access_token: generateJwt(exp),
              refresh_token: 'refresh-token-rotated',
              token_type: 'bearer',
              expires_in: 3600,
              expires_at: exp,
              user,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        })

        const client = new GoTrueClient({
          url: 'http://localhost:9999',
          storage,
          autoRefreshToken: false,
          persistSession: true,
          detectSessionInUrl: false,
          fetch: customFetch as any,
        })

        const initPromise = client.initialize()
        for (let i = 0; i < 10; i++) {
          await jest.advanceTimersByTimeAsync(3000)
        }
        await initPromise

        online = true
        // Allow recovery on resume
        // @ts-expect-error access protected for test
        client._maybeRecoverOnStartAutoRefresh()

        const beforeRecovery = tokenRequests

        // Simultaneously trigger multiple concurrent callers (e.g. concurrent UI reads on recovery)
        const p1 = client.getSession()
        const p2 = client.getSession()
        const p3 = client.getSession()
        const p4 = client.getSession()

        // Wait until the single-flight network request starts
        await requestStarted

        // Let microtasks settle so concurrent callers join the single flight
        for (let i = 0; i < 5; i++) {
          await Promise.resolve()
        }

        // Now resolve the in-flight network request
        resolveInFlight!()

        const [r1, r2, r3, r4] = await Promise.all([p1, p2, p3, p4])

        expect(r1.error).toBeNull()
        expect(r2.error).toBeNull()
        expect(r3.error).toBeNull()
        expect(r4.error).toBeNull()
        expect(r1.data.session?.refresh_token).toBe('refresh-token-rotated')
        expect(r2.data.session?.refresh_token).toBe('refresh-token-rotated')
        expect(r3.data.session?.refresh_token).toBe('refresh-token-rotated')
        expect(r4.data.session?.refresh_token).toBe('refresh-token-rotated')

        // Single flight deduplication: exactly 1 request sent!
        expect(tokenRequests - beforeRecovery).toBe(1)
      } finally {
        jest.useRealTimers()
      }
    })

    test('Invalid refresh token: correct authentication error, no inappropriate bypass on startAutoRefresh', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] })
      try {
        const storage = memoryLocalStorageAdapter()
        // Expired access token with invalid refresh token
        await setItemAsync(storage, STORAGE_KEY, createExpiredSession('invalid-refresh-token'))

        let tokenRequests = 0
        const customFetch = jest.fn(async (url: string | URL | Request) => {
          const urlStr = typeof url === 'string' ? url : url.toString()
          if (urlStr.includes('/token')) {
            tokenRequests += 1
          }
          return new Response(
            JSON.stringify({
              error: 'invalid_grant',
              error_description: 'Invalid Refresh Token: Already Used',
            }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          )
        })

        const client = new GoTrueClient({
          url: 'http://localhost:9999',
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          fetch: customFetch as any,
        })

        const initPromise = client.initialize()
        await jest.advanceTimersByTimeAsync(10)
        await initPromise

        // Non-retryable 400 error does not back off — exactly 1 request sent
        expect(tokenRequests).toBe(1)

        // Session was removed because access token was expired and refresh token was invalid
        const stored = (await getItemAsync(storage, STORAGE_KEY)) as Session | null
        expect(stored).toBeNull()

        // Calling startAutoRefresh() must NOT bypass cooldown for invalid tokens
        await client.startAutoRefresh()
        await jest.advanceTimersByTimeAsync(10)

        // No new requests sent
        expect(tokenRequests).toBe(1)
      } finally {
        jest.useRealTimers()
      }
    })

    test('Successful token rotation: new token persisted and TOKEN_REFRESHED event emitted', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] })
      try {
        const storage = memoryLocalStorageAdapter()
        await setItemAsync(storage, STORAGE_KEY, createExpiredSession())

        let online = false
        const customFetch = jest.fn(async () => {
          if (!online) throw new TypeError('Network request failed')
          const exp = Math.floor(Date.now() / 1000) + 3600
          return new Response(
            JSON.stringify({
              access_token: generateJwt(exp),
              refresh_token: 'refresh-token-new',
              token_type: 'bearer',
              expires_in: 3600,
              expires_at: exp,
              user,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        })

        const client = new GoTrueClient({
          url: 'http://localhost:9999',
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          fetch: customFetch as any,
        })

        const emittedEvents: string[] = []
        client.onAuthStateChange((event) => {
          emittedEvents.push(event)
        })

        const initPromise = client.initialize()
        for (let i = 0; i < 10; i++) {
          await jest.advanceTimersByTimeAsync(3000)
        }
        await initPromise

        online = true
        await client.startAutoRefresh()
        await jest.advanceTimersByTimeAsync(10)

        expect(emittedEvents).toContain('TOKEN_REFRESHED')

        const stored = (await getItemAsync(storage, STORAGE_KEY)) as Session | null
        expect(stored?.refresh_token).toBe('refresh-token-new')
      } finally {
        jest.useRealTimers()
      }
    })

    test('Different refresh token: old token failure cache does not block the new token', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] })
      try {
        const storage = memoryLocalStorageAdapter()
        await setItemAsync(storage, STORAGE_KEY, createExpiredSession('token-A'))

        let online = false
        let tokenRequests = 0
        const customFetch = jest.fn(async () => {
          tokenRequests += 1
          if (!online) throw new TypeError('Network request failed')
          const exp = Math.floor(Date.now() / 1000) + 3600
          return new Response(
            JSON.stringify({
              access_token: generateJwt(exp),
              refresh_token: 'token-B-rotated',
              token_type: 'bearer',
              expires_in: 3600,
              expires_at: exp,
              user,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        })

        const client = new GoTrueClient({
          url: 'http://localhost:9999',
          storage,
          autoRefreshToken: false,
          persistSession: true,
          detectSessionInUrl: false,
          fetch: customFetch as any,
        })

        await client.initialize()

        // Fails with token-A and caches under token-A
        // @ts-expect-error access protected for test
        const callPromiseA = client._callRefreshToken('token-A')
        for (let i = 0; i < 10; i++) {
          await jest.advanceTimersByTimeAsync(3000)
        }
        await callPromiseA
        expect(tokenRequests).toBe(8)

        // Now an explicit refresh with a DIFFERENT token (token-B) bypasses token-A's cache
        online = true
        // @ts-expect-error access protected for test
        const resultB = await client._callRefreshToken('token-B')
        expect(resultB.error).toBeNull()
        expect(resultB.data?.refresh_token).toBe('token-B-rotated')
        expect(tokenRequests).toBe(9)
      } finally {
        jest.useRealTimers()
      }
    })

    test('Sign-out during refresh: no session resurrection', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] })
      try {
        const storage = memoryLocalStorageAdapter()

        let resolveFetch: (res: Response) => void
        const customFetch = jest.fn(async (url: string | URL | Request) => {
          const urlStr = typeof url === 'string' ? url : url.toString()
          if (urlStr.includes('/logout')) {
            return new Response(JSON.stringify({}), { status: 200 })
          }
          return new Promise<Response>((resolve) => {
            resolveFetch = resolve
          })
        })

        const client = new GoTrueClient({
          url: 'http://localhost:9999',
          storage,
          autoRefreshToken: false,
          persistSession: true,
          detectSessionInUrl: false,
          fetch: customFetch as any,
        })

        await client.initialize()
        await setItemAsync(storage, STORAGE_KEY, createExpiredSession())

        // Start refresh
        // @ts-expect-error access protected for test
        const refreshPromise = client._callRefreshToken('refresh-token-original')

        // Concurrent sign-out / session removal while refresh is in flight
        // @ts-expect-error access protected for test
        await client._removeSession()

        // Fetch resolves with valid session
        const exp = Math.floor(Date.now() / 1000) + 3600
        resolveFetch!(
          new Response(
            JSON.stringify({
              access_token: generateJwt(exp),
              refresh_token: 'refresh-token-resurrected',
              token_type: 'bearer',
              expires_in: 3600,
              expires_at: exp,
              user,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        )

        const result = await refreshPromise
        // Discarded by commit guard
        expect(result.data).toBeNull()
        expect(result.error?.name).toBe('AuthRefreshDiscardedError')

        // Storage remains cleared — NO resurrection!
        const stored = await getItemAsync(storage, STORAGE_KEY)
        expect(stored).toBeNull()
      } finally {
        jest.useRealTimers()
      }
    })

    test('New sign-in during refresh: newly stored session is not overwritten', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] })
      try {
        const storage = memoryLocalStorageAdapter()

        let resolveFetch: (res: Response) => void
        const customFetch = jest.fn(async () => {
          return new Promise<Response>((resolve) => {
            resolveFetch = resolve
          })
        })

        const client = new GoTrueClient({
          url: 'http://localhost:9999',
          storage,
          autoRefreshToken: false,
          persistSession: true,
          detectSessionInUrl: false,
          fetch: customFetch as any,
        })

        await client.initialize()
        await setItemAsync(storage, STORAGE_KEY, createExpiredSession('old-user-token'))

        // Old refresh in flight
        // @ts-expect-error access protected for test
        const refreshPromise = client._callRefreshToken('old-user-token')

        // Concurrent sign-in of a new user
        const newUserSession: Session = {
          access_token: generateJwt(Math.floor(Date.now() / 1000) + 3600),
          refresh_token: 'new-user-token',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { ...user, id: 'u2', email: 'u2@example.com' },
        }
        await setItemAsync(storage, STORAGE_KEY, newUserSession)

        // Old refresh finishes
        const exp = Math.floor(Date.now() / 1000) + 3600
        resolveFetch!(
          new Response(
            JSON.stringify({
              access_token: generateJwt(exp),
              refresh_token: 'old-user-token-rotated',
              token_type: 'bearer',
              expires_in: 3600,
              expires_at: exp,
              user,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        )

        const result = await refreshPromise
        expect(result.data).toBeNull()
        expect(result.error?.name).toBe('AuthRefreshDiscardedError')

        // Storage holds new user session, not the old user
        const stored = (await getItemAsync(storage, STORAGE_KEY)) as Session | null
        expect(stored?.refresh_token).toBe('new-user-token')
        expect(stored?.user?.id).toBe('u2')
      } finally {
        jest.useRealTimers()
      }
    })

    test('Valid access token with failed proactive refresh: session preservation retained', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] })
      try {
        const storage = memoryLocalStorageAdapter()
        // Access token still valid for 60 seconds (within 90s margin)
        await setItemAsync(storage, STORAGE_KEY, createValidSession('token-proactive', 60))

        const customFetch = jest.fn(async () => {
          throw new TypeError('Network request failed')
        })

        const client = new GoTrueClient({
          url: 'http://localhost:9999',
          storage,
          autoRefreshToken: false,
          persistSession: true,
          detectSessionInUrl: false,
          fetch: customFetch as any,
        })

        await client.initialize()

        // getSession triggers proactive refresh, which fails offline
        const getSessionPromise = client.getSession()
        for (let i = 0; i < 10; i++) {
          await jest.advanceTimersByTimeAsync(3000)
        }
        const { data, error } = await getSessionPromise

        // Session preserved and returned because access token is still within real expiry!
        expect(error).toBeNull()
        expect(data.session?.refresh_token).toBe('token-proactive')

        // Storage untouched
        const stored = (await getItemAsync(storage, STORAGE_KEY)) as Session | null
        expect(stored?.refresh_token).toBe('token-proactive')
      } finally {
        jest.useRealTimers()
      }
    })

    test('Expired access token with failed refresh: correct error returned and session null', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] })
      try {
        const storage = memoryLocalStorageAdapter()
        await setItemAsync(storage, STORAGE_KEY, createExpiredSession('token-expired'))

        const customFetch = jest.fn(async () => {
          throw new TypeError('Network request failed')
        })

        const client = new GoTrueClient({
          url: 'http://localhost:9999',
          storage,
          autoRefreshToken: false,
          persistSession: true,
          detectSessionInUrl: false,
          fetch: customFetch as any,
        })

        await client.initialize()

        const getSessionPromise = client.getSession()
        for (let i = 0; i < 10; i++) {
          await jest.advanceTimersByTimeAsync(3000)
        }
        const { data, error } = await getSessionPromise

        expect(data.session).toBeNull()
        expect(error?.name).toBe('AuthRetryableFetchError')

        // But stored session is preserved because error was retryable!
        const stored = (await getItemAsync(storage, STORAGE_KEY)) as Session | null
        expect(stored?.refresh_token).toBe('token-expired')
      } finally {
        jest.useRealTimers()
      }
    })

    test('Auto-refresh stopped: no unintended background requests', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] })
      try {
        const storage = memoryLocalStorageAdapter()
        await setItemAsync(storage, STORAGE_KEY, createValidSession('token-active', 60))

        let tokenRequests = 0
        const customFetch = jest.fn(async () => {
          tokenRequests += 1
          return new Response(JSON.stringify({}), { status: 200 })
        })

        const client = new GoTrueClient({
          url: 'http://localhost:9999',
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          fetch: customFetch as any,
        })

        await client.initialize()
        await client.stopAutoRefresh()

        const requestsAtStop = tokenRequests

        // Advance timers by several auto-refresh ticks (2 minutes)
        await jest.advanceTimersByTimeAsync(120_000)

        // No background requests fired while stopped!
        expect(tokenRequests).toBe(requestsAtStop)
      } finally {
        jest.useRealTimers()
      }
    })

    test('Auto-refresh restarted: correct recovery and timer behavior', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] })
      try {
        const storage = memoryLocalStorageAdapter()
        const customFetch = jest.fn(async () => {
          const exp = Math.floor(Date.now() / 1000) + 3600
          return new Response(
            JSON.stringify({
              access_token: generateJwt(exp),
              refresh_token: 'token-restarted',
              token_type: 'bearer',
              expires_in: 3600,
              expires_at: exp,
              user,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        })

        const client = new GoTrueClient({
          url: 'http://localhost:9999',
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          fetch: customFetch as any,
        })

        await client.initialize()
        await client.stopAutoRefresh()

        // Plant expired session while stopped
        await setItemAsync(storage, STORAGE_KEY, createExpiredSession('token-restart'))

        const requestsAtStop = customFetch.mock.calls.length

        // Restart auto-refresh
        await client.startAutoRefresh()

        // Immediate tick fires
        await jest.advanceTimersByTimeAsync(10)
        expect(customFetch.mock.calls.length - requestsAtStop).toBe(1)

        const stored = (await getItemAsync(storage, STORAGE_KEY)) as Session | null
        expect(stored?.refresh_token).toBe('token-restarted')
      } finally {
        jest.useRealTimers()
      }
    })

    test('React Native-like environment: no browser-only API assumptions', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] })
      try {
        // In Node/React Native, window and document are undefined or lack browser APIs
        const storage = memoryLocalStorageAdapter()
        await setItemAsync(storage, STORAGE_KEY, createExpiredSession())

        const customFetch = jest.fn(async () => {
          throw new TypeError('Network request failed')
        })

        const client = new GoTrueClient({
          url: 'http://localhost:9999',
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          fetch: customFetch as any,
        })

        // Must not throw or crash on missing window/document/navigator
        expect(typeof (globalThis as any).window).toBe('undefined')
        const initPromise = client.initialize()
        for (let i = 0; i < 10; i++) {
          await jest.advanceTimersByTimeAsync(3000)
        }
        await expect(initPromise).resolves.toBeDefined()
        await expect(client.startAutoRefresh()).resolves.toBeUndefined()
        await expect(client.stopAutoRefresh()).resolves.toBeUndefined()
      } finally {
        jest.useRealTimers()
      }
    })

    test('throwOnError mode: error throwing remains correct', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] })
      try {
        const storage = memoryLocalStorageAdapter()

        const customFetch = jest.fn(async () => {
          throw new TypeError('Network request failed')
        })

        const client = new GoTrueClient({
          url: 'http://localhost:9999',
          storage,
          autoRefreshToken: false,
          persistSession: true,
          detectSessionInUrl: false,
          throwOnError: true,
          fetch: customFetch as any,
        })

        await client.initialize()

        // Plant expired session after clean init
        await setItemAsync(storage, STORAGE_KEY, createExpiredSession())

        // refreshSession should throw when throwOnError is true
        const refreshPromise = client.refreshSession()
        const assertion = expect(refreshPromise).rejects.toThrow('Network request failed')
        for (let i = 0; i < 10; i++) {
          await jest.advanceTimersByTimeAsync(3000)
        }
        await assertion
      } finally {
        jest.useRealTimers()
      }
    })

    test('Async storage: delayed reads/writes do not break session consistency', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] })
      try {
        const memory = new Map<string, string>()
        const asyncStorage = {
          getItem: jest.fn(async (key: string) => {
            await Promise.resolve()
            return memory.get(key) ?? null
          }),
          setItem: jest.fn(async (key: string, value: string) => {
            await Promise.resolve()
            memory.set(key, value)
          }),
          removeItem: jest.fn(async (key: string) => {
            await Promise.resolve()
            memory.delete(key)
          }),
        }

        await asyncStorage.setItem(STORAGE_KEY, JSON.stringify(createExpiredSession()))

        let online = false
        const customFetch = jest.fn(async () => {
          if (!online) throw new TypeError('Network request failed')
          const exp = Math.floor(Date.now() / 1000) + 3600
          return new Response(
            JSON.stringify({
              access_token: generateJwt(exp),
              refresh_token: 'token-async-rotated',
              token_type: 'bearer',
              expires_in: 3600,
              expires_at: exp,
              user,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        })

        const client = new GoTrueClient({
          url: 'http://localhost:9999',
          storage: asyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          fetch: customFetch as any,
        })

        const initPromise = client.initialize()
        for (let i = 0; i < 15; i++) {
          await jest.advanceTimersByTimeAsync(3000)
        }
        await initPromise

        online = true
        await client.startAutoRefresh()

        for (let i = 0; i < 5; i++) {
          await jest.advanceTimersByTimeAsync(100)
        }

        const raw = await asyncStorage.getItem(STORAGE_KEY)
        const stored = JSON.parse(raw!)
        expect(stored.refresh_token).toBe('token-async-rotated')
      } finally {
        jest.useRealTimers()
      }
    })
  })
})
