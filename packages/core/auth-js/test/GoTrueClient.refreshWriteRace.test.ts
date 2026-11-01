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

const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')

/** An unsigned access token whose `sub` claim is `userId`, as the client only decodes it. */
const accessToken = (userId: string, expiresAt: number, tag: string) =>
  [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({ sub: userId, exp: expiresAt, session_id: tag }),
    base64url('signature'),
  ].join('.')

const makeSession = (userId: string, tag: string, secondsLeft = 3600) => ({
  access_token: accessToken(userId, Math.floor(Date.now() / 1000) + secondsLeft, tag),
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
 * held `setItem` or `removeItem` has already written when it is made but
 * resolves later.
 * It can also fail writes, and apply held writes only when they are released,
 * after writes made later, as an adapter that does not keep call order would.
 */
function controllableStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  let readGate: Promise<void> | null = null
  let writeGate: Promise<void> | null = null
  let failWrites = false
  let applyHeldWritesLate = false

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
      const gate = writeGate ?? Promise.resolve()
      if (failWrites) {
        return gate.then(() => {
          throw new Error('storage write failed')
        })
      }
      if (writeGate && applyHeldWritesLate) {
        return gate.then(() => {
          store.set(key, value)
        })
      }
      store.set(key, value)
      return gate
    },
    removeItem: (key) => {
      store.delete(key)
      return writeGate ?? Promise.resolve()
    },
  }

  return {
    adapter,
    store,
    holdReads: () => hold((gate) => (readGate = gate)),
    holdWrites: ({ applyLate = false } = {}) => {
      applyHeldWritesLate = applyLate
      return hold((gate) => (writeGate = gate))
    },
    /** Writes made while set fail (after their hold, if held). */
    setFailWrites: (fail: boolean) => (failWrites = fail),
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
  userStorageIsStorage = false,
  lock,
}: {
  storedSession: ReturnType<typeof makeSession>
  withUserStorage?: boolean
  /** Use the session storage as `userStorage` too, as a localStorage setup does. */
  userStorageIsStorage?: boolean
  lock?: LockFunc
}) {
  const storage = controllableStorage()
  const userStorage = withUserStorage ? controllableStorage() : null

  // The next answer to a refresh-token request. Tests replace it with a
  // promise they resolve themselves when they need to hold the request open.
  let refreshReply: Promise<Response> = Promise.resolve(refusedRefresh())
  // Holds `/user` requests open while set.
  let userReplyGate: Promise<void> | null = null
  const fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).includes(PASSWORD_GRANT)) return json(200, makeSession('user-b', 'b'))
    if (String(url).includes(REFRESH_GRANT)) return refreshReply
    if (String(url).endsWith('/user')) {
      await userReplyGate
      // The user the bearer token belongs to.
      const bearer = new Headers(init?.headers).get('Authorization')!.replace('Bearer ', '')
      const { sub } = JSON.parse(Buffer.from(bearer.split('.')[1], 'base64url').toString())
      return json(200, makeSession(sub, 'user').user)
    }
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
    ...(userStorageIsStorage ? { userStorage: storage.adapter } : {}),
    ...(lock ? { lock } : {}),
    fetch,
  })

  const events: AuthChangeEvent[] = []
  // The user of each SIGNED_IN event (`null` for the not-available user).
  const signedInAs: (string | null)[] = []
  client.onAuthStateChange((event, session) => {
    events.push(event)
    if (event === 'SIGNED_IN') {
      const user = session?.user as any
      signedInAs.push(user?.__isUserNotAvailableProxy ? null : user?.id)
    }
  })
  await client.initialize()
  await settle()
  events.length = 0
  signedInAs.length = 0

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
    signedInAs,
    storedRefreshToken,
    holdUserReply: () => {
      let release!: () => void
      userReplyGate = new Promise<void>((resolve) => (release = resolve))
      return () => {
        userReplyGate = null
        release()
      }
    },
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

  test('a refused refresh does not delete a session whose save was still in progress', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a', -10) })

    const respond = t.holdRefreshReply()
    const loading = t.client.getSession()
    await settle()

    // B's save is still in progress when the refusal arrives, and the removal
    // is queued behind it.
    const writes = t.storage.holdWrites({ applyLate: true })
    const signingIn = signInAsB(t.client)
    await settle()
    writes.stopHolding()
    respond(refusedRefresh())
    await settle()
    writes.release()
    await signingIn
    await loading
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
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
    // B's save is queued behind the held write, so it finishes after it.
    const signingIn = signInAsB(t.client)
    await settle()
    writes.release()
    await signingIn

    await loading
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(JSON.parse(t.userStorage!.store.get(`${STORAGE_KEY}-user`)!).user.id).toBe('user-b')
    // B's save is queued after the refresh's, so both are announced, in order.
    expect(t.events).toEqual(['TOKEN_REFRESHED', 'SIGNED_IN'])
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

  // Each way a refresh starts from a session read from storage, with
  // `secondsLeft` chosen so that path refreshes it.
  const refreshStarts: [string, (client: GoTrueClient) => Promise<unknown>, number][] = [
    ['getSession()', (client) => client.getSession(), 60],
    ['refreshSession()', (client) => client.refreshSession(), 3600],
    [
      'the auto-refresh tick',
      async (client) => {
        await client.startAutoRefresh()
        await settle()
      },
      100,
    ],
    [
      'start-up recovery',
      (client) => {
        // @ts-expect-error access protected for test
        client.autoRefreshToken = true
        // @ts-expect-error access private for test
        return client._recoverAndRefresh()
      },
      60,
    ],
  ]

  test.each(refreshStarts)(
    'a refresh started by %s does not restore a session signed out while its read was open',
    async (_name, startRefresh, secondsLeft) => {
      const t = await setup({ storedSession: makeSession('user-a', 'a', secondsLeft) })
      // A fresh response for each refresh: signOut() may refresh on its own
      // before it signs out, which would use up a shared one.
      const renewA = () =>
        t.setRefreshReply(Promise.resolve(json(200, makeSession('user-a', 'a-renewed'))))
      renewA()

      const reads = t.storage.holdReads()
      const refreshing = startRefresh(t.client)
      await settle()
      reads.stopHolding()
      await t.client.signOut({ scope: 'local' })
      renewA()
      reads.release()
      await refreshing
      await settle()
      await t.client.stopAutoRefresh()

      expect(t.storedRefreshToken()).toBeNull()
    }
  )
  test('a sign-in whose save failed does not make a refresh drop its renewed tokens', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a', 60) })

    const respond = t.holdRefreshReply()
    const loading = t.client.getSession()
    await settle()

    t.storage.setFailWrites(true)
    const signIn = await t.client
      .signInWithPassword({ email: 'user-b@example.com', password: 'password' })
      .catch((error) => ({ error }))
    t.storage.setFailWrites(false)
    expect(signIn.error).toBeTruthy()

    respond(json(200, makeSession('user-a', 'a-renewed')))
    const { data, error } = await loading
    await settle()

    // The server has rotated `refresh-a`; keeping it would sign the user out
    // on the next refresh.
    expect(t.storedRefreshToken()).toBe('refresh-a-renewed')
    expect(error).toBeNull()
    expect(data.session?.refresh_token).toBe('refresh-a-renewed')
    expect(t.events).toContain('TOKEN_REFRESHED')
  })

  test.each([
    ['fails', false],
    ['succeeds', true],
  ])(
    'a refresh waits for a save still in progress, and acts on it once it %s',
    async (_outcome, saveSucceeds) => {
      const t = await setup({ storedSession: makeSession('user-a', 'a', 60) })

      const respond = t.holdRefreshReply()
      const loading = t.client.getSession()
      await settle()

      // B's save is still in progress when the renewal arrives.
      const writes = t.storage.holdWrites({ applyLate: true })
      t.storage.setFailWrites(!saveSucceeds)
      const signIn = t.client
        .signInWithPassword({ email: 'user-b@example.com', password: 'password' })
        .catch((error) => ({ error }))
      await settle()
      writes.stopHolding()
      t.storage.setFailWrites(false)
      respond(json(200, makeSession('user-a', 'a-renewed')))
      await settle()
      writes.release()

      const { error: signInError } = await signIn
      const { data } = await loading
      await settle()

      if (saveSucceeds) {
        expect(signInError).toBeNull()
        expect(t.storedRefreshToken()).toBe('refresh-b')
        expect(data.session?.user.id).toBe('user-b')
        expect(t.events).not.toContain('TOKEN_REFRESHED')
      } else {
        expect(signInError).toBeTruthy()
        expect(t.storedRefreshToken()).toBe('refresh-a-renewed')
        expect(data.session?.refresh_token).toBe('refresh-a-renewed')
        expect(t.events).toContain('TOKEN_REFRESHED')
      }
    }
  )

  test('with userStorage, a refresh user write applied late does not end up beside another session', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a', 60), withUserStorage: true })

    const respond = t.holdRefreshReply()
    const loading = t.client.getSession()
    await settle()

    // The refresh's user write is applied only after B's whole save, as an
    // adapter that does not keep call order can do.
    const writes = t.userStorage!.holdWrites({ applyLate: true })
    respond(json(200, makeSession('user-a', 'a-renewed')))
    await settle()
    writes.stopHolding()
    // B's save is queued behind the held write, so it finishes after it.
    const signingIn = signInAsB(t.client)
    await settle()
    writes.release()
    await signingIn
    await loading
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(JSON.parse(t.userStorage!.store.get(`${STORAGE_KEY}-user`)!).user.id).toBe('user-b')

    const { data } = await t.client.getSession()
    expect(data.session?.refresh_token).toBe('refresh-b')
    expect(data.session?.user.id).toBe('user-b')
  })

  test("with userStorage, getSession() does not return another session's user", async () => {
    // A pairing left by a write that bypassed the queue, e.g. one that took
    // longer than the wait, or another client sharing the storage.
    const t = await setup({ storedSession: makeSession('user-b', 'b'), withUserStorage: true })
    t.userStorage!.store.set(
      `${STORAGE_KEY}-user`,
      JSON.stringify({ user: makeSession('user-a', 'a').user })
    )

    const { data } = await t.client.getSession()

    expect(data.session?.refresh_token).toBe('refresh-b')
    expect((data.session?.user as any).__isUserNotAvailableProxy).toBe(true)
  })

  test("with userStorage, start-up recovery does not pair a session with another session's user", async () => {
    const t = await setup({ storedSession: makeSession('user-b', 'b'), withUserStorage: true })
    t.userStorage!.store.set(
      `${STORAGE_KEY}-user`,
      JSON.stringify({ user: makeSession('user-a', 'a').user })
    )
    const signedInAs: string[] = []
    t.client.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') signedInAs.push(session!.user.id)
    })
    await settle()
    signedInAs.length = 0

    // @ts-expect-error access private for test
    await t.client._recoverAndRefresh()
    await settle()

    // The kept user does not match the tokens, so recovery fetches the user
    // the tokens belong to and keeps that one instead.
    expect(signedInAs).toEqual(['user-b'])
    expect(JSON.parse(t.userStorage!.store.get(`${STORAGE_KEY}-user`)!).user.id).toBe('user-b')
  })
  // Start-up recovery writes to storage after reads and requests of its own.
  // A session saved meanwhile is newer, so recovery must neither overwrite it
  // nor announce the session it read.
  const recover = (client: GoTrueClient): Promise<void> =>
    // @ts-expect-error access private for test
    client._recoverAndRefresh()

  test('start-up recovery does not overwrite a session saved while it fetched the user', async () => {
    // The kept user belongs to another session, so recovery fetches the user.
    const t = await setup({ storedSession: makeSession('user-a', 'a'), withUserStorage: true })
    t.userStorage!.store.set(
      `${STORAGE_KEY}-user`,
      JSON.stringify({ user: makeSession('user-x', 'x').user })
    )

    const releaseUser = t.holdUserReply()
    const recovering = recover(t.client)
    await settle()
    await signInAsB(t.client)
    releaseUser()
    await recovering
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(JSON.parse(t.userStorage!.store.get(`${STORAGE_KEY}-user`)!).user.id).toBe('user-b')
    expect(t.signedInAs).toEqual(['user-b'])
  })

  test('start-up recovery does not move a user back over a session saved during its reads', async () => {
    // userStorage was turned off: the user is still under its own key.
    const sessionA = makeSession('user-a', 'a')
    const t = await setup({ storedSession: sessionA })
    const { user, ...withoutUser } = sessionA
    t.storage.store.set(STORAGE_KEY, JSON.stringify(withoutUser))
    t.storage.store.set(`${STORAGE_KEY}-user`, JSON.stringify({ user }))

    const reads = t.storage.holdReads()
    const recovering = recover(t.client)
    await settle()
    reads.stopHolding()
    await signInAsB(t.client)
    reads.release()
    await recovering
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(t.signedInAs).toEqual(['user-b'])
  })

  test('start-up recovery does not move a user back over a session saved during that move', async () => {
    const sessionA = makeSession('user-a', 'a')
    const t = await setup({ storedSession: sessionA })
    const { user, ...withoutUser } = sessionA
    t.storage.store.set(STORAGE_KEY, JSON.stringify(withoutUser))
    t.storage.store.set(`${STORAGE_KEY}-user`, JSON.stringify({ user }))

    // B signs in while recovery's first write (removing the user key) is
    // still in progress.
    const writes = t.storage.holdWrites()
    const recovering = recover(t.client)
    await settle()
    writes.stopHolding()
    // B's save is queued behind the held write, so it finishes after it.
    const signingIn = signInAsB(t.client)
    await settle()
    writes.release()
    await signingIn
    await recovering
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    // Recovery's move was queued first, so it lands and is announced first.
    expect(t.signedInAs).toEqual(['user-a', 'user-b'])
  })

  test('start-up recovery does not copy a user over the user of a session saved during its reads', async () => {
    // userStorage was turned on with the same storage: the user is still in
    // the session, so recovery copies it to its own key.
    const t = await setup({ storedSession: makeSession('user-a', 'a'), userStorageIsStorage: true })

    // Hold the session read, then the user read that follows it.
    const sessionRead = t.storage.holdReads()
    const recovering = recover(t.client)
    await settle()
    const userRead = t.storage.holdReads()
    sessionRead.release()
    await settle()
    userRead.stopHolding()
    await signInAsB(t.client)
    userRead.release()
    await recovering
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(JSON.parse(t.storage.store.get(`${STORAGE_KEY}-user`)!).user.id).toBe('user-b')
    expect(t.signedInAs).toEqual(['user-b'])
  })

  test('start-up recovery does not remove a session saved while it read an invalid one', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a') })
    t.storage.store.set(STORAGE_KEY, JSON.stringify({ access_token: 'broken' }))

    const reads = t.storage.holdReads()
    const recovering = recover(t.client)
    await settle()
    reads.stopHolding()
    await signInAsB(t.client)
    reads.release()
    await recovering
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(t.events).not.toContain('SIGNED_OUT')
  })

  test('start-up recovery does not announce a session replaced while it read it', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a') })

    const reads = t.storage.holdReads()
    const recovering = recover(t.client)
    await settle()
    reads.stopHolding()
    await signInAsB(t.client)
    reads.release()
    await recovering
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(t.signedInAs).toEqual(['user-b'])
  })

  // Adapters that do not apply writes in call order (e.g. one that encrypts
  // before writing): a write made later must still be the one left in
  // storage.
  test('a sign-out during a refresh save applied late is not undone by it', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a') })

    const respond = t.holdRefreshReply()
    const refreshing = t.client.refreshSession()
    await settle()
    const writes = t.storage.holdWrites({ applyLate: true })
    respond(json(200, makeSession('user-a', 'a-renewed')))
    await settle()
    writes.stopHolding()
    const signingOut = t.client.signOut({ scope: 'local' })
    await settle()
    writes.release()
    await signingOut
    await refreshing
    await settle()

    expect(t.storedRefreshToken()).toBeNull()
    const { data } = await t.client.getSession()
    expect(data.session).toBeNull()
  })

  test('a sign-in during a refresh save applied late is not undone by it', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a', 60) })

    const respond = t.holdRefreshReply()
    const loading = t.client.getSession()
    await settle()
    const writes = t.storage.holdWrites({ applyLate: true })
    respond(json(200, makeSession('user-a', 'a-renewed')))
    await settle()
    writes.stopHolding()
    const signingIn = signInAsB(t.client)
    await settle()
    writes.release()
    await signingIn
    await loading
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    const { data } = await t.client.getSession()
    expect(data.session?.user.id).toBe('user-b')
    expect(t.events).toEqual(['TOKEN_REFRESHED', 'SIGNED_IN'])
  })

  test('a refresh waits for a slow sign-in save, and keeps its renewed tokens when it fails', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a', 60) })
    t.setRefreshReply(Promise.resolve(json(200, makeSession('user-a', 'a-renewed'))))

    // B's save starts while the read that starts the refresh is open, is
    // slow, and then fails.
    const reads = t.storage.holdReads()
    const loading = t.client.getSession()
    await settle()
    reads.stopHolding()
    const writes = t.storage.holdWrites({ applyLate: true })
    t.storage.setFailWrites(true)
    const signIn = t.client
      .signInWithPassword({ email: 'user-b@example.com', password: 'password' })
      .catch((error) => ({ error }))
    await settle()
    writes.stopHolding()
    t.storage.setFailWrites(false)
    reads.release()
    setTimeout(() => writes.release(), 60)
    await loading
    await signIn
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-a-renewed')
    expect(t.events).toContain('TOKEN_REFRESHED')
  })

  test('getSession() does not remove a session saved while it read an invalid one', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a') })
    t.storage.store.set(STORAGE_KEY, JSON.stringify({ access_token: 'broken' }))

    const reads = t.storage.holdReads()
    const loading = t.client.getSession()
    await settle()
    reads.stopHolding()
    await signInAsB(t.client)
    reads.release()
    await loading
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(t.events).not.toContain('SIGNED_OUT')
  })

  test('getUser() does not remove a session saved while it checked one the server no longer knows', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a') })
    let answerUser!: (response: Response) => void
    t.fetch.mockImplementationOnce(
      async () => new Promise<Response>((resolve) => (answerUser = resolve))
    )

    const checking = t.client.getUser()
    await settle()
    await signInAsB(t.client)
    answerUser(json(403, { code: 403, error_code: 'session_not_found', msg: 'Session not found' }))
    const { error } = await checking
    await settle()

    expect(error).toBeTruthy()
    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(t.events).not.toContain('SIGNED_OUT')
  })

  test('start-up recovery does not remove a session saved while it checked the stored one', async () => {
    // No user kept for A, so recovery asks /user, and the server no longer
    // knows A.
    const t = await setup({ storedSession: makeSession('user-a', 'a'), withUserStorage: true })
    t.userStorage!.store.delete(`${STORAGE_KEY}-user`)
    let answerUser!: (response: Response) => void
    t.fetch.mockImplementationOnce(
      async () => new Promise<Response>((resolve) => (answerUser = resolve))
    )

    const recovering = recover(t.client)
    await settle()
    await signInAsB(t.client)
    answerUser(json(403, { code: 403, error_code: 'session_not_found', msg: 'Session not found' }))
    await recovering
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(t.events).not.toContain('SIGNED_OUT')
  })

  test('getUser() does not remove again after its refresh found the session gone', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a', -10) })
    t.setRefreshReply(
      Promise.resolve(
        json(403, { code: 403, error_code: 'session_not_found', msg: 'Session not found' })
      )
    )
    // B signs in as soon as A is signed out, while getUser() is still going.
    let signingIn: Promise<void> | null = null
    t.client.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && !signingIn) {
        signingIn = signInAsB(t.client)
      }
    })

    await t.client.getUser()
    await signingIn
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    expect(t.events.filter((event) => event === 'SIGNED_OUT')).toHaveLength(1)
  })

  test('a refresh does not overwrite a sign-in whose save is slow', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a', 60) })
    t.setRefreshReply(Promise.resolve(json(200, makeSession('user-a', 'a-renewed'))))

    // Storage that keeps call order; B's save starts while the read that
    // starts the refresh is open, and is slow.
    const reads = t.storage.holdReads()
    const loading = t.client.getSession()
    await settle()
    reads.stopHolding()
    const writes = t.storage.holdWrites()
    const signingIn = signInAsB(t.client)
    await settle()
    writes.stopHolding()
    reads.release()
    setTimeout(() => writes.release(), 60)
    await loading
    await signingIn
    await settle()

    expect(t.storedRefreshToken()).toBe('refresh-b')
    const { data } = await t.client.getSession()
    expect(data.session?.user.id).toBe('user-b')
  })

  test.each([
    ['sign-out', null, 'SIGNED_OUT'],
    ['sign-in', 'refresh-b', 'SIGNED_IN'],
  ])(
    'a %s made while a slow refresh save is applied late is not undone by it',
    async (action, expectedToken, expectedEvent) => {
      const t = await setup({ storedSession: makeSession('user-a', 'a') })

      const respond = t.holdRefreshReply()
      const refreshing = t.client.refreshSession()
      await settle()
      // The refresh's save is slow and applied late; the later write is
      // queued behind it.
      const writes = t.storage.holdWrites({ applyLate: true })
      respond(json(200, makeSession('user-a', 'a-renewed')))
      await settle()
      writes.stopHolding()
      const acting =
        action === 'sign-out' ? t.client.signOut({ scope: 'local' }) : signInAsB(t.client)
      setTimeout(() => writes.release(), 60)
      await acting
      await refreshing
      await settle()

      expect(t.storedRefreshToken()).toBe(expectedToken)
      expect(t.events).toEqual(['TOKEN_REFRESHED', expectedEvent])
    }
  )

  test('a session write that never finishes holds up the session writes after it', async () => {
    const t = await setup({ storedSession: makeSession('user-a', 'a') })

    const respond = t.holdRefreshReply()
    const refreshing = t.client.refreshSession()
    await settle()
    // The refresh's save never finishes. A sign-in after it must not land
    // first, or the refresh's save could still land over it.
    const writes = t.storage.holdWrites({ applyLate: true })
    respond(json(200, makeSession('user-a', 'a-renewed')))
    await settle()
    writes.stopHolding()
    let signedIn = false
    signInAsB(t.client).then(() => (signedIn = true))
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(signedIn).toBe(false)
    expect(t.storedRefreshToken()).toBe('refresh-a')
    void refreshing
  })
})
