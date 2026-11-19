import { GoTrueClient } from '../src/index'
import { AuthError } from '../src/lib/errors'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'
import type { Session } from '../src/lib/types'

// Fetch is always mocked in this file, so the URL is never resolved.
const TEST_URL = 'http://localhost:9999'
const TEST_HEADERS = { apikey: 'test-publishable-key' }
const STORED_ACCESS_TOKEN = 'test-access-token'
// Same shape as IDs issued by Supabase Auth: 32 lowercase base32 characters.
const VALID_AUTHORIZATION_ID = 'k3j5n2abcdefghijmnpqrstuvwxyz467'

const INVALID_AUTHORIZATION_IDS = [
  '',
  '../../admin/users',
  '../factors',
  'abc/consent',
  'abc?action=approve',
  'abc#',
  'abc%2F..%2Fadmin',
  'abc def',
  'abc.def',
]

const mockSession = (): Session =>
  ({
    access_token: STORED_ACCESS_TOKEN,
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: '11111111-2222-3333-4444-555555555555',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'oauth-consent-user@example.com',
      created_at: '2026-01-01T00:00:00.000Z',
    },
  }) as Session

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  headers: new Headers({ 'x-supabase-api-version': '2024-01-01' }),
  json: () => Promise.resolve(body),
})

const createClient = async ({ throwOnError = false }: { throwOnError?: boolean } = {}) => {
  const mockFetch = jest.fn()
  const storage = memoryLocalStorageAdapter()
  const storageKey = 'oauth-consent-methods-test'
  await storage.setItem(storageKey, JSON.stringify(mockSession()))
  const client = new GoTrueClient({
    url: TEST_URL,
    headers: TEST_HEADERS,
    storageKey,
    storage,
    autoRefreshToken: false,
    persistSession: true,
    fetch: mockFetch as unknown as typeof fetch,
    throwOnError,
  })
  await client.initialize()
  mockFetch.mockClear()
  return { client, mockFetch }
}

const lastRequest = (mockFetch: jest.Mock) => {
  const [url, params] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
  return { url, params, body: params.body ? JSON.parse(params.body) : undefined }
}

type ConsentCall = (
  client: GoTrueClient,
  authorizationId: unknown
) => Promise<{ data: unknown; error: AuthError | null }>

const METHODS: [string, ConsentCall][] = [
  ['getAuthorizationDetails', (client, id) => client.oauth.getAuthorizationDetails(id as string)],
  [
    'approveAuthorization',
    (client, id) => client.oauth.approveAuthorization(id as string, { skipBrowserRedirect: true }),
  ],
  [
    'denyAuthorization',
    (client, id) => client.oauth.denyAuthorization(id as string, { skipBrowserRedirect: true }),
  ],
]

describe('oauth consent methods: authorizationId validation', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe.each(METHODS)('%s', (_name, call) => {
    test.each(INVALID_AUTHORIZATION_IDS)(
      'returns validation_failed without a request for %p',
      async (authorizationId) => {
        const { client, mockFetch } = await createClient()

        const { data, error } = await call(client, authorizationId)

        expect(data).toBeNull()
        expect(error).toBeInstanceOf(AuthError)
        expect(error?.code).toBe('validation_failed')
        expect(error?.status).toBe(400)
        expect(mockFetch).not.toHaveBeenCalled()
      }
    )

    test.each([undefined, null, 123])(
      'returns validation_failed for non-string value %p',
      async (authorizationId) => {
        const { client, mockFetch } = await createClient()

        const { data, error } = await call(client, authorizationId)

        expect(data).toBeNull()
        expect(error?.code).toBe('validation_failed')
        expect(mockFetch).not.toHaveBeenCalled()
      }
    )

    test('throws the validation error when throwOnError is enabled', async () => {
      const { client, mockFetch } = await createClient({ throwOnError: true })

      await expect(call(client, '../../admin/users')).rejects.toMatchObject({
        code: 'validation_failed',
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  test('getAuthorizationDetails sends GET /oauth/authorizations/:id for a valid ID', async () => {
    const { client, mockFetch } = await createClient()
    const details = { authorization_id: VALID_AUTHORIZATION_ID, scope: 'openid' }
    mockFetch.mockResolvedValueOnce(jsonResponse(details))

    const { data, error } = await client.oauth.getAuthorizationDetails(VALID_AUTHORIZATION_ID)

    expect(error).toBeNull()
    expect(data).toEqual(details)
    const { url, params } = lastRequest(mockFetch)
    expect(url).toBe(`${TEST_URL}/oauth/authorizations/${VALID_AUTHORIZATION_ID}`)
    expect(params.method).toBe('GET')
    expect(params.headers.Authorization).toBe(`Bearer ${STORED_ACCESS_TOKEN}`)
  })

  test.each([
    ['approveAuthorization', 'approve'],
    ['denyAuthorization', 'deny'],
  ] as const)(
    '%s sends POST /oauth/authorizations/:id/consent for a valid ID',
    async (method, action) => {
      const { client, mockFetch } = await createClient()
      const redirect = { redirect_url: 'https://client.example.com/callback?code=abc' }
      mockFetch.mockResolvedValueOnce(jsonResponse(redirect))

      const { data, error } = await client.oauth[method](VALID_AUTHORIZATION_ID, {
        skipBrowserRedirect: true,
      })

      expect(error).toBeNull()
      expect(data).toEqual(redirect)
      const { url, params, body } = lastRequest(mockFetch)
      expect(url).toBe(`${TEST_URL}/oauth/authorizations/${VALID_AUTHORIZATION_ID}/consent`)
      expect(params.method).toBe('POST')
      expect(params.headers.Authorization).toBe(`Bearer ${STORED_ACCESS_TOKEN}`)
      expect(body).toEqual({ action })
    }
  )
})
