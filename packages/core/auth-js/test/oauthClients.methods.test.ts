import { GoTrueAdminApi } from '../src/index'

// Fetch is always mocked in this file, so the URL is never resolved.
const TEST_URL = 'http://localhost:9999'
const TEST_CLIENT_UUID = '99999999-8888-7777-6666-555555555555'
const TEST_CLIENT = { client_id: TEST_CLIENT_UUID, client_name: 'Test client' }

const INVALID_CLIENT_IDS = ['not-a-uuid', '../users', `${TEST_CLIENT_UUID}/regenerate_secret`, '']

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  headers: new Headers({ 'x-supabase-api-version': '2024-01-01' }),
  json: () => Promise.resolve(body),
})

const createAdminClient = () => {
  const mockFetch = jest.fn()
  const admin = new GoTrueAdminApi({
    url: TEST_URL,
    headers: { Authorization: 'Bearer secret-key-token' },
    fetch: mockFetch as unknown as typeof fetch,
  })
  return { admin, mockFetch }
}

const lastRequest = (mockFetch: jest.Mock) => {
  const [url, params] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
  return { url, params }
}

type ClientCall = (admin: GoTrueAdminApi, clientId: string) => Promise<{ error: unknown }>

const METHODS: [string, ClientCall, string, string][] = [
  ['getClient', (admin, id) => admin.oauth.getClient(id), 'GET', ''],
  [
    'updateClient',
    (admin, id) => admin.oauth.updateClient(id, { client_name: 'Renamed' }),
    'PUT',
    '',
  ],
  ['deleteClient', (admin, id) => admin.oauth.deleteClient(id), 'DELETE', ''],
  [
    'regenerateClientSecret',
    (admin, id) => admin.oauth.regenerateClientSecret(id),
    'POST',
    '/regenerate_secret',
  ],
]

describe.each(METHODS)('admin.oauth.%s', (_name, call, method, suffix) => {
  test.each(INVALID_CLIENT_IDS)(
    'rejects non-UUID clientId %p before hitting the server',
    async (id) => {
      const { admin, mockFetch } = createAdminClient()

      await expect(call(admin, id)).rejects.toThrow('Expected parameter to be UUID')
      expect(mockFetch).not.toHaveBeenCalled()
    }
  )

  test('calls the client endpoint for a valid UUID', async () => {
    const { admin, mockFetch } = createAdminClient()
    mockFetch.mockResolvedValueOnce(jsonResponse(TEST_CLIENT))

    const { error } = await call(admin, TEST_CLIENT_UUID)

    expect(error).toBeNull()
    const { url, params } = lastRequest(mockFetch)
    expect(url).toBe(`${TEST_URL}/admin/oauth/clients/${TEST_CLIENT_UUID}${suffix}`)
    expect(params.method).toBe(method)
  })
})
