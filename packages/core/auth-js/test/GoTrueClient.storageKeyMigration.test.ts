import GoTrueClient from '../src/GoTrueClient'
import { PKCE_FLOW_ID_PARAM } from '../src/lib/constants'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'
import { pkceVerifierSlotKey } from '../src/lib/helpers'

const AUTH_URL = 'https://project-ref.supabase.example/auth/v1'
const NEW_KEY = 'sb-0badf00d-auth-token'
const LEGACY_KEY = 'sb-project-ref-auth-token'
const FLOW_ID = 'abcdef1234567890abcdef1234567890'

const createStoredSession = (suffix = '') => ({
  access_token: `access-token${suffix}`,
  refresh_token: `refresh-token${suffix}`,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: `user-id${suffix}`,
    aud: 'authenticated',
    role: 'authenticated',
    email: `user${suffix}@example.com`,
    app_metadata: {},
    user_metadata: {},
    created_at: new Date(0).toISOString(),
  },
})

const createClient = (
  store: { [key: string]: string },
  overrides: Partial<ConstructorParameters<typeof GoTrueClient>[0]> = {}
) =>
  new GoTrueClient({
    url: AUTH_URL,
    storageKey: NEW_KEY,
    legacyStorageKeys: [LEGACY_KEY],
    storage: memoryLocalStorageAdapter(store),
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: true,
    fetch: jest.fn().mockRejectedValue(new Error('network should not be used')),
    ...overrides,
  })

describe('GoTrueClient legacy storage key migration', () => {
  test('moves a session stored under a legacy key to the current key', async () => {
    const session = createStoredSession()
    const store: { [key: string]: string } = {
      [LEGACY_KEY]: JSON.stringify(session),
    }
    const client = createClient(store)

    await client.initialize()
    const { data, error } = await client.getSession()

    expect(error).toBeNull()
    expect(data.session?.access_token).toBe(session.access_token)
    expect(data.session?.user.id).toBe(session.user.id)
    expect(JSON.parse(store[NEW_KEY])).toMatchObject({ refresh_token: session.refresh_token })
    expect(store[LEGACY_KEY]).toBeUndefined()
  })

  test('moves the separate -user entry alongside the session', async () => {
    const session = createStoredSession()
    const { user, ...tokens } = session
    const store: { [key: string]: string } = {
      [LEGACY_KEY]: JSON.stringify(tokens),
    }
    const userStore: { [key: string]: string } = {
      [`${LEGACY_KEY}-user`]: JSON.stringify({ user }),
    }
    const client = createClient(store, { userStorage: memoryLocalStorageAdapter(userStore) })

    await client.initialize()
    const { data } = await client.getSession()

    expect(data.session?.user.id).toBe(user.id)
    expect(JSON.parse(userStore[`${NEW_KEY}-user`])).toEqual({ user })
    expect(userStore[`${LEGACY_KEY}-user`]).toBeUndefined()
    expect(store[LEGACY_KEY]).toBeUndefined()
  })

  test('keeps the current session and discards the legacy one when both exist', async () => {
    const current = createStoredSession('-current')
    const legacy = createStoredSession('-legacy')
    const store: { [key: string]: string } = {
      [NEW_KEY]: JSON.stringify(current),
      [LEGACY_KEY]: JSON.stringify(legacy),
      [`${LEGACY_KEY}-code-verifier`]: JSON.stringify('legacy-verifier'),
    }
    const client = createClient(store)

    await client.initialize()
    const { data } = await client.getSession()

    expect(data.session?.refresh_token).toBe(current.refresh_token)
    expect(store[LEGACY_KEY]).toBeUndefined()
    expect(store[`${LEGACY_KEY}-code-verifier`]).toBeUndefined()
    expect(store[`${NEW_KEY}-code-verifier`]).toBeUndefined()
  })

  test('moves pending PKCE verifiers so a flow started under the legacy key completes', async () => {
    const store: { [key: string]: string } = {
      [LEGACY_KEY]: JSON.stringify(createStoredSession()),
      // Values are JSON-encoded, exactly as `setItemAsync` writes them.
      [pkceVerifierSlotKey(LEGACY_KEY, FLOW_ID)]: JSON.stringify('slot-verifier'),
      [`${LEGACY_KEY}-flows-code-verifier`]: JSON.stringify([FLOW_ID]),
      [`${LEGACY_KEY}-code-verifier`]: JSON.stringify('slot-verifier'),
    }
    const client = createClient(store)

    await client.initialize()

    expect(JSON.parse(store[pkceVerifierSlotKey(NEW_KEY, FLOW_ID)])).toBe('slot-verifier')
    expect(JSON.parse(store[`${NEW_KEY}-flows-code-verifier`])).toEqual([FLOW_ID])
    expect(JSON.parse(store[`${NEW_KEY}-code-verifier`])).toBe('slot-verifier')
    expect(store[pkceVerifierSlotKey(LEGACY_KEY, FLOW_ID)]).toBeUndefined()
    expect(store[`${LEGACY_KEY}-flows-code-verifier`]).toBeUndefined()
    expect(store[`${LEGACY_KEY}-code-verifier`]).toBeUndefined()

    // The callback detector reads slots under the current key.
    await expect(
      (client as any)._isPKCECallback({ code: 'auth-code', [PKCE_FLOW_ID_PARAM]: FLOW_ID })
    ).resolves.toBe(true)
  })

  test('removes a malformed legacy value without copying it', async () => {
    const store: { [key: string]: string } = {
      [LEGACY_KEY]: JSON.stringify({ not: 'a session' }),
    }
    const client = createClient(store)

    await client.initialize()
    const { data } = await client.getSession()

    expect(data.session).toBeNull()
    expect(store[NEW_KEY]).toBeUndefined()
    expect(store[LEGACY_KEY]).toBeUndefined()
  })

  test('does not touch storage when persistSession is false', async () => {
    const store: { [key: string]: string } = {
      [LEGACY_KEY]: JSON.stringify(createStoredSession()),
    }
    const client = createClient(store, { persistSession: false })

    await client.initialize()

    expect(store[LEGACY_KEY]).toBeDefined()
    expect(store[NEW_KEY]).toBeUndefined()
  })

  test('does not read storage when no legacy keys are configured', async () => {
    const storage = memoryLocalStorageAdapter({})
    const getItem = jest.spyOn(storage, 'getItem')
    const client = createClient({}, { storage, legacyStorageKeys: [] })

    await client.initialize()

    expect(getItem.mock.calls.map(([key]) => key)).not.toContain(LEGACY_KEY)
  })

  test('ignores a legacy key equal to the current key', async () => {
    const client = createClient({}, { legacyStorageKeys: [NEW_KEY] })
    expect((client as any).legacyStorageKeys).toEqual([])
  })
})
