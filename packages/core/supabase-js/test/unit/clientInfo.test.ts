import { createClient } from '../../src/index'
import { DEFAULT_HEADERS } from '../../src/lib/constants'
import { applySettingDefaults } from '../../src/lib/helpers'

const URL = 'http://localhost:3000'
const KEY = 'some.fake.key'
const BASE = DEFAULT_HEADERS['X-Client-Info']

/** Records the headers of every request and answers with an empty JSON body. */
function stubFetch() {
  const calls: { url: string; headers: Headers }[] = []
  const fetch = jest.fn(async (input: any, init?: any) => {
    calls.push({ url: String(input?.url ?? input), headers: new Headers(init?.headers) })
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
  })
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls }
}

function resolveHeaders(global: Record<string, unknown>) {
  return applySettingDefaults({ global } as any, { global: { headers: DEFAULT_HEADERS } } as any)
    .global.headers!
}

describe('global.clientInfo', () => {
  describe('header value', () => {
    test('appends to the default value, in entry order', () => {
      const headers = resolveHeaders({
        clientInfo: { via: 'supabase-server/1.10.0', middleware: 'oauth-protected-resource' },
      })
      expect(headers['X-Client-Info']).toBe(
        `${BASE}; via=supabase-server/1.10.0; middleware=oauth-protected-resource`
      )
    })

    test('keeps the order the entries were given in', () => {
      const headers = resolveHeaders({ clientInfo: { middleware: 'm', via: 'v/1' } })
      expect(headers['X-Client-Info']).toBe(`${BASE}; middleware=m; via=v/1`)
    })

    test.each(['X-Client-Info', 'x-client-info', 'X-CLIENT-INFO'])(
      'appends to a caller override set as %s and emits one header',
      (name) => {
        const headers = resolveHeaders({
          headers: { [name]: 'my-lib/3.0.0', 'x-other': 'kept' },
          clientInfo: { via: 'my-lib/3.0.0' },
        })
        const clientInfoHeaders = Object.entries(headers).filter(
          ([key]) => key.toLowerCase() === 'x-client-info'
        )
        expect(clientInfoHeaders).toEqual([['X-Client-Info', 'my-lib/3.0.0; via=my-lib/3.0.0']])
        expect(headers['x-other']).toBe('kept')
      }
    )

    test('does not mutate the caller options', () => {
      const global = { headers: { 'x-client-info': 'my-lib/1.0.0' }, clientInfo: { via: 'a' } }
      resolveHeaders(global)
      expect(global).toEqual({
        headers: { 'x-client-info': 'my-lib/1.0.0' },
        clientInfo: { via: 'a' },
      })
    })

    test.each([undefined, {}])('leaves the header alone for clientInfo %p', (clientInfo) => {
      const headers = resolveHeaders({ clientInfo, headers: { 'x-client-info': 'my-lib/1.0.0' } })
      expect(headers).toEqual({ 'X-Client-Info': BASE, 'x-client-info': 'my-lib/1.0.0' })
      expect(resolveHeaders({ clientInfo })).toEqual({ 'X-Client-Info': BASE })
    })

    test.each([
      ['  x;y  ', 'x%3By'],
      ['100%', '100%25'],
      ['café ☕', 'caf%C3%A9 %E2%98%95'],
      ['two words', 'two words'],
      ['a,b', 'a,b'],
      ['😀', '%F0%9F%98%80'],
      ['a\r\n\x7fb', 'a%0D%0A%7Fb'],
    ])('trims and percent-encodes the value %j', (raw, encoded) => {
      const headers = resolveHeaders({ clientInfo: { via: raw } })
      expect(headers['X-Client-Info']).toBe(`${BASE}; via=${encoded}`)
    })

    test('accepts generic keys and ignores inherited entries', () => {
      const clientInfo = Object.assign(Object.create({ inherited: 'ignored' }), {
        'My-key_1': 'value',
        custom: 'value',
      })
      expect(resolveHeaders({ clientInfo })['X-Client-Info']).toBe(
        `${BASE}; My-key_1=value; custom=value`
      )
    })

    test('preserves a caller header without re-encoding it', () => {
      expect(
        resolveHeaders({
          headers: { 'X-Client-Info': 'custom/1; old=100%; escaped=a%3Bb' },
          clientInfo: { via: 'new/1' },
        })['X-Client-Info']
      ).toBe('custom/1; old=100%; escaped=a%3Bb; via=new/1')
    })
  })

  describe('validation at createClient', () => {
    test.each(['a=b', 'a;b', 'a b', 'café', ''])('rejects the key %p', (key) => {
      expect(() => createClient(URL, KEY, { global: { clientInfo: { [key]: 'v' } } })).toThrow(
        `Invalid global.clientInfo key "${key}": expected only letters, numbers, underscores or hyphens.`
      )
    })

    test.each(['', '   ', '\t'])('rejects the empty value %p', (value) => {
      expect(() => createClient(URL, KEY, { global: { clientInfo: { via: value } } })).toThrow(
        'Invalid global.clientInfo value for "via"'
      )
    })

    test.each([1, null, undefined])('rejects a non-string value %p', (value) => {
      expect(() =>
        createClient(URL, KEY, { global: { clientInfo: { via: value as unknown as string } } })
      ).toThrow('Invalid global.clientInfo value for "via"')
    })

    test('rejects a key already in the caller-supplied X-Client-Info', () => {
      expect(() =>
        createClient(URL, KEY, {
          global: {
            headers: { 'x-client-info': 'my-lib/1.0.0; via=other' },
            clientInfo: { via: 'a' },
          },
        })
      ).toThrow('Invalid global.clientInfo key "via"')
    })

    describe.each([
      'platform',
      'platform-version',
      'platform-architecture',
      'runtime',
      'runtime-version',
      'framework',
      'framework-version',
      'features',
    ])('reserved key %s', (key) => {
      test.each([key, key.toUpperCase()])(
        'rejects %s even when absent from a caller override',
        (name) => {
          for (const headers of [undefined, { 'x-client-info': 'custom/1' }]) {
            expect(() =>
              createClient(URL, KEY, {
                global: { headers, clientInfo: { [name]: 'custom' } },
              })
            ).toThrow(
              `Invalid global.clientInfo key "${name}": this parameter is reserved by the SDK.`
            )
          }
        }
      )
    })

    test.each([undefined, {}, { custom: 'value' }])(
      'preserves SDK-owned metadata supplied through the existing header option with clientInfo %p',
      (clientInfo) => {
        const base = 'custom/1; RUNTIME=custom; features=legacy'
        const headers = resolveHeaders({ headers: { 'X-Client-Info': base }, clientInfo })
        expect(headers['X-Client-Info']).toBe(clientInfo?.custom ? `${base}; custom=value` : base)
      }
    )

    test('rejects case-insensitive collisions among appended keys', () => {
      expect(() =>
        createClient(URL, KEY, { global: { clientInfo: { custom: 'a', CUSTOM: 'b' } } })
      ).toThrow('Invalid global.clientInfo key "CUSTOM"')
    })

    test('accepts via and middleware', () => {
      expect(() =>
        createClient(URL, KEY, { global: { clientInfo: { via: 'lib/1.0.0', middleware: 'a,b' } } })
      ).not.toThrow()
    })
  })

  describe('outgoing requests', () => {
    test('the serialized header reaches PostgREST, Storage, Functions and Auth', async () => {
      const { fetch, calls } = stubFetch()
      const client = createClient(URL, KEY, {
        global: { fetch, clientInfo: { via: 'supabase-server/1.10.0' } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })

      await client.from('t').select()
      await client.storage.from('b').list()
      await client.functions.invoke('fn')
      await client.auth.signInWithPassword({ email: 'a@b.co', password: 'pw' })

      const expected = `${BASE}; via=supabase-server/1.10.0`
      const services = ['/rest/v1/', '/storage/v1/', '/functions/v1/', '/auth/v1/']
      for (const service of services) {
        const call = calls.find((c) => c.url.includes(service))
        expect(call).toBeDefined()
        expect(call!.headers.get('x-client-info')).toBe(expected)
      }
    })

    test('without clientInfo the header is the SDK default', async () => {
      const { fetch, calls } = stubFetch()
      const client = createClient(URL, KEY, { global: { fetch } })
      await client.from('t').select()
      expect(calls[0].headers.get('x-client-info')).toBe(BASE)
    })

    test('a lowercase caller override is replaced by one combined header', async () => {
      const { fetch, calls } = stubFetch()
      const client = createClient(URL, KEY, {
        global: {
          fetch,
          headers: { 'x-client-info': 'my-lib/2.0.0' },
          clientInfo: { middleware: 'a,b' },
        },
      })
      await client.from('t').select()
      expect(calls[0].headers.get('x-client-info')).toBe('my-lib/2.0.0; middleware=a,b')
    })
  })
})
