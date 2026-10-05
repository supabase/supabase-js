/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://localhost:9999/auth/callback"}
 */

import GoTrueClient from '../src/GoTrueClient'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'

const AUTH_URL = 'https://project-ref.supabase.example/auth/v1'
const FLOW_ID = 'abcdef1234567890abcdef1234567890'

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

function syntheticFetch(tokenBodies: Array<{ [key: string]: string }>, succeed: boolean) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('/token?grant_type=pkce')) {
      tokenBodies.push(JSON.parse(String(init?.body)))
      if (succeed) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({ ...SYNTHETIC_SESSION }),
        } as unknown as Response
      }
    }
    return {
      ok: false,
      status: 400,
      headers: new Headers(),
      json: () =>
        Promise.resolve({ error: 'invalid_grant', error_description: 'Synthetic response' }),
    } as unknown as Response
  }) as typeof fetch
}

function seedFlow(store: { [key: string]: string }, storageKey: string) {
  // a pending flow's slot, plus a legacy key overwritten by a later start
  store[`${storageKey}-flow-${FLOW_ID}-code-verifier`] = JSON.stringify('verifier-own-flow')
  store[`${storageKey}-flows-code-verifier`] = JSON.stringify([FLOW_ID])
  store[`${storageKey}-code-verifier`] = JSON.stringify('verifier-other-flow')
}

describe('PKCE flow id auto-detection in the browser', () => {
  it('exchangeCodeForSession reads sb_flow_id from the current URL', async () => {
    window.history.replaceState(null, '', `/auth/callback?code=some-code&sb_flow_id=${FLOW_ID}`)

    const store: { [key: string]: string } = {}
    const tokenBodies: Array<{ [key: string]: string }> = []
    const client = new GoTrueClient({
      url: AUTH_URL,
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      storage: memoryLocalStorageAdapter(store),
      flowType: 'pkce',
      fetch: syntheticFetch(tokenBodies, false),
    })
    // @ts-expect-error 'Allow access to protected storageKey'
    seedFlow(store, client.storageKey)

    await client.exchangeCodeForSession('some-code')

    expect(tokenBodies).toHaveLength(1)
    expect(tokenBodies[0].code_verifier).toEqual('verifier-own-flow')
  })

  it('detectSessionInUrl consumes the flow slot and scrubs sb_flow_id from the URL', async () => {
    window.history.replaceState(null, '', `/auth/callback?code=some-code&sb_flow_id=${FLOW_ID}`)

    const store: { [key: string]: string } = {}
    const tokenBodies: Array<{ [key: string]: string }> = []
    const preClient = new GoTrueClient({
      url: AUTH_URL,
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      storage: memoryLocalStorageAdapter(store),
      flowType: 'pkce',
      fetch: syntheticFetch(tokenBodies, true),
    })
    // @ts-expect-error 'Allow access to protected storageKey'
    const storageKey: string = preClient.storageKey
    seedFlow(store, storageKey)

    const client = new GoTrueClient({
      url: AUTH_URL,
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: true,
      storage: memoryLocalStorageAdapter(store),
      flowType: 'pkce',
      fetch: syntheticFetch(tokenBodies, true),
    })
    await client.initialize()

    expect(tokenBodies).toHaveLength(1)
    expect(tokenBodies[0].code_verifier).toEqual('verifier-own-flow')

    const { data } = await client.getSession()
    expect(data.session?.access_token).toEqual('synthetic-access-token')

    // the reserved parameter is scrubbed alongside the code
    expect(window.location.search).not.toContain('code=')
    expect(window.location.search).not.toContain('sb_flow_id=')

    // only this flow's slot was consumed
    expect(store[`${storageKey}-flow-${FLOW_ID}-code-verifier`]).toBeUndefined()
  })
})
