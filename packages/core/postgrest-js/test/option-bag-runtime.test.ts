import PostgrestClient from '../src/PostgrestClient'

// No Docker: every request goes to an injected fetch. These pin the runtime facts the option-bag and select-argument
// types in test/types/common/25-distribution.test-d.ts are written against.
const BASE = 'https://example.com/rest/v1'

const setup = () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    text: async () => '[]',
  })
  const client = new PostgrestClient<any>(BASE, { fetch: fetchMock as any })
  const sent = () => {
    const [url, init] = fetchMock.mock.calls[0]
    return { url: new URL(url), method: init.method as string }
  }
  return { client, sent }
}

describe('a select string that may be undefined', () => {
  test.each([undefined, '*'])('select(%s) sends select=*', async (columns) => {
    const { client, sent } = setup()
    await client.from('users').select(columns as any)
    expect(sent().url.searchParams.get('select')).toBe('*')
  })

  test('a string is sent as given', async () => {
    const { client, sent } = setup()
    await client.from('users').select('s:status')
    expect(sent().url.searchParams.get('select')).toBe('s:status')
  })

  test('select(undefined) after a mutation sends select=*', async () => {
    const { client, sent } = setup()
    await client
      .from('users')
      .update({ status: 'OFFLINE' })
      .select(undefined as any)
    expect(sent().url.searchParams.get('select')).toBe('*')
  })
})

describe('referencedTable is only sent by the member that has it', () => {
  test.each([
    [{ referencedTable: 'channels' }, 'channels.or'],
    [{}, 'or'],
  ])('or(…, %j) sends %s', async (options, key) => {
    const { client, sent } = setup()
    await client.from('messages').select('id, channels(id)').or('id.eq.-1', options)
    expect(sent().url.searchParams.get(key)).toBe('(id.eq.-1)')
  })
})

describe('rpc method per option bag member', () => {
  test.each([
    [{ head: true, get: true }, 'HEAD'],
    [{ count: 'exact' }, 'POST'],
    [{ get: true }, 'GET'],
  ] as const)('rpc(…, %j) sends %s', async (options, method) => {
    const { client, sent } = setup()
    await client.rpc('ping', { n: 1 }, options as any)
    expect(sent().method).toBe(method)
  })
})

describe('foreignTable is the deprecated alias of referencedTable', () => {
  const query = (client: PostgrestClient<any>) => client.from('messages').select('id, channels(id)')

  test('order(…, { foreignTable }) orders the referenced table', async () => {
    const { client, sent } = setup()
    await query(client).order('slug', { foreignTable: 'channels' })
    expect(sent().url.searchParams.get('channels.order')).toBe('slug.asc')
  })

  test('limit(…, { foreignTable }) limits the referenced table', async () => {
    const { client, sent } = setup()
    await query(client).limit(1, { foreignTable: 'channels' })
    expect(sent().url.searchParams.get('channels.limit')).toBe('1')
    expect(sent().url.searchParams.has('limit')).toBe(false)
  })

  test('range(…, { foreignTable }) pages the referenced table', async () => {
    const { client, sent } = setup()
    await query(client).range(0, 1, { foreignTable: 'channels' })
    expect(sent().url.searchParams.get('channels.offset')).toBe('0')
    expect(sent().url.searchParams.get('channels.limit')).toBe('2')
  })

  test('or(…, { foreignTable }) filters the referenced table', async () => {
    const { client, sent } = setup()
    await query(client).or('id.eq.1,slug.eq.x', { foreignTable: 'channels' })
    expect(sent().url.searchParams.get('channels.or')).toBe('(id.eq.1,slug.eq.x)')
  })

  test('filter(…, { foreignTable }) filters the referenced table', async () => {
    const { client, sent } = setup()
    await query(client).filter('id', 'eq', 1, { foreignTable: 'channels' })
    expect(sent().url.searchParams.get('channels.id')).toBe('eq.1')
  })

  test('referencedTable wins when both are given', async () => {
    const { client, sent } = setup()
    await query(client)
      .order('id', { referencedTable: 'channels', foreignTable: 'other' })
      .limit(1, { referencedTable: 'channels', foreignTable: 'other' })
    const { searchParams } = sent().url
    expect(searchParams.get('channels.order')).toBe('id.asc')
    expect(searchParams.get('channels.limit')).toBe('1')
    expect(searchParams.has('other.order')).toBe(false)
    expect(searchParams.has('other.limit')).toBe(false)
  })

  test('an undefined referencedTable leaves it to foreignTable', async () => {
    const { client, sent } = setup()
    await query(client).limit(1, { referencedTable: undefined, foreignTable: 'channels' })
    expect(sent().url.searchParams.get('channels.limit')).toBe('1')
  })

  test('returns and overrideTypes leave the request alone', async () => {
    const { client, sent } = setup()
    await query(client).returns<{ id: number }[]>().overrideTypes<{ id: number }[]>()
    expect(sent().url.searchParams.get('select')).toBe('id,channels(id)')
  })
})
