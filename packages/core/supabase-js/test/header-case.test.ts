import { createClient } from '../src/index'
import { mergeHeaders } from '../src/lib/helpers'

// Header names are case-insensitive (RFC 9110), but an object spread only
// overrides on an exact key match, so two entries differing only in case both
// survive and `fetch` joins them into one comma-separated value.
describe('mergeHeaders', () => {
  test('a later source overrides an earlier one spelled differently', () => {
    expect(
      mergeHeaders({ Authorization: 'Bearer sdk' }, { authorization: 'Bearer caller' })
    ).toEqual({ authorization: 'Bearer caller' })
  })

  test('an unopposed name keeps its original spelling', () => {
    expect(mergeHeaders({ Authorization: 'Bearer sdk' }, { apikey: 'key' })).toEqual({
      Authorization: 'Bearer sdk',
      apikey: 'key',
    })
  })

  test('undefined sources are skipped', () => {
    expect(mergeHeaders(undefined, { apikey: 'key' }, undefined)).toEqual({ apikey: 'key' })
  })
})

describe('client headers reaching auth requests', () => {
  const capture = () => {
    const sent: Record<string, string>[] = []
    const fetch = (async (_url: string, init: RequestInit) => {
      sent.push(init.headers as Record<string, string>)
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    }) as unknown as typeof globalThis.fetch
    return { fetch, headerValue: (name: string) => new Headers(sent[0]).get(name) }
  }

  const clientWith = (headers: Record<string, string>, fetch: typeof globalThis.fetch) =>
    createClient('http://localhost:1', 'ANONKEY', {
      global: { headers, fetch },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

  test('a lowercase authorization in global.headers replaces the anon key header', async () => {
    const { fetch, headerValue } = capture()

    await clientWith({ authorization: 'Bearer caller' }, fetch).auth.resetPasswordForEmail(
      'user@example.com'
    )

    expect(headerValue('authorization')).toBe('Bearer caller')
  })

  test('a differently-cased x-client-info in global.headers replaces the default', async () => {
    const { fetch, headerValue } = capture()

    await clientWith({ 'x-client-info': 'my-app/1.0' }, fetch).auth.resetPasswordForEmail(
      'user@example.com'
    )

    expect(headerValue('x-client-info')).toBe('my-app/1.0')
  })
})
