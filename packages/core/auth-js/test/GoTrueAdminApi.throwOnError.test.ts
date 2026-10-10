import { GoTrueClient } from '../src/index'

// Fetch is always mocked in this file, so the URL is never resolved.
const TEST_URL = 'http://localhost:9999'
const TEST_USER_UUID = '11111111-2222-3333-4444-555555555555'
const U = TEST_USER_UUID
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'
import type { Session } from '../src/lib/types'

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  headers: new Headers({ 'x-supabase-api-version': '2024-01-01' }),
  json: () => Promise.resolve(body),
})

const createClient = (throwOnError: boolean) => {
  const mockFetch = jest.fn()
  const client = new GoTrueClient({
    url: TEST_URL,
    autoRefreshToken: false,
    persistSession: false,
    fetch: mockFetch as unknown as typeof fetch,
    throwOnError,
  })
  return { client, mockFetch }
}

const STORAGE_KEY = 'admin-throw-on-error-test'

const createSignedInClient = async () => {
  const mockFetch = jest.fn()
  const storage = memoryLocalStorageAdapter()
  await storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: TEST_USER_UUID,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'user@example.com',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    } as Session)
  )
  const client = new GoTrueClient({
    url: TEST_URL,
    storageKey: STORAGE_KEY,
    storage,
    autoRefreshToken: false,
    persistSession: true,
    fetch: mockFetch as unknown as typeof fetch,
    throwOnError: true,
  })
  await client.initialize()
  return { client, mockFetch, storage }
}

describe('signOut() with throwOnError enabled', () => {
  test.each([404, 401, 403])(
    'ignores a %i from the logout endpoint and still clears the session',
    async (status) => {
      const { client, mockFetch, storage } = await createSignedInClient()
      mockFetch.mockResolvedValueOnce(jsonResponse({ msg: 'ignored' }, status))

      await expect(client.signOut()).resolves.toEqual({ error: null })
      expect(await storage.getItem(STORAGE_KEY)).toBeNull()
    }
  )

  test('rejects with any other AuthApiError', async () => {
    const { client, mockFetch } = await createSignedInClient()
    mockFetch.mockResolvedValueOnce(jsonResponse({ msg: 'bad request' }, 400))

    await expect(client.signOut()).rejects.toMatchObject({ name: 'AuthApiError', status: 400 })
  })
})

describe('GoTrueAdminApi with throwOnError', () => {
  test.each<[string, (c: GoTrueClient) => Promise<unknown>]>([
    ['signOut', (c) => c.admin.signOut('test-jwt')],
    ['inviteUserByEmail', (c) => c.admin.inviteUserByEmail('user@example.com')],
    ['generateLink', (c) => c.admin.generateLink({ type: 'magiclink', email: 'user@example.com' })],
    ['createUser', (c) => c.admin.createUser({ email: 'user@example.com' })],
    ['listUsers', (c) => c.admin.listUsers()],
    ['getUserById', (c) => c.admin.getUserById(U)],
    ['updateUserById', (c) => c.admin.updateUserById(U, { email: 'user@example.com' })],
    ['deleteUser', (c) => c.admin.deleteUser(U)],
    ['mfa.listFactors', (c) => c.admin.mfa.listFactors({ userId: U })],
    ['mfa.deleteFactor', (c) => c.admin.mfa.deleteFactor({ userId: U, id: U })],
    ['oauth.listClients', (c) => c.admin.oauth.listClients()],
    ['oauth.getClient', (c) => c.admin.oauth.getClient('client-id')],
    ['oauth.deleteClient', (c) => c.admin.oauth.deleteClient('client-id')],
    ['customProviders.listProviders', (c) => c.admin.customProviders.listProviders()],
    ['customProviders.getProvider', (c) => c.admin.customProviders.getProvider('custom:acme')],
    [
      'customProviders.deleteProvider',
      (c) => c.admin.customProviders.deleteProvider('custom:acme'),
    ],
    ['passkey.listPasskeys', (c) => c.admin.passkey.listPasskeys({ userId: U })],
    ['passkey.deletePasskey', (c) => c.admin.passkey.deletePasskey({ userId: U, passkeyId: U })],
  ])('%s rejects with the AuthApiError when throwOnError is enabled', async (_name, invoke) => {
    const { client, mockFetch } = createClient(true)
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ code: 'user_not_found', msg: 'User not found' }, 404)
    )

    await expect(invoke(client)).rejects.toMatchObject({ name: 'AuthApiError', status: 404 })
  })

  test('getUserById returns the error when throwOnError is disabled', async () => {
    const { client, mockFetch } = createClient(false)
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ code: 'user_not_found', msg: 'User not found' }, 404)
    )

    const { data, error } = await client.admin.getUserById(TEST_USER_UUID)

    expect(data.user).toBeNull()
    expect(error).toMatchObject({ name: 'AuthApiError', status: 404 })
  })
})
