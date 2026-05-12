import { PostgrestClient } from '../src/index'

describe('PostgrestQueryBuilder', () => {
  test('removes whitespace from select columns while preserving quoted identifiers', async () => {
    const fetch = jest.fn().mockResolvedValue(
      new Response('[]', {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    )
    const postgrest = new PostgrestClient('https://example.supabase.co/rest/v1', {
      fetch: fetch as any,
    })

    await postgrest.from('users').select(' id,\n "column whitespace",\tname ')

    const requestUrl = new URL(fetch.mock.calls[0][0])
    expect(requestUrl.searchParams.get('select')).toBe('id,"column whitespace",name')
  })
})
