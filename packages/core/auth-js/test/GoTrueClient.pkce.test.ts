import GoTrueClient from '../src/GoTrueClient'
import { PKCE_FLOW_ID_PARAM } from '../src/lib/constants'
import { AuthPKCECodeVerifierMissingError } from '../src/lib/errors'
import { getItemAsync } from '../src/lib/helpers'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'
import type { SupportedStorage } from '../src/lib/types'

const AUTH_URL = 'https://project-ref.supabase.example/auth/v1'

const SYNTHETIC_SESSION = {
  access_token: 'synthetic-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'synthetic-refresh-token',
  user: {
    id: '11111111-1111-1111-1111-111111111111',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'user@example.test',
    app_metadata: {},
    user_metadata: {},
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
}

function makePkceClient(options?: {
  store?: { [key: string]: string }
  appendPkceFlowIdToRedirects?: boolean
  storage?: SupportedStorage
  exchangeSucceeds?: boolean
}) {
  const store = options?.store ?? {}
  const storage = options?.storage ?? memoryLocalStorageAdapter(store)
  const requestUrls: string[] = []
  const tokenBodies: Array<{ [key: string]: string }> = []

  // network-free synthetic fetch: records requests, succeeds on flow starts
  // (so verifiers stay stored) and, unless exchangeSucceeds is set, fails
  // token exchanges with invalid_grant so no session construction is needed
  const syntheticFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrls.push(String(input))
    if (String(input).includes('/token?grant_type=pkce')) {
      tokenBodies.push(JSON.parse(String(init?.body)))
      if (!options?.exchangeSucceeds) {
        return {
          ok: false,
          status: 400,
          headers: new Headers(),
          json: () =>
            Promise.resolve({
              error: 'invalid_grant',
              error_description: 'Synthetic response',
            }),
        } as unknown as Response
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ ...SYNTHETIC_SESSION }),
      } as unknown as Response
    }
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({}),
    } as unknown as Response
  }) as typeof fetch

  const client = new GoTrueClient({
    url: AUTH_URL,
    autoRefreshToken: false,
    persistSession: true,
    storage,
    flowType: 'pkce',
    fetch: syntheticFetch,
    experimental: options?.appendPkceFlowIdToRedirects
      ? { appendPkceFlowIdToRedirects: true }
      : undefined,
  })
  // @ts-expect-error 'Allow access to protected storageKey'
  const storageKey: string = client.storageKey
  return { client, storage, store, storageKey, requestUrls, tokenBodies }
}

function slotKey(storageKey: string, flowId: string) {
  return `${storageKey}-flow-${flowId}-code-verifier`
}

function slotKeys(store: { [key: string]: string }, storageKey: string) {
  return Object.keys(store).filter(
    (key) => key.startsWith(`${storageKey}-flow-`) && key !== `${storageKey}-flows-code-verifier`
  )
}

function flowIdFromOAuthUrl(url: string): string {
  const redirectTo = new URL(url).searchParams.get('redirect_to')
  expect(redirectTo).not.toBeNull()
  const flowId = new URL(redirectTo!).searchParams.get(PKCE_FLOW_ID_PARAM)
  expect(flowId).not.toBeNull()
  return flowId!
}

/**
 * Mimics the buffering behavior of @supabase/ssr's server cookie adapter:
 * writes are buffered in memory and only keys ending in `-code-verifier` are
 * persisted (flushed to `jar`) immediately; everything else waits for an auth
 * event, which never fires during a flow start.
 */
function ssrServerLikeStorage(jar: { [key: string]: string }): SupportedStorage {
  const setItems: { [key: string]: string } = {}
  const removedItems: { [key: string]: boolean } = {}
  return {
    getItem: async (key: string) => {
      if (typeof setItems[key] === 'string') return setItems[key]
      if (removedItems[key]) return null
      return jar[key] ?? null
    },
    setItem: async (key: string, value: string) => {
      if (key.endsWith('-code-verifier')) {
        jar[key] = value
      }
      setItems[key] = value
      delete removedItems[key]
    },
    removeItem: async (key: string) => {
      delete setItems[key]
      removedItems[key] = true
    },
  }
}

