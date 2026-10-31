import GoTrueClient from '../src/GoTrueClient'
import type { AuthChangeEvent, LockFunc, SupportedStorage } from '../src/lib/types'

// A refresh reads the session from storage, then later saves the renewed
// session or deletes the stored one. These tests cover a session saved by
// this client (`signInWithPassword`) or removed while one of those storage
// reads is still in flight: the refresh must not overwrite or delete it.
// See https://github.com/supabase/supabase-js/issues/2731.

const STORAGE_KEY = 'test-refresh-write-race'
const PASSWORD_GRANT = 'grant_type=password'
const REFRESH_GRANT = 'grant_type=refresh_token'

const makeSession = (userId: string, tag: string, secondsLeft = 3600) => ({
  access_token: `access-${tag}`,
  refresh_token: `refresh-${tag}`,
  token_type: 'bearer',
  expires_in: secondsLeft,
  expires_at: Math.floor(Date.now() / 1000) + secondsLeft,
  user: {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: `${userId}@example.com`,
    app_metadata: {},
    user_metadata: {},
    created_at: new Date(0).toISOString(),
  },
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const refusedRefresh = () =>
  json(400, {
    code: 400,
    error_code: 'refresh_token_not_found',
    msg: 'Invalid Refresh Token: Refresh Token Not Found',
  })

/**
 * Storage that applies every call in the order it was made, like an async
 * adapter (React Native's AsyncStorage, Capacitor Preferences) does, and can
 * hold calls open: a held `getItem` resolves with the value as of the call, a
 * held `setItem` has already written when it is made but resolves later.
 */
function controllableStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  let readGate: Promise<void> | null = null
  let writeGate: Promise<void> | null = null

  const hold = (set: (gate: Promise<void> | null) => void) => {
    let open!: () => void
    set(new Promise<void>((resolve) => (open = resolve)))
    return {
      /** Calls made from now on are no longer held. */
      stopHolding: () => set(null),
      /** Lets the held calls resolve. */
      release: () => open(),
    }
  }

  const adapter: SupportedStorage = {
    getItem: (key) => {
      const value = store.get(key) ?? null
      const gate = readGate
      return gate ? gate.then(() => value) : Promise.resolve(value)
    },
    setItem: (key, value) => {
      store.set(key, value)
      const gate = writeGate
      return gate ?? Promise.resolve()
    },
    removeItem: async (key) => {
      store.delete(key)
    },
  }

  return {
    adapter,
    store,
    holdReads: () => hold((gate) => (readGate = gate)),
    holdWrites: () => hold((gate) => (writeGate = gate)),
  }
}

const settle = async () => {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

/**
 * Creates a client with empty storage, lets it initialize and emit
 * INITIAL_SESSION (which would otherwise refresh the session on its own),
 * and only then puts `storedSession` in storage.
 */
async function setup({
  storedSession,
  withUserStorage = false,
  lock,
}: {
  storedSession: ReturnType<typeof makeSession>
  withUserStorage?: boolean
  lock?: LockFunc
}) {
  const storage = controllableStorage()
  const userStorage = withUserStorage ? controllableStorage() : null

  // The next answer to a refresh-token request. Tests replace it with a
  // promise they resolve themselves when they need to hold the request open.
  let refreshReply: Promise<Response> = Promise.resolve(refusedRefresh())
  const fetch = jest.fn(async (url: RequestInfo | URL) => {
    if (String(url).includes(PASSWORD_GRANT)) return json(200, makeSession('user-b', 'b'))
    if (String(url).includes(REFRESH_GRANT)) return refreshReply
    throw new Error(`unexpected request to ${url}`)
  })

  const client = new GoTrueClient({
    url: 'http://localhost:9999',
    storageKey: STORAGE_KEY,
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: false,
    storage: storage.adapter,
    ...(userStorage ? { userStorage: userStorage.adapter } : {}),
    ...(lock ? { lock } : {}),
    fetch,
  })

  const events: AuthChangeEvent[] = []
  client.onAuthStateChange((event) => {
    events.push(event)
  })
  await client.initialize()
  await settle()
  events.length = 0

  if (userStorage) {
    const { user, ...session } = storedSession
    storage.store.set(STORAGE_KEY, JSON.stringify(session))
    userStorage.store.set(`${STORAGE_KEY}-user`, JSON.stringify({ user }))
  } else {
    storage.store.set(STORAGE_KEY, JSON.stringify(storedSession))
  }

  const storedRefreshToken = () => {
    const raw = storage.store.get(STORAGE_KEY)
    return raw ? (JSON.parse(raw).refresh_token as string) : null
  }

  return {
    client,
    fetch,
    storage,
    userStorage,
    events,
    storedRefreshToken,
    setRefreshReply: (reply: Promise<Response>) => (refreshReply = reply),
    holdRefreshReply: () => {
      let resolve!: (response: Response) => void
      refreshReply = new Promise<Response>((r) => (resolve = r))
      return resolve
    },
  }
}

const signInAsB = async (client: GoTrueClient) => {
  const { error } = await client.signInWithPassword({
    email: 'user-b@example.com',
    password: 'password',
  })
  expect(error).toBeNull()
}

describe('refresh vs. a session saved while the refresh reads storage (#2731)', () => {
  let consoleSpies: jest.SpyInstance[]

  beforeEach(() => {
    consoleSpies = [
      jest.spyOn(console, 'error').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
    ]
  })

  afterEach(() => {
    consoleSpies.forEach((spy) => spy.mockRestore())
  })

  test('a refused refresh does not delete a session saved during its last storage read', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a', -10) })

    const respond = t.holdRefreshReply()
    const loading = t.client.getSession()
    await settle()

    // The refusal arrives; the refresh reads storage to decide whether to
    // delete the session, and B signs in while that read is open.
    const reads = t.storage.holdReads()
    respond(refusedRefresh())
    await settle()
    reads.stopHolding()
    await signInAsB(t.client)
    reads.release()

    const { data, error } = await loading
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(error).toBeNull()
    expect(data.session?.user.id).toBe('user-b')
    expect(t.events).not.toContain('SIGNED_OUT')
  })

  test('a successful refresh does not overwrite a session saved during its last storage read', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a', 60) })

    const respond = t.holdRefreshReply()
    const loading = t.client.getSession()
    await settle()

    // The renewal arrives; the commit guard re-reads storage, and B signs in
    // while that read is open.
    const reads = t.storage.holdReads()
    respond(json(200, makeSession('user-a', 'a-renewed')))
    await settle()
    reads.stopHolding()
    await signInAsB(t.client)
    reads.release()

    const { data, error } = await loading
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(error).toBeNull()
    expect(data.session?.user.id).toBe('user-b')
    expect(t.events).not.toContain('TOKEN_REFRESHED')
  })

  test('a refresh does not overwrite a session saved while the read that started it was open', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a', 60) })
    t.setRefreshReply(Promise.resolve(json(200, makeSession('user-a', 'a-renewed'))))

    // getSession reads A and decides to refresh it; B signs in while that
    // read is open, so every later read inside the refresh already sees B.
    const reads = t.storage.holdReads()
    const loading = t.client.getSession()
    await settle()
    reads.stopHolding()
    await signInAsB(t.client)
    reads.release()

    const { data, error } = await loading
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(error).toBeNull()
    expect(data.session?.user.id).toBe('user-b')
    expect(t.events).not.toContain('TOKEN_REFRESHED')
  })

  test('with userStorage, a session saved between the refresh writes is kept whole', async () => {
    const sessionA = makeSession('user-a', 'a', 60)
    const t = await setup({ storedSession: sessionA, withUserStorage: true })

    const respond = t.holdRefreshReply()
    const loading = t.client.getSession()
    await settle()

    // The refresh writes the user first and the session second; B signs in
    // between the two writes.
    const writes = t.userStorage!.holdWrites()
    respond(json(200, makeSession('user-a', 'a-renewed')))
    await settle()
    writes.stopHolding()
    await signInAsB(t.client)
    writes.release()

    await loading
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(JSON.parse(t.userStorage!.store.get(`${STORAGE_KEY}-user`)!).user.id).toBe('user-b')
    expect(t.events).not.toContain('TOKEN_REFRESHED')
  })

  test('re-saving the same session during a refresh does not discard the refresh', async () => {
    const sessionA = makeSession('user-a', 'a', 60)
    const t = await setup({ storedSession: sessionA })

    const respond = t.holdRefreshReply()
    const loading = t.client.getSession()
    await settle()

    // @ts-expect-error access private for test
    await t.client._saveSession(sessionA)
    respond(json(200, makeSession('user-a', 'a-renewed')))

    const { data, error } = await loading
    await settle()

    expect(error).toBeNull()
    expect(data.session?.refresh_token).toBe('refresh-a-renewed')
    expect(t.storedRefreshToken()).toBe('refresh-a-renewed')
    expect(t.events).toContain('TOKEN_REFRESHED')
  })

  test('an auto-refresh tick does not overwrite a session saved while its read was open', async () => {
    // Expires in 100 s: outside the margin in which reading the session
    // refreshes it, inside the window in which the tick refreshes it.
    const t = await setup({ storedSession: makeSession('user-a', 'a', 100) })
    t.setRefreshReply(Promise.resolve(json(200, makeSession('user-a', 'a-renewed'))))

    const reads = t.storage.holdReads()
    await t.client.startAutoRefresh()
    await settle()
    reads.stopHolding()
    await signInAsB(t.client)
    reads.release()
    await settle()
    await t.client.stopAutoRefresh()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(t.events).not.toContain('TOKEN_REFRESHED')
  })

  test('refreshSession() does not overwrite a session saved while its read was open', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a') })
    t.setRefreshReply(Promise.resolve(json(200, makeSession('user-a', 'a-renewed'))))

    const reads = t.storage.holdReads()
    const refreshing = t.client.refreshSession()
    await settle()
    reads.stopHolding()
    await signInAsB(t.client)
    reads.release()
    await refreshing
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(t.events).not.toContain('TOKEN_REFRESHED')
  })

  test('with a custom lock, an auto-refresh tick does not overwrite a session saved while its read was open', async () => {
    // A lock that does not exclude anything, so the sign-in can run while the
    // tick holds it. This covers the tick's legacy-lock branch; a real lock
    // would queue the sign-in behind the tick instead.
    const passThroughLock: LockFunc = async (_name, _acquireTimeout, fn) => await fn()
    const t = await setup({ storedSession: makeSession('user-a', 'a', 100), lock: passThroughLock })
    t.setRefreshReply(Promise.resolve(json(200, makeSession('user-a', 'a-renewed'))))

    const reads = t.storage.holdReads()
    await t.client.startAutoRefresh()
    await settle()
    reads.stopHolding()
    await signInAsB(t.client)
    reads.release()
    await settle()
    await t.client.stopAutoRefresh()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(t.events).not.toContain('TOKEN_REFRESHED')
  })

  test('start-up recovery does not overwrite a session saved while its read was open', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a', 60) })
    t.setRefreshReply(Promise.resolve(json(200, makeSession('user-a', 'a-renewed'))))
    // Recovery only refreshes with auto refresh on, the default. `setup`
    // turns it off so initialization doesn't refresh on its own.
    // @ts-expect-error access protected for test
    t.client.autoRefreshToken = true

    const reads = t.storage.holdReads()
    // @ts-expect-error access private for test
    const recovering: Promise<void> = t.client._recoverAndRefresh()
    await settle()
    reads.stopHolding()
    await signInAsB(t.client)
    reads.release()
    await recovering
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(t.events).not.toContain('TOKEN_REFRESHED')
    expect(t.fetch).toHaveBeenCalledWith(expect.stringContaining(REFRESH_GRANT), expect.anything())
  })
})
