import GoTrueClient from '../src/GoTrueClient'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'

const STORAGE_KEY = 'test-session-replaced'
const URL = 'http://localhost:9999'

const jwtFor = (sub: string) => {
  const encode = (value: string) => Buffer.from(value).toString('base64url')
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = encode(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 3600 }))
  return `${header}.${payload}.${encode('signature')}`
}

const userFor = (id: string, user_metadata: object = {}) => ({
  id,
  aud: 'authenticated',
  role: 'authenticated',
  email: `${id}@example.com`,
  app_metadata: {},
  user_metadata,
  created_at: new Date(0).toISOString(),
})

const sessionFor = (id: string, refresh_token = `${id}-refresh-token`) => ({
  access_token: jwtFor(id),
  refresh_token,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: userFor(id),
})

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0))

const json = (body: object) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

/**
 * Signs user-a in from storage and holds the response of `heldPath` open until `release` is
 * called, so another call can finish while the first one is still waiting on the network.
 */
const setup = async (heldPath: '/logout' | '/user') => {
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const mockFetch = jest.fn().mockImplementation(async (input: string, init: RequestInit) => {
    const path = input.slice(URL.length)
    if (path.startsWith(heldPath)) {
      await held
    }
    if (path.startsWith('/logout')) {
      return new Response(null, { status: 204 })
    }
    if (path.startsWith('/user')) {
      return json(userFor('user-a', JSON.parse(init.body as string).data))
    }
    if (path === '/token?grant_type=password') {
      return json(sessionFor('user-b'))
    }
    if (path === '/token?grant_type=refresh_token') {
      return json(sessionFor('user-a', 'user-a-rotated-refresh-token'))
    }
    throw new Error(`unexpected request to ${path}`)
  })

  const storage = memoryLocalStorageAdapter({
    [STORAGE_KEY]: JSON.stringify(sessionFor('user-a')),
  })
  const client = new GoTrueClient({
    url: URL,
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
  await nextTask()
  onAuthStateChange.mockClear()

  const storedSession = async () => {
    const stored = await storage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  }
  const events = () => onAuthStateChange.mock.calls.map(([event]) => event)

  return { client, release, storedSession, events }
}

describe('GoTrueClient with a session change during a request', () => {
  describe('signOut (global)', () => {
    test('keeps the session of another user who signed in during the request', async () => {
      const { client, release, storedSession, events } = await setup('/logout')

      const pending = client.signOut()
      await nextTask()
      await client.signInWithPassword({ email: 'user-b@example.com', password: 'password' })
      release()

      expect((await pending).error).toBeNull()
      expect((await storedSession())?.user.id).toBe('user-b')
      expect(events()).toEqual(['SIGNED_IN'])
    })

    test('still signs out when the same session was refreshed during the request', async () => {
      const { client, release, storedSession, events } = await setup('/logout')

      const pending = client.signOut()
      await nextTask()
      await client.refreshSession()
      release()

      expect((await pending).error).toBeNull()
      expect(await storedSession()).toBeNull()
      expect(events()).toEqual(['TOKEN_REFRESHED', 'SIGNED_OUT'])
    })
  })

  describe('updateUser', () => {
    test('keeps the tokens of a refresh that finished during the request', async () => {
      const { client, release, storedSession, events } = await setup('/user')

      const pending = client.updateUser({ data: { name: 'new name' } })
      await nextTask()
      await client.refreshSession()
      release()

      expect((await pending).data.user?.user_metadata).toEqual({ name: 'new name' })
      const stored = await storedSession()
      expect(stored.refresh_token).toBe('user-a-rotated-refresh-token')
      expect(stored.user.user_metadata).toEqual({ name: 'new name' })
      expect(events()).toEqual(['TOKEN_REFRESHED', 'USER_UPDATED'])
    })

    test('keeps the session of another user who signed in during the request', async () => {
      const { client, release, storedSession, events } = await setup('/user')

      const pending = client.updateUser({ data: { name: 'new name' } })
      await nextTask()
      await client.signInWithPassword({ email: 'user-b@example.com', password: 'password' })
      release()

      const { data, error } = await pending
      expect(error).toBeNull()
      expect(data.user?.id).toBe('user-a')
      expect((await storedSession())?.user.id).toBe('user-b')
      expect(events()).toEqual(['SIGNED_IN'])
    })

    test('does not bring back a session that was signed out during the request', async () => {
      const { client, release, storedSession, events } = await setup('/user')

      const pending = client.updateUser({ data: { name: 'new name' } })
      await nextTask()
      await client.signOut({ scope: 'local' })
      release()

      expect((await pending).error).toBeNull()
      expect(await storedSession()).toBeNull()
      expect(events()).toEqual(['SIGNED_OUT'])
    })
  })
})
