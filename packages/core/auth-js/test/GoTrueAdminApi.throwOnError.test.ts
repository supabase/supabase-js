import GoTrueClient from '../src/GoTrueClient'
import GoTrueAdminApi from '../src/GoTrueAdminApi'
import { AuthApiError } from '../src/lib/errors'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'
import { GoTrueClient as GoTrueClientType } from '../src'

const TEST_URL = 'http://localhost:9999'
const USER_ID = '715ed5db-f090-4b8c-a067-640ecee36aa0'

const failingFetch: typeof fetch = (async (_input: RequestInfo | URL, _init?: RequestInit) =>
  new Response(JSON.stringify({ msg: 'admin failure', code: 404 }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  })) as unknown as typeof fetch

describe('GoTrueAdminApi with throwOnError option', () => {
  test('admin methods should throw when throwOnError is true', async () => {
    const client: GoTrueClientType = new GoTrueClient({
      url: TEST_URL,
      storageKey: 'admin-throw-on-error-test',
      autoRefreshToken: false,
      persistSession: false,
      storage: memoryLocalStorageAdapter(),
      fetch: failingFetch,
      throwOnError: true,
    })

    await expect(client.admin.deleteUser(USER_ID)).rejects.toThrow()
    await expect(client.admin.getUserById(USER_ID)).rejects.toThrow()
  })

  test('admin methods should return { error } when throwOnError is not set (backward compatible)', async () => {
    const client: GoTrueClientType = new GoTrueClient({
      url: TEST_URL,
      storageKey: 'admin-return-error-test',
      autoRefreshToken: false,
      persistSession: false,
      storage: memoryLocalStorageAdapter(),
      fetch: failingFetch,
    })

    const result = await client.admin.deleteUser(USER_ID)
    expect(result.error).not.toBeNull()
    expect(result.data?.user).toBeNull()
  })

  test('standalone GoTrueAdminApi without throwOnError keeps legacy behavior', async () => {
    const admin = new GoTrueAdminApi({
      url: TEST_URL,
      headers: { apikey: 'test' },
      fetch: failingFetch,
    })

    const result = await admin.deleteUser(USER_ID)
    expect(result.error).not.toBeNull()
    expect(result.data?.user).toBeNull()
  })

  test('client signOut still cleans up locally when admin.signOut rejects (throwOnError)', async () => {
    const storageKey = 'signout-ripple-test'
    // inject an unexpired session directly into storage so _signOut reaches the admin call
    const b64 = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const now = Math.floor(Date.now() / 1000)
    const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'user-1', exp: now + 3600 })}.sig`
    const storage = memoryLocalStorageAdapter({
      [storageKey]: JSON.stringify({
        access_token: jwt,
        refresh_token: 'rt',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now + 3600,
        user: { id: 'user-1', aud: 'authenticated', email: 'user@example.com' },
      }),
    })

    const client: GoTrueClientType = new GoTrueClient({
      url: TEST_URL,
      storageKey,
      autoRefreshToken: false,
      persistSession: true,
      storage,
      fetch: failingFetch,
      throwOnError: true,
    })

    jest
      .spyOn(client.admin, 'signOut')
      .mockRejectedValue(new AuthApiError('logout failed', 500, undefined))

    // Non-ignorable failure: the client is in throw mode, so signOut rejects —
    // but ONLY after the status rules ran and the local session was removed.
    await expect(client.signOut({ scope: 'local' })).rejects.toThrow('logout failed')
    expect(await storage.getItem(storageKey)).toBeNull()

    // Ignorable failure (401): resolved as success after cleanup, no throw.
    const storage2 = memoryLocalStorageAdapter({
      [storageKey]: JSON.stringify({
        access_token: jwt,
        refresh_token: 'rt',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now + 3600,
        user: { id: 'user-1', aud: 'authenticated', email: 'user@example.com' },
      }),
    })
    const client2: GoTrueClientType = new GoTrueClient({
      url: TEST_URL,
      storageKey,
      autoRefreshToken: false,
      persistSession: true,
      storage: storage2,
      fetch: failingFetch,
      throwOnError: true,
    })
    jest
      .spyOn(client2.admin, 'signOut')
      .mockRejectedValue(new AuthApiError('expired jwt', 401, undefined))

    const { error: error2 } = await client2.signOut({ scope: 'local' })
    expect(error2).toBeNull()
    expect(await storage2.getItem(storageKey)).toBeNull()

    // Validation errors (invalid scope) thrown before any request must keep
    // rejecting — and must NOT clear the local session. No spy: the real
    // scope validation runs.
    const storage3 = memoryLocalStorageAdapter({
      [storageKey]: JSON.stringify({
        access_token: jwt,
        refresh_token: 'rt',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now + 3600,
        user: { id: 'user-1', aud: 'authenticated', email: 'user@example.com' },
      }),
    })
    const client3: GoTrueClientType = new GoTrueClient({
      url: TEST_URL,
      storageKey,
      autoRefreshToken: false,
      persistSession: true,
      storage: storage3,
      fetch: failingFetch,
      throwOnError: true,
    })

    await expect(client3.signOut({ scope: 'bogus' as never })).rejects.toThrow(
      'Parameter scope must be one of'
    )
    expect(await storage3.getItem(storageKey)).not.toBeNull()
  })
})
