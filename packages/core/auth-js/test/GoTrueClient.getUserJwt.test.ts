import GoTrueClient from '../src/GoTrueClient'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'

const storageKey = 'test-get-user-jwt'

const session = {
  access_token: 'stored-access-token',
  refresh_token: 'stored-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: 'stored-user-id',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'stored@example.com',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date(0).toISOString(),
  },
}

const sessionNotFound = () =>
  new Response(
    JSON.stringify({
      code: 403,
      error_code: 'session_not_found',
      msg: 'Session from session_id claim in JWT does not exist',
    }),
    { status: 403, headers: { 'content-type': 'application/json' } }
  )

const makeClient = () => {
  const storage = memoryLocalStorageAdapter({ [storageKey]: JSON.stringify(session) })
  const client = new GoTrueClient({
    url: 'http://localhost:9999',
    autoRefreshToken: false,
    persistSession: true,
    storage,
    storageKey,
    fetch: jest.fn().mockImplementation(async () => sessionNotFound()),
  })
  return client
}

describe('getUser() with session_not_found', () => {
  it('keeps the stored session when the rejected JWT was passed in by the caller', async () => {
    const client = makeClient()

    const { data, error } = await client.getUser('some-other-users-jwt')
    expect(data.user).toBeNull()
    expect(error?.name).toBe('AuthSessionMissingError')

    const {
      data: { session: stored },
    } = await client.getSession()
    expect(stored?.access_token).toBe(session.access_token)
  })

  it('removes the stored session when its own access token is rejected', async () => {
    const client = makeClient()

    const { error } = await client.getUser()
    expect(error?.name).toBe('AuthSessionMissingError')

    const {
      data: { session: stored },
    } = await client.getSession()
    expect(stored).toBeNull()
  })
})
