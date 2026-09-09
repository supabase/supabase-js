import { PostgrestClient } from '../src/index'
import { Database } from './types.override'

const REST_URL = 'http://localhost:54321/rest/v1'
const API_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'

const postgrest = new PostgrestClient<Database>(REST_URL, {
  headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` },
})

/**
 * E2E tests for rpc() request construction when args contain objects.
 *
 * Objects/arrays-of-objects can't be serialized to URL params, so rpc() must
 * fall back to POST + JSON body. The `_hasObjectArg` guard previously only
 * checked `head`, not `get` — so `get: true` with an object arg silently
 * serialized the object as `[object Object]` in the URL.
 *
 * The first two tests use a mock fetch to inspect the wire (method/body/headers)
 * because the test DB has no function that accepts a jsonb arg. The third test
 * hits the real server to confirm the primitive-arg path is unchanged.
 */

describe('E2E: rpc() with get:true and object args', () => {
  test('get:true with object arg sends POST (not [object Object] in URL)', async () => {
    const captured: { method?: string; url: string; body?: string } = { url: '' }
    const spyFetch = jest.fn().mockImplementation((url: string, init: any) => {
      captured.url = url
      captured.method = init?.method
      captured.body = init?.body
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('"ok"'),
      })
    })
    const client = new PostgrestClient<Database>(REST_URL, {
      headers: { apikey: API_KEY },
      fetch: spyFetch as any,
    })

    await (client as any).rpc('echo_json', { data: { key: 'value' } }, { get: true })

    // Must be POST (not GET), body must be JSON (not [object Object] in URL)
    expect(captured.method).toBe('POST')
    expect(captured.url).not.toContain('[object')
    expect(captured.body).toContain('"key"')
    // get:true wants data back → must NOT set return=minimal
    const init = spyFetch.mock.calls[0][1]
    const headers = init.headers
    const prefer = headers['Prefer'] ?? headers['prefer']
    expect(prefer).toBeUndefined()
  })

  test('head:true with object arg still uses POST + return=minimal (unchanged)', async () => {
    const captured: { method?: string; body?: string } = {}
    const spyFetch = jest.fn().mockImplementation((_url: string, init: any) => {
      captured.method = init?.method
      captured.body = init?.body
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(''),
      })
    })
    const client = new PostgrestClient<Database>(REST_URL, {
      headers: { apikey: API_KEY },
      fetch: spyFetch as any,
    })

    await (client as any).rpc('echo_json', { data: { key: 'value' } }, { head: true })

    expect(captured.method).toBe('POST')
    expect(captured.body).toContain('"key"')
    const init = spyFetch.mock.calls[0][1]
    const prefer = init.headers['Prefer'] ?? init.headers['prefer']
    expect(prefer).toContain('return=minimal')
  })

  test('get:true with primitive args still uses GET (unchanged, real server)', async () => {
    const res = await postgrest.rpc('get_status', { name_param: 'supabot' }, { get: true })
    expect(res.error).toBeNull()
    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
  })
})
