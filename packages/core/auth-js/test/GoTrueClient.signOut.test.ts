import GoTrueClient from '../src/GoTrueClient'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'

const STORAGE_KEY = 'test-signout'

const createStoredSession = () => ({
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
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

const setup = async (mockFetch: jest.Mock, { withSession = true } = {}) => {
  const storage = memoryLocalStorageAdapter(
    withSession
      ? {
          [STORAGE_KEY]: JSON.stringify(createStoredSession()),
          [`${STORAGE_KEY}-code-verifier`]: 'test-code-verifier',
        }
      : {}
  )
  const client = new GoTrueClient({
    url: 'http://localhost:9999',
    autoRefreshToken: false,
    persistSession: true,
    storage,
    storageKey: STORAGE_KEY,
    fetch: mockFetch,
  })
  await client.initialize()
  const onAuthStateChange = jest.fn()
  client.onAuthStateChange(onAuthStateChange)
  // let the INITIAL_SESSION event flush before clearing the mock
  await Promise.resolve()
  onAuthStateChange.mockClear()
  return { client, storage, onAuthStateChange }
}

const respond = (status: number) =>
  jest
    .fn()
    .mockResolvedValue(
      new Response(status === 204 ? null : JSON.stringify({ message: 'x' }), { status })
    )

const offline = () => jest.fn().mockRejectedValue(new Error('offline'))

const signedOutEvents = (onAuthStateChange: jest.Mock) =>
  onAuthStateChange.mock.calls.filter(([event]) => event === 'SIGNED_OUT')

describe('GoTrueClient signOut', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe("scope: 'local'", () => {
    test.each([
      ['a network error', offline],
      ['a 500', () => respond(500)],
    ])('clears the session and fires SIGNED_OUT on %s', async (_name, makeFetch) => {
      const { client, storage, onAuthStateChange } = await setup(makeFetch())

      const { error } = await client.signOut({ scope: 'local' })

      expect(error).not.toBeNull()
      expect(await storage.getItem(STORAGE_KEY)).toBeNull()
      expect(await storage.getItem(`${STORAGE_KEY}-code-verifier`)).toBeNull()
      expect(signedOutEvents(onAuthStateChange)).toHaveLength(1)
    })

    test('clears the session before the request resolves', async () => {
      let release!: () => void
      const mockFetch = jest.fn().mockReturnValue(
        new Promise<Response>((resolve) => {
          release = () => resolve(new Response(null, { status: 204 }))
        })
      )
      const { client, storage, onAuthStateChange } = await setup(mockFetch)

      const pending = client.signOut({ scope: 'local' })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-access-token')
      expect(await storage.getItem(STORAGE_KEY)).toBeNull()
      expect(signedOutEvents(onAuthStateChange)).toHaveLength(1)

      release()
      expect((await pending).error).toBeNull()
    })

    test('returns a retryable error when the auth server cannot be reached', async () => {
      const { client } = await setup(offline())

      const { error } = await client.signOut({ scope: 'local' })

      expect(error?.name).toBe('AuthRetryableFetchError')
    })

    test.each([204, 401, 403, 404])(
      'clears the session and fires SIGNED_OUT on %s',
      async (status) => {
        const { client, storage, onAuthStateChange } = await setup(respond(status))

        const { error } = await client.signOut({ scope: 'local' })

        expect(error).toBeNull()
        expect(await storage.getItem(STORAGE_KEY)).toBeNull()
        expect(signedOutEvents(onAuthStateChange)).toHaveLength(1)
      }
    )
  })

  describe("scope: 'global'", () => {
    test('keeps the session, fires no SIGNED_OUT and allows a retry when the network fails', async () => {
      const mockFetch = jest.fn().mockRejectedValueOnce(new Error('offline'))
      const { client, storage, onAuthStateChange } = await setup(mockFetch)

      const { error } = await client.signOut({ scope: 'global' })

      expect(error?.name).toBe('AuthRetryableFetchError')
      expect(await storage.getItem(STORAGE_KEY)).not.toBeNull()
      expect(signedOutEvents(onAuthStateChange)).toHaveLength(0)

      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
      const retry = await client.signOut({ scope: 'global' })

      expect(retry.error).toBeNull()
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(await storage.getItem(STORAGE_KEY)).toBeNull()
      expect(signedOutEvents(onAuthStateChange)).toHaveLength(1)
    })

    test('keeps the session and fires no SIGNED_OUT on a 500 (default scope)', async () => {
      const { client, storage, onAuthStateChange } = await setup(respond(500))

      const { error } = await client.signOut()

      expect(error).not.toBeNull()
      expect(await storage.getItem(STORAGE_KEY)).not.toBeNull()
      expect(signedOutEvents(onAuthStateChange)).toHaveLength(0)
    })

    test.each([204, 401, 403, 404])(
      'clears the session and fires SIGNED_OUT on %s',
      async (status) => {
        const { client, storage, onAuthStateChange } = await setup(respond(status))

        const { error } = await client.signOut({ scope: 'global' })

        expect(error).toBeNull()
        expect(await storage.getItem(STORAGE_KEY)).toBeNull()
        expect(signedOutEvents(onAuthStateChange)).toHaveLength(1)
      }
    )
  })

  describe("scope: 'others'", () => {
    test.each([
      ['a 204', () => respond(204), false],
      ['a 401', () => respond(401), false],
      ['a 403', () => respond(403), false],
      ['a 404', () => respond(404), false],
      ['a 500', () => respond(500), true],
      ['a network error', offline, true],
    ])('keeps the session and fires no SIGNED_OUT on %s', async (_name, makeFetch, expectError) => {
      const { client, storage, onAuthStateChange } = await setup(makeFetch())

      const { error } = await client.signOut({ scope: 'others' })

      if (expectError) {
        expect(error).not.toBeNull()
      } else {
        expect(error).toBeNull()
      }
      expect(await storage.getItem(STORAGE_KEY)).not.toBeNull()
      expect(signedOutEvents(onAuthStateChange)).toHaveLength(0)
    })
  })

  test.each(['global', 'local'] as const)(
    '%s without a session sends no request and returns no error',
    async (scope) => {
      const mockFetch = jest.fn()
      const { client } = await setup(mockFetch, { withSession: false })

      const { error } = await client.signOut({ scope })

      expect(error).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    }
  )
})
