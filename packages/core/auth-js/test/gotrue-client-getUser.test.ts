import { MockServer } from 'jest-mock-server'
import { API_VERSION_HEADER_NAME } from '../src/lib/constants'
import GoTrueClient from '../src/GoTrueClient'

class MemoryStorage {
  private _storage: { [name: string]: string } = {}

  async setItem(name: string, value: string) {
    this._storage[name] = value
  }

  async getItem(name: string): Promise<string | null> {
    return this._storage[name] ?? null
  }

  async removeItem(name: string) {
    delete this._storage[name]
  }
}

function createMockSession() {
  return {
    access_token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwic2Vzc2lvbl9pZCI6InRlc3Qtc2Vzc2lvbiIsImV4cCI6OTk5OTk5OTk5OX0.fake',
    refresh_token: 'fake-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
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

const storageKey = 'test-storage-key'

function createClient(url: string, storage: MemoryStorage) {
  return new GoTrueClient({
    url,
    autoRefreshToken: false,
    persistSession: true,
    storage,
    storageKey,
    detectSessionInUrl: false,
  })
}

function mockSessionNotFound(server: MockServer) {
  return server.get('/user').mockImplementationOnce((ctx) => {
    ctx.status = 403
    ctx.set(API_VERSION_HEADER_NAME, '2024-01-01')
    ctx.body = {
      code: 'session_not_found',
      message: 'Session from session_id claim in JWT does not exist',
    }
  })
}

describe('_getUser session preservation', () => {
  const server = new MockServer()

  beforeAll(async () => await server.start())
  afterAll(async () => await server.stop())
  beforeEach(() => server.reset())

  it('getUser() with session_not_found does not remove session from storage', async () => {
    const storage = new MemoryStorage()
    const mockSession = createMockSession()
    await storage.setItem(storageKey, JSON.stringify(mockSession))

    const url = server.getURL().toString().replace(/\/$/, '')
    const client = createClient(url, storage)

    const route = mockSessionNotFound(server)

    const { data, error } = await client.getUser()

    expect(route).toHaveBeenCalledTimes(1)
    expect(data.user).toBeNull()
    expect(error).not.toBeNull()

    const sessionAfter = await storage.getItem(storageKey)
    expect(sessionAfter).not.toBeNull()
  })

  it('getUser() with session_not_found does not fire SIGNED_OUT event', async () => {
    const storage = new MemoryStorage()
    const mockSession = createMockSession()
    await storage.setItem(storageKey, JSON.stringify(mockSession))

    const url = server.getURL().toString().replace(/\/$/, '')
    const client = createClient(url, storage)

    const events: string[] = []
    const {
      data: { subscription },
    } = client.onAuthStateChange((event) => {
      events.push(event)
    })

    // Wait for initialization to complete (fires INITIAL_SESSION)
    await client.getSession()
    expect(events).toContain('INITIAL_SESSION')

    const route = mockSessionNotFound(server)

    await client.getUser()

    expect(route).toHaveBeenCalledTimes(1)
    expect(events).not.toContain('SIGNED_OUT')

    subscription.unsubscribe()
  })

  it('getUser() with session_not_found returns correct error shape', async () => {
    const storage = new MemoryStorage()
    const mockSession = createMockSession()
    await storage.setItem(storageKey, JSON.stringify(mockSession))

    const url = server.getURL().toString().replace(/\/$/, '')
    const client = createClient(url, storage)

    const route = mockSessionNotFound(server)

    const result = await client.getUser()

    expect(route).toHaveBeenCalledTimes(1)
    expect(result.data.user).toBeNull()
    expect(result.error).not.toBeNull()
    expect(result.error!.name).toEqual('AuthSessionMissingError')
  })

  it('getUser() with session_not_found preserves code-verifier in storage', async () => {
    const storage = new MemoryStorage()
    const mockSession = createMockSession()
    await storage.setItem(storageKey, JSON.stringify(mockSession))
    await storage.setItem(`${storageKey}-code-verifier`, 'test-code-verifier')

    const url = server.getURL().toString().replace(/\/$/, '')
    const client = createClient(url, storage)

    const route = mockSessionNotFound(server)

    await client.getUser()

    expect(route).toHaveBeenCalledTimes(1)

    const codeVerifier = await storage.getItem(`${storageKey}-code-verifier`)
    expect(codeVerifier).toEqual('test-code-verifier')
  })

  it('getUser() with non-session_not_found error does not remove session', async () => {
    const storage = new MemoryStorage()
    const mockSession = createMockSession()
    await storage.setItem(storageKey, JSON.stringify(mockSession))

    const url = server.getURL().toString().replace(/\/$/, '')
    const client = createClient(url, storage)

    const route = server.get('/user').mockImplementationOnce((ctx) => {
      ctx.status = 401
      ctx.set(API_VERSION_HEADER_NAME, '2024-01-01')
      ctx.body = {
        code: 'bad_jwt',
        message: 'Invalid or expired JWT',
      }
    })

    const { data, error } = await client.getUser()

    expect(route).toHaveBeenCalledTimes(1)
    expect(data.user).toBeNull()
    expect(error).not.toBeNull()
    expect(error!.name).toEqual('AuthApiError')

    const sessionAfter = await storage.getItem(storageKey)
    expect(sessionAfter).not.toBeNull()
  })

  it('signOut() still removes session (regression)', async () => {
    const storage = new MemoryStorage()
    const mockSession = createMockSession()
    await storage.setItem(storageKey, JSON.stringify(mockSession))

    const url = server.getURL().toString().replace(/\/$/, '')
    const client = createClient(url, storage)

    const route = server.post('/logout').mockImplementationOnce((ctx) => {
      ctx.status = 204
      ctx.body = ''
    })

    const { error } = await client.signOut()

    expect(route).toHaveBeenCalledTimes(1)
    expect(error).toBeNull()

    const sessionAfter = await storage.getItem(storageKey)
    expect(sessionAfter).toBeNull()
  })
})
