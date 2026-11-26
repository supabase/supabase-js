import { PostgrestClient } from '../src/index'

const REST_URL = 'https://example.supabase.co/rest/v1'

test('eq/neq/match serialize arrays as Postgres literals and objects as JSON', async () => {
  const calls: string[] = []
  const fakeFetch = async (input: RequestInfo | URL) => {
    calls.push(String(input))
    return new Response('[]', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  const client = new PostgrestClient(REST_URL, { fetch: fakeFetch as any })

  await client.from('docs').select('id').eq('tags', ['a', 'b'])
  await client.from('docs').select('id').neq('meta', { plan: 'pro' })
  await client
    .from('docs')
    .select('id')
    .match({ tags: ['a', 'b'] })

  const queries = calls.map((u) => decodeURIComponent(new URL(u).search))
  expect(queries[0]).toContain('tags=eq.{"a","b"}')
  expect(queries[1]).toContain('meta=neq.{"plan":"pro"}')
  expect(queries[2]).toContain('tags=eq.{"a","b"}')
})

test('eq still stringifies scalar values', async () => {
  const calls: string[] = []
  const fakeFetch = async (input: RequestInfo | URL) => {
    calls.push(String(input))
    return new Response('[]', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  const client = new PostgrestClient(REST_URL, { fetch: fakeFetch as any })
  await client.from('docs').select('id').eq('name', 'Leia')
  expect(decodeURIComponent(new URL(calls[0]).search)).toContain('name=eq.Leia')
})
