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
