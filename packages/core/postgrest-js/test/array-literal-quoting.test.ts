import { PostgrestClient } from '../src/index'

const REST_URL = 'http://localhost:3000'

const captureUrl = () => {
  let captured = ''
  const fetchMock = jest.fn(async (url: string) => {
    captured = url
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: async () => '[]',
    } as any
  })

  const client = new PostgrestClient(REST_URL, { fetch: fetchMock as any })

  // URLSearchParams encodes a space as '+', which decodeURIComponent leaves alone.
  return {
    client,
    filter: () => decodeURIComponent((captured.split('?')[1] ?? '').replace(/\+/g, '%20')),
  }
}

/**
 * A `{...}` filter value is a Postgres array literal. An element carrying a
 * comma is read as two elements, an element carrying a brace makes the whole
 * literal malformed (`22P02`), and surrounding whitespace is trimmed off.
 */
describe('array literal elements are quoted when needed', () => {
  test('contains() quotes an element holding a comma', async () => {
    const { client, filter } = captureUrl()

    await client.from('marks').select().contains('tags', ['a,b'])

    expect(filter()).toBe('select=*&tags=cs.{"a,b"}')
  })

  test('containedBy() quotes an element holding a comma', async () => {
    const { client, filter } = captureUrl()

    await client.from('marks').select().containedBy('tags', ['a,b'])

    expect(filter()).toBe('select=*&tags=cd.{"a,b"}')
  })

  test('overlaps() quotes an element holding a comma', async () => {
    const { client, filter } = captureUrl()

    await client.from('marks').select().overlaps('tags', ['a,b'])

    expect(filter()).toBe('select=*&tags=ov.{"a,b"}')
  })

  test('likeAllOf() quotes a pattern holding a comma', async () => {
    const { client, filter } = captureUrl()

    await client.from('marks').select().likeAllOf('name', ['%x,y%'])

    expect(filter()).toBe('select=*&name=like(all).{"%x,y%"}')
  })

  test('ilikeAnyOf() quotes a pattern holding a comma', async () => {
    const { client, filter } = captureUrl()

    await client.from('marks').select().ilikeAnyOf('name', ['%x,y%'])

    expect(filter()).toBe('select=*&name=ilike(any).{"%x,y%"}')
  })

  test('quotes braces, which otherwise make the literal malformed', async () => {
    const { client, filter } = captureUrl()

    await client.from('marks').select().contains('tags', ['a{b'])

    expect(filter()).toBe('select=*&tags=cs.{"a{b"}')
  })

  test('escapes quotes and backslashes inside a quoted element', async () => {
    const { client, filter } = captureUrl()

    await client.from('marks').select().contains('tags', ['a"b\\c,d'])

    expect(filter()).toBe('select=*&tags=cs.{"a\\"b\\\\c,d"}')
  })

  test('quotes an element whose whitespace would otherwise be trimmed', async () => {
    const { client, filter } = captureUrl()

    await client.from('marks').select().contains('tags', [' padded '])

    expect(filter()).toBe('select=*&tags=cs.{" padded "}')
  })

  test('quotes the empty string so it is not dropped', async () => {
    const { client, filter } = captureUrl()

    await client.from('marks').select().contains('tags', [''])

    expect(filter()).toBe('select=*&tags=cs.{""}')
  })

  test('leaves an element that needs no quoting untouched', async () => {
    const { client, filter } = captureUrl()

    await client.from('marks').select().contains('tags', ['plain', 'also-plain'])

    expect(filter()).toBe('select=*&tags=cs.{plain,also-plain}')
  })

  test('leaves non-strings bare so null stays SQL NULL', async () => {
    const { client, filter } = captureUrl()

    await client.from('marks').select().contains('ids', [1, true, null])

    expect(filter()).toBe('select=*&ids=cs.{1,true,null}')
  })

  test('does not touch the range and json forms', async () => {
    const range = captureUrl()
    await range.client.from('marks').select().contains('period', '[2000-01-01,2000-01-02)')
    expect(range.filter()).toBe('select=*&period=cs.[2000-01-01,2000-01-02)')

    const json = captureUrl()
    await json.client.from('marks').select().contains('meta', { a: 'x,y' })
    expect(json.filter()).toBe('select=*&meta=cs.{"a":"x,y"}')
  })
})
