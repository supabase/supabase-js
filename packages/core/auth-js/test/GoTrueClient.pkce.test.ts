import GoTrueClient from '../src/GoTrueClient'
import { PKCE_FLOW_ID_PARAM } from '../src/lib/constants'
import { getItemAsync } from '../src/lib/helpers'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'

const AUTH_URL = 'https://project-ref.supabase.example/auth/v1'

function makePkceClient(options?: {
  store?: { [key: string]: string }
  appendPkceFlowIdToRedirects?: boolean
}) {
  const store = options?.store ?? {}
  const storage = memoryLocalStorageAdapter(store)
  const requestUrls: string[] = []
  const tokenBodies: Array<{ [key: string]: string }> = []

  // network-free synthetic fetch: records requests, answers every call with
  // invalid_grant so no session construction is needed
  const syntheticFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrls.push(String(input))
    if (String(input).includes('/token?grant_type=pkce')) {
      tokenBodies.push(JSON.parse(String(init?.body)))
    }
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

function slotKeys(store: { [key: string]: string }, storageKey: string) {
  return Object.keys(store).filter(
    (key) =>
      key.startsWith(`${storageKey}-code-verifier-`) && key !== `${storageKey}-code-verifier-flows`
  )
}

function flowIdFromOAuthUrl(url: string): string {
  const redirectTo = new URL(url).searchParams.get('redirect_to')
  expect(redirectTo).not.toBeNull()
  const flowId = new URL(redirectTo!).searchParams.get(PKCE_FLOW_ID_PARAM)
  expect(flowId).not.toBeNull()
  return flowId!
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

    const firstVerifier = await getItemAsync(storage, `${storageKey}-code-verifier-${firstFlowId}`)
    const secondVerifier = await getItemAsync(
      storage,
      `${storageKey}-code-verifier-${secondFlowId}`
    )

    // first flow's callback arrives after the second start overwrote the fixed key
    await client.exchangeCodeForSession('code-from-first-flow', { flowId: firstFlowId })

    expect(tokenBodies).toHaveLength(1)
    expect(tokenBodies[0].code_verifier).toEqual(firstVerifier)
    expect(tokenBodies[0].code_verifier).not.toEqual(secondVerifier)

    // only the first flow's slot is cleaned up; the second flow stays pending
    expect(slotKeys(store, storageKey)).toEqual([`${storageKey}-code-verifier-${secondFlowId}`])
    expect(await getItemAsync(storage, `${storageKey}-code-verifier`)).toEqual(secondVerifier)

    await client.exchangeCodeForSession('code-from-second-flow', { flowId: secondFlowId })

    expect(tokenBodies).toHaveLength(2)
    expect(tokenBodies[1].code_verifier).toEqual(secondVerifier)
    expect(slotKeys(store, storageKey)).toHaveLength(0)
    expect(await getItemAsync(storage, `${storageKey}-code-verifier`)).toBeNull()
  })

  it('does not append the flow id parameter without the experimental flag', async () => {
    const { client } = makePkceClient()

    const { data } = await client.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'https://app.example.test/auth/callback',
        skipBrowserRedirect: true,
      },
    })

    const redirectTo = new URL(data.url!).searchParams.get('redirect_to')
    expect(redirectTo).toEqual('https://app.example.test/auth/callback')
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

    const storedVerifier = (await getItemAsync(
      storage,
      `${storageKey}-code-verifier-${flowId}`
    )) as string
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
})
