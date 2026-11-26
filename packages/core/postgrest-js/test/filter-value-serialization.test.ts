import { PostgrestClient } from '../src/index'

const REST_URL = 'http://localhost:3000'

function setup() {
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    text: async () => '[]',
  })
  const client = new PostgrestClient(REST_URL, { fetch: mockFetch as any })
  const lastQuery = () => {
    const [url] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1] as [URL | string]
    return new URL(url.toString()).searchParams
  }
  return { client, lastQuery }
}

describe('eq, neq and match serialize array and object values', () => {
  test('eq sends an array as an array literal', async () => {
    const { client, lastQuery } = setup()
    await client.from('docs').select().eq('tags', ['a', 'b'])
    expect(lastQuery().get('tags')).toBe('eq.{"a","b"}')
  })

  test('neq sends an object as JSON', async () => {
    const { client, lastQuery } = setup()
    await client.from('docs').select().neq('meta', { plan: 'pro' })
    expect(lastQuery().get('meta')).toBe('neq.{"plan":"pro"}')
  })

  test('match sends arrays and objects the same way', async () => {
    const { client, lastQuery } = setup()
    await client
      .from('docs')
      .select()
      .match({ tags: ['a', 'b'], meta: { plan: 'pro' } })
    expect(lastQuery().get('tags')).toBe('eq.{"a","b"}')
    expect(lastQuery().get('meta')).toBe('eq.{"plan":"pro"}')
  })

  test('array elements are quoted and escaped', async () => {
    const { client, lastQuery } = setup()
    await client
      .from('docs')
      .select()
      .eq('tags', ['a,b', 'say "hi"', 'back\\slash', null, 1, true, ['x']])
    expect(lastQuery().get('tags')).toBe(
      'eq.{"a,b","say \\"hi\\"","back\\\\slash",NULL,1,true,{"x"}}'
    )
  })

  test('an empty array is sent as an empty array literal', async () => {
    const { client, lastQuery } = setup()
    await client.from('docs').select().eq('tags', [])
    expect(lastQuery().get('tags')).toBe('eq.{}')
  })

  test('scalar values are sent unchanged', async () => {
    const { client, lastQuery } = setup()
    await client.from('docs').select().eq('name', 'Leia').neq('id', 1).match({ active: true })
    expect(lastQuery().get('name')).toBe('eq.Leia')
    expect(lastQuery().get('id')).toBe('neq.1')
    expect(lastQuery().get('active')).toBe('eq.true')
  })

  test('class instances still use their own toString', async () => {
    class Decimal {
      constructor(private readonly v: string) {}
      toString() {
        return this.v
      }
      toJSON() {
        return this.v
      }
    }
    const { client, lastQuery } = setup()
    await client.from('docs').select().eq('price', new Decimal('1.50'))
    expect(lastQuery().get('price')).toBe('eq.1.50')
  })
})
