import { PostgrestClient } from '../src/index'

const REST_URL = 'http://localhost:3000'

/**
 * Build a client whose fetch records the request URL instead of hitting a
 * server, so we can assert exactly how `.in()` / `.notIn()` serialize values.
 */
function clientCapturingUrl(): { postgrest: PostgrestClient; getUrl: () => string } {
  let captured = ''
  const fetchMock: typeof fetch = (input: RequestInfo | URL) => {
    captured = typeof input === 'string' ? input : input.toString()
    return Promise.resolve(new Response('[]', { status: 200 }))
  }
  const postgrest = new PostgrestClient(REST_URL, { fetch: fetchMock })
  return { postgrest, getUrl: () => captured }
}

/** Decode the value of a query parameter from a raw (percent-encoded) URL. */
function paramValue(rawUrl: string, key: string): string {
  const query = rawUrl.split('?')[1] ?? ''
  for (const pair of query.split('&')) {
    const eq = pair.indexOf('=')
    // URLSearchParams encodes spaces as '+', which decodeURIComponent leaves as-is.
    const decode = (s: string) => decodeURIComponent(s.replace(/\+/g, ' '))
    const k = decode(pair.slice(0, eq))
    if (k === key) return decode(pair.slice(eq + 1))
  }
  throw new Error(`param ${key} not found in ${rawUrl}`)
}

describe('in() / notIn() reserved-character escaping', () => {
  test('quotes values containing reserved characters', async () => {
    const { postgrest, getUrl } = clientCapturingUrl()
    await postgrest.from('t').select().in('name', ['a,b', 'plain'])
    expect(paramValue(getUrl(), 'name')).toBe('in.("a,b",plain)')
  })

  test('escapes an embedded double quote inside a quoted value', async () => {
    const { postgrest, getUrl } = clientCapturingUrl()
    // Value has both a reserved char (comma) and a double quote.
    await postgrest.from('t').select().in('name', ['a"b,c'])
    // The inner quote must be backslash-escaped so the quoted value stays intact.
    expect(paramValue(getUrl(), 'name')).toBe('in.("a\\"b,c")')
  })

  test('escapes a value that contains only a double quote', async () => {
    const { postgrest, getUrl } = clientCapturingUrl()
    await postgrest.from('t').select().in('name', ['say "hi"'])
    expect(paramValue(getUrl(), 'name')).toBe('in.("say \\"hi\\"")')
  })

  test('escapes backslashes inside a quoted value', async () => {
    const { postgrest, getUrl } = clientCapturingUrl()
    await postgrest.from('t').select().in('path', ['a\\b,c'])
    // Backslash doubled, then wrapped in quotes.
    expect(paramValue(getUrl(), 'path')).toBe('in.("a\\\\b,c")')
  })

  test('leaves simple values unquoted', async () => {
    const { postgrest, getUrl } = clientCapturingUrl()
    await postgrest.from('t').select().in('status', ['ONLINE', 'OFFLINE'])
    expect(paramValue(getUrl(), 'status')).toBe('in.(ONLINE,OFFLINE)')
  })

  test('notIn() escapes the same way as in()', async () => {
    const { postgrest, getUrl } = clientCapturingUrl()
    await postgrest.from('t').select().notIn('name', ['a"b,c'])
    expect(paramValue(getUrl(), 'name')).toBe('not.in.("a\\"b,c")')
  })
})