describe('overlapping PKCE flows', () => {
  it('two in-flight starts keep distinct verifiers in separate slots', async () => {
    const { client, storage, store, storageKey } = makePkceClient()

    await client.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'https://app.example.test/auth/callback?flow=first',
        skipBrowserRedirect: true,
      },
    })
    const firstLegacyValue = await getItemAsync(storage, `${storageKey}-code-verifier`)

    await client.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://app.example.test/auth/callback?flow=second',
        skipBrowserRedirect: true,
      },
    })
    const secondLegacyValue = await getItemAsync(storage, `${storageKey}-code-verifier`)

    const slots = slotKeys(store, storageKey)
    expect(slots).toHaveLength(2)
    expect(firstLegacyValue).not.toEqual(secondLegacyValue)

    const slotValues = await Promise.all(slots.map((key) => getItemAsync(storage, key)))
    expect(slotValues).toContain(firstLegacyValue)
    expect(slotValues).toContain(secondLegacyValue)
  })

  it('each callback exchanges its own verifier and cleans up only its slot', async () => {
    const { client, storage, store, storageKey, tokenBodies } = makePkceClient({
      appendPkceFlowIdToRedirects: true,
    })

    const { data: first } = await client.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'https://app.example.test/auth/callback?flow=first',
        skipBrowserRedirect: true,
      },
    })
    const { data: second } = await client.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://app.example.test/auth/callback?flow=second',
        skipBrowserRedirect: true,
      },
    })

    const firstFlowId = flowIdFromOAuthUrl(first.url!)
    const secondFlowId = flowIdFromOAuthUrl(second.url!)
    expect(firstFlowId).not.toEqual(secondFlowId)
    // the same flow id is returned directly on the response
    expect(first.flowId).toEqual(firstFlowId)
    expect(second.flowId).toEqual(secondFlowId)

    const firstVerifier = await getItemAsync(storage, slotKey(storageKey, firstFlowId))
    const secondVerifier = await getItemAsync(storage, slotKey(storageKey, secondFlowId))

    // first flow's callback arrives after the second start overwrote the fixed key
    await client.exchangeCodeForSession('code-from-first-flow', { flowId: firstFlowId })

    expect(tokenBodies).toHaveLength(1)
    expect(tokenBodies[0].code_verifier).toEqual(firstVerifier)
    expect(tokenBodies[0].code_verifier).not.toEqual(secondVerifier)

    // only the first flow's slot is cleaned up; the second flow stays pending
    expect(slotKeys(store, storageKey)).toEqual([slotKey(storageKey, secondFlowId)])
    expect(await getItemAsync(storage, `${storageKey}-code-verifier`)).toEqual(secondVerifier)

    await client.exchangeCodeForSession('code-from-second-flow', { flowId: secondFlowId })

    expect(tokenBodies).toHaveLength(2)
    expect(tokenBodies[1].code_verifier).toEqual(secondVerifier)
    expect(slotKeys(store, storageKey)).toHaveLength(0)
    expect(await getItemAsync(storage, `${storageKey}-code-verifier`)).toBeNull()
  })

  it('returns a usable flowId even without the experimental flag', async () => {
    const { client, storage, storageKey, tokenBodies } = makePkceClient()

    const { data: first } = await client.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'https://app.example.test/auth/callback',
        skipBrowserRedirect: true,
      },
    })
    // the redirect URL carries no flow id parameter without the flag
    const redirectTo = new URL(first.url!).searchParams.get('redirect_to')
    expect(redirectTo).toEqual('https://app.example.test/auth/callback')
    expect(first.flowId).toBeTruthy()

    // a second start overwrites the fixed key, but the app can still
    // self-correlate by carrying flowId through its own channel
    await client.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://app.example.test/auth/callback',
        skipBrowserRedirect: true,
      },
    })

    const firstVerifier = await getItemAsync(storage, slotKey(storageKey, first.flowId!))
    await client.exchangeCodeForSession('code-from-first-flow', { flowId: first.flowId! })

    expect(tokenBodies).toHaveLength(1)
    expect(tokenBodies[0].code_verifier).toEqual(firstVerifier)
  })

  it('fails fast when a flow id has no stored verifier instead of borrowing one', async () => {
    const { client, storage, store, storageKey, tokenBodies } = makePkceClient({
      appendPkceFlowIdToRedirects: true,
    })

    const { data } = await client.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'https://app.example.test/auth/callback',
        skipBrowserRedirect: true,
      },
    })

    const { error } = await client.exchangeCodeForSession('stale-code', {
      flowId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    // no request was made with another flow's verifier, and the pending
    // flow's slot and legacy fallback both survive
    expect(error).toBeInstanceOf(AuthPKCECodeVerifierMissingError)
    expect(tokenBodies).toHaveLength(0)
    expect(slotKeys(store, storageKey)).toEqual([slotKey(storageKey, data.flowId!)])
    expect(await getItemAsync(storage, `${storageKey}-code-verifier`)).not.toBeNull()
  })

  it('falls back to the fixed key when no flow id is available', async () => {
    const { client, storage, storageKey, tokenBodies } = makePkceClient()

    // simulate a flow started by an older SDK version: fixed key only
    await storage.setItem(`${storageKey}-code-verifier`, JSON.stringify('legacy-verifier'))

    await client.exchangeCodeForSession('some-code')

    expect(tokenBodies).toHaveLength(1)
    expect(tokenBodies[0].code_verifier).toEqual('legacy-verifier')
    expect(await getItemAsync(storage, `${storageKey}-code-verifier`)).toBeNull()
  })

  it('a successful exchange saves the session and consumes the slot', async () => {
    const { client, storage, store, storageKey } = makePkceClient({
      appendPkceFlowIdToRedirects: true,
      exchangeSucceeds: true,
    })

    const { data: start } = await client.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'https://app.example.test/auth/callback',
        skipBrowserRedirect: true,
      },
    })

    const { data, error } = await client.exchangeCodeForSession('good-code', {
      flowId: start.flowId!,
    })

    expect(error).toBeNull()
    expect(data.session?.access_token).toEqual('synthetic-access-token')
    const persisted = (await getItemAsync(storage, storageKey)) as { access_token?: string }
    expect(persisted?.access_token).toEqual('synthetic-access-token')
    expect(slotKeys(store, storageKey)).toHaveLength(0)
    expect(await getItemAsync(storage, `${storageKey}-code-verifier`)).toBeNull()
  })

  it('password recovery round-trips the flow id and keeps the /recovery marker', async () => {
    const { client, storage, storageKey, requestUrls, tokenBodies } = makePkceClient({
      appendPkceFlowIdToRedirects: true,
    })

    await client.resetPasswordForEmail('user@example.test', {
      redirectTo: 'https://app.example.test/auth/reset',
    })

    // the flow id travels on the redirect_to of the /recover request
    const recoverUrl = requestUrls.find((url) => url.includes('/recover'))!
    const redirectTo = new URL(recoverUrl).searchParams.get('redirect_to')
    const flowId = new URL(redirectTo!).searchParams.get(PKCE_FLOW_ID_PARAM)
    expect(flowId).not.toBeNull()

    const storedVerifier = (await getItemAsync(storage, slotKey(storageKey, flowId!))) as string
    expect(storedVerifier).toMatch(/\/recovery$/)

    await client.exchangeCodeForSession('recovery-code', { flowId: flowId! })

    expect(tokenBodies).toHaveLength(1)
    expect(tokenBodies[0].code_verifier).toEqual(storedVerifier.replace(/\/recovery$/, ''))
  })

  it('detects a PKCE callback from the flow id slot even when the fixed key is gone', async () => {
    const { client, storage, storageKey } = makePkceClient({
      appendPkceFlowIdToRedirects: true,
    })

    const { data } = await client.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'https://app.example.test/auth/callback',
        skipBrowserRedirect: true,
      },
    })
    const flowId = flowIdFromOAuthUrl(data.url!)

    // another flow's exchange (old SDK, or no flow id) consumed the fixed key
    await storage.removeItem(`${storageKey}-code-verifier`)

    // @ts-expect-error 'Allow access to private _isPKCECallback'
    expect(await client._isPKCECallback({ code: 'abc', [PKCE_FLOW_ID_PARAM]: flowId })).toBe(true)
    // @ts-expect-error 'Allow access to private _isPKCECallback'
    expect(await client._isPKCECallback({ code: 'abc' })).toBe(false)
  })

  it('bounds the number of stored verifier slots', async () => {
    const { client, store, storageKey } = makePkceClient()

    for (let i = 0; i < 7; i++) {
      await client.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: 'https://app.example.test/auth/callback',
          skipBrowserRedirect: true,
        },
      })
    }

    expect(slotKeys(store, storageKey)).toHaveLength(5)
  })

  it('signOut clears every pending verifier slot and the index', async () => {
    const { client, store, storageKey } = makePkceClient()

    await client.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'https://app.example.test/auth/callback',
        skipBrowserRedirect: true,
      },
    })
    await client.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://app.example.test/auth/callback',
        skipBrowserRedirect: true,
      },
    })
    expect(slotKeys(store, storageKey)).toHaveLength(2)

    await client.signOut()

    expect(slotKeys(store, storageKey)).toHaveLength(0)
    expect(store[`${storageKey}-flows-code-verifier`]).toBeUndefined()
    expect(store[`${storageKey}-code-verifier`]).toBeUndefined()
  })

  it('persists slots through an ssr-server-like buffered storage adapter', async () => {
    // server-initiated start: only immediately-flushed keys survive the
    // request, which is why every verifier-family key ends in -code-verifier
    const jar: { [key: string]: string } = {}
    const { client: startClient, storageKey } = makePkceClient({
      appendPkceFlowIdToRedirects: true,
      storage: ssrServerLikeStorage(jar),
    })

    const { data } = await startClient.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'https://app.example.test/auth/callback',
        skipBrowserRedirect: true,
      },
    })
    const flowId = data.flowId!

    expect(jar[slotKey(storageKey, flowId)]).toBeDefined()
    expect(jar[`${storageKey}-flows-code-verifier`]).toBeDefined()
    expect(jar[`${storageKey}-code-verifier`]).toBeDefined()

    // the callback arrives on a fresh server client that only has the cookies
    const { client: callbackClient, tokenBodies } = makePkceClient({
      storage: ssrServerLikeStorage(jar),
    })
    await callbackClient.exchangeCodeForSession('some-code', { flowId })

    expect(tokenBodies).toHaveLength(1)
    expect(tokenBodies[0].code_verifier).toEqual(JSON.parse(jar[slotKey(storageKey, flowId)]))
  })
})
