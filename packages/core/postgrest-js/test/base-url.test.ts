import { PostgrestClient } from '../src/index'

const REST_URL = 'http://localhost:3000/rest/v1'

function okFetch(body = '[]') {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    text: async () => body,
  })
}

function requestUrl(mock: jest.Mock, call = 0): string {
  return String(mock.mock.calls[call][0])
}

// `new URL('http://localhost:3000').toString()` yields 'http://localhost:3000/', so a
// base URL ending in '/' is easy to produce. Joining it as-is gives '//users', which
// PostgREST answers with a 404.
describe('PostgrestClient base URL', () => {
  describe.each([
    ['without a trailing slash', REST_URL],
    ['with a trailing slash', `${REST_URL}/`],
    ['with repeated trailing slashes', `${REST_URL}//`],
  ])('%s', (_, baseUrl) => {
    test('from() requests the relation path', async () => {
      const fetch = okFetch()
      const client = new PostgrestClient(baseUrl, { fetch: fetch as any })

      await client.from('users').select()

      expect(requestUrl(fetch)).toBe(`${REST_URL}/users?select=*`)
    })

    test('rpc() requests the function path', async () => {
      const fetch = okFetch('null')
      const client = new PostgrestClient(baseUrl, { fetch: fetch as any })

      await client.rpc('fn')

      expect(requestUrl(fetch)).toBe(`${REST_URL}/rpc/fn`)
    })

    test('schema() keeps the normalized base URL', async () => {
      const fetch = okFetch()
      const client = new PostgrestClient(baseUrl, { fetch: fetch as any })

      await client.schema('personal').from('users').select()

      expect(requestUrl(fetch)).toBe(`${REST_URL}/users?select=*`)
    })

    test('getOpenApiSpec() requests the root path', async () => {
      const fetch = okFetch('{}')
      const client = new PostgrestClient(baseUrl, { fetch: fetch as any })

      await client.getOpenApiSpec()

      expect(requestUrl(fetch)).toBe(`${REST_URL}/`)
    })
  })

  test('a bare origin with a trailing slash requests the relation path', async () => {
    const fetch = okFetch()
    const client = new PostgrestClient(new URL('http://localhost:3000').toString(), {
      fetch: fetch as any,
    })

    await client.from('users').select()

    expect(requestUrl(fetch)).toBe('http://localhost:3000/users?select=*')
  })
})
