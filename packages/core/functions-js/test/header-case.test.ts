import { FunctionsClient } from '../src/index'

// Header names are case-insensitive (RFC 9110), but an object spread only
// overrides on an exact key match. Two entries differing only in case both
// survive the merge, and `fetch` joins them into one comma-separated value —
// producing a malformed header rather than the documented override.
describe('header merging is case-insensitive', () => {
  const capture = () => {
    const inits: RequestInit[] = []
    const customFetch = (async (_url: string, init: RequestInit) => {
      inits.push(init)
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    }) as unknown as typeof globalThis.fetch
    return { customFetch, sentHeaders: () => inits[0].headers as Record<string, string> }
  }

  const headerValue = (headers: Record<string, string>, name: string) =>
    new Headers(headers).get(name)

  test('an invoke-level Content-Type overrides a differently-cased client one', async () => {
    const { customFetch, sentHeaders } = capture()
    const client = new FunctionsClient('http://localhost', {
      headers: { 'content-type': 'application/json' },
      customFetch,
    })

    await client.invoke('fn', { headers: { 'Content-Type': 'text/plain' }, body: 'payload' })

    expect(headerValue(sentHeaders(), 'content-type')).toBe('text/plain')
  })

  test('setAuth replaces a differently-cased authorization header', async () => {
    const { customFetch, sentHeaders } = capture()
    const client = new FunctionsClient('http://localhost', {
      headers: { authorization: 'Bearer stale' },
      customFetch,
    })

    client.setAuth('fresh')
    await client.invoke('fn', { body: 'payload' })

    // Without normalization both entries survive and fetch joins them into
    // `Bearer stale, Bearer fresh`, which no server accepts.
    expect(headerValue(sentHeaders(), 'authorization')).toBe('Bearer fresh')
  })

  test('an invoke-level header overrides a differently-cased client one', async () => {
    const { customFetch, sentHeaders } = capture()
    const client = new FunctionsClient('http://localhost', {
      headers: { 'X-Custom': 'client' },
      customFetch,
    })

    await client.invoke('fn', { headers: { 'x-custom': 'invoke' }, body: 'payload' })

    expect(headerValue(sentHeaders(), 'x-custom')).toBe('invoke')
  })
})
