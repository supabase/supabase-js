import { PostgrestClient } from '../src/index'

const REST_URL = 'http://localhost:3000'

describe('rollback()', () => {
  test.each([
    'tx=commit,count=exact',
    'count=exact, tx=commit',
    'count=exact, tx=rollback',
    'tx=commit, count=exact, tx=rollback',
    'count=exact',
  ])(
    'replaces transaction preferences in %s while preserving other preferences',
    async (prefer) => {
      const mockFetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 }))
      const client = new PostgrestClient(REST_URL, {
        fetch: mockFetch,
        headers: { Prefer: prefer },
      })

      await client.from('users').update({ status: 'OFFLINE' }).eq('id', 1).rollback()

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      const preferences = new Headers(options.headers)
        .get('Prefer')
        ?.split(',')
        .map((value) => value.trim())
        .sort()

      expect(preferences).toEqual(['count=exact', 'tx=rollback'])
    }
  )

  test('requests a rollback when the client has no preferences', async () => {
    const mockFetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const client = new PostgrestClient(REST_URL, { fetch: mockFetch })

    await client.from('users').update({ status: 'OFFLINE' }).eq('id', 1).rollback()

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(new Headers(options.headers).get('Prefer')).toBe('tx=rollback')
  })

  test('requests a single rollback when called repeatedly', async () => {
    const mockFetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const client = new PostgrestClient(REST_URL, { fetch: mockFetch })

    await client.from('users').update({ status: 'OFFLINE' }).eq('id', 1).rollback().rollback()

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(new Headers(options.headers).get('Prefer')).toBe('tx=rollback')
  })

  test('preserves client transaction preferences for subsequent requests', async () => {
    const mockFetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const client = new PostgrestClient(REST_URL, {
      fetch: mockFetch,
      headers: { Prefer: 'tx=commit,count=exact' },
    })

    await client.from('users').update({ status: 'OFFLINE' }).eq('id', 1).rollback()
    await client.from('users').update({ status: 'ONLINE' }).eq('id', 1)

    const [, options] = mockFetch.mock.calls[1] as [string, RequestInit]
    expect(new Headers(options.headers).get('Prefer')).toBe('tx=commit,count=exact')
  })
})
