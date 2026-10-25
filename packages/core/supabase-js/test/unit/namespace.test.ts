import { createClient, NAMESPACE_HEADER, namespaceFrom } from '../../src/index'

const URL = 'https://project-ref.supabase.co'
const KEY = 'some.fake.key'

describe('namespace option', () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    fetchMock = jest.fn(
      async () => new Response('{}', { headers: { 'content-type': 'application/json' } })
    )
  })

  function sentHeaders(call = 0): Headers {
    return new Headers(fetchMock.mock.calls[call][1]?.headers)
  }

  function client(options: Parameters<typeof createClient>[2] = {}) {
    return createClient(URL, KEY, {
      namespace: 's07',
      auth: { persistSession: false, autoRefreshToken: false },
      ...options,
      global: { fetch: fetchMock, ...options.global },
    })
  }

  test('sends the namespace header on database requests', async () => {
    await client().from('todos').select()
    expect(sentHeaders().get(NAMESPACE_HEADER)).toBe('s07')
  })

  test('sends the namespace header on storage, functions and auth requests', async () => {
    const supabase = client()
    await supabase.storage.from('photos').list()
    await supabase.functions.invoke('hello')
    await supabase.auth.signInWithPassword({ email: 'a@example.com', password: 'secret' })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    for (let call = 0; call < 3; call++) {
      expect(sentHeaders(call).get(NAMESPACE_HEADER)).toBe('s07')
    }
  })

  test('the option wins over a header of the same name in global.headers', async () => {
    await client({ global: { headers: { 'X-Supabase-Namespace': 'other' } } })
      .from('todos')
      .select()
    expect(sentHeaders().get(NAMESPACE_HEADER)).toBe('s07')
  })

  test('prefixes Realtime channel topics', () => {
    const supabase = client()
    const channel = supabase.channel('room')
    expect(channel.topic).toBe('realtime:s07:room')
    expect(supabase.getChannels()).toEqual([channel])
  })

  test('prefixes Storage object paths', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ Id: 'id', Key: 'photos/s07/a.png' }), {
        headers: { 'content-type': 'application/json' },
      })
    )
    const { data } = await client().storage.from('photos').upload('a.png', 'body')

    expect(fetchMock.mock.calls[0][0]).toBe(`${URL}/storage/v1/object/photos/s07/a.png`)
    expect(data).toEqual({ id: 'id', path: 'a.png', fullPath: 'photos/s07/a.png' })
  })

  test('keeps other storage options', () => {
    const supabase = client({ storage: { useNewHostname: true } })
    // @ts-expect-error url is protected
    expect(supabase.storage.url).toBe('https://project-ref.storage.supabase.co/storage/v1')
  })

  test('includes the namespace in the default auth storage key', () => {
    const supabase = createClient(URL, KEY, { namespace: 's07' })
    // @ts-expect-error storageKey is protected
    expect(supabase.storageKey).toBe('sb-project-ref-s07-auth-token')
  })

  test('a custom auth storage key is kept as-is', () => {
    const supabase = createClient(URL, KEY, { namespace: 's07', auth: { storageKey: 'custom' } })
    // @ts-expect-error storageKey is protected
    expect(supabase.storageKey).toBe('custom')
  })

  test('without a namespace, nothing changes', async () => {
    const supabase = createClient(URL, KEY, { global: { fetch: fetchMock } })
    await supabase.from('todos').select()

    expect(sentHeaders().has(NAMESPACE_HEADER)).toBe(false)
    expect(supabase.channel('room').topic).toBe('realtime:room')
    // @ts-expect-error storageKey is protected
    expect(supabase.storageKey).toBe('sb-project-ref-auth-token')
    expect(supabase.storage.from('photos').getPublicUrl('a.png').data.publicUrl).toBe(
      `${URL}/storage/v1/object/public/photos/a.png`
    )
  })

  test('treats null like unset', () => {
    const supabase = createClient(URL, KEY, { namespace: null as unknown as string })
    expect(supabase.channel('room').topic).toBe('realtime:room')
  })

  test.each(['', 's:07', 's/07', '-s07', 's 07', 'a'.repeat(64), 7 as unknown as string])(
    'rejects the invalid namespace %j',
    (namespace) => {
      expect(() => createClient(URL, KEY, { namespace })).toThrow(/Invalid namespace/)
    }
  )

  test.each(['s07', 'S07', 'agent_1', 'pr-123', 'a'.repeat(63)])(
    'accepts the namespace %j',
    (namespace) => {
      expect(() => createClient(URL, KEY, { namespace })).not.toThrow()
    }
  )
})

describe('namespaceFrom', () => {
  test('reads the header from a Fetch API request', () => {
    const req = new Request('https://example.com', { headers: { [NAMESPACE_HEADER]: 's07' } })
    expect(namespaceFrom(req)).toBe('s07')
  })

  test('reads the header from a Node.js style headers record', () => {
    expect(namespaceFrom({ headers: { 'x-supabase-namespace': 's07' } })).toBe('s07')
    expect(namespaceFrom({ headers: { 'X-Supabase-Namespace': ['s07', 's08'] } })).toBe('s07')
  })

  test('returns undefined when the header is missing or empty', () => {
    expect(namespaceFrom(new Request('https://example.com'))).toBeUndefined()
    expect(namespaceFrom({ headers: { [NAMESPACE_HEADER]: '' } })).toBeUndefined()
    expect(namespaceFrom({ headers: {} })).toBeUndefined()
  })

  test('throws on an invalid namespace', () => {
    expect(() => namespaceFrom({ headers: { [NAMESPACE_HEADER]: '../etc' } })).toThrow(
      /Invalid namespace/
    )
  })

  test('round-trips through createClient', async () => {
    const fetchMock = jest.fn(async () => new Response('[]'))
    const req = new Request('https://example.com', { headers: { [NAMESPACE_HEADER]: 's07' } })
    const supabase = createClient(URL, KEY, {
      namespace: namespaceFrom(req),
      global: { fetch: fetchMock },
    })
    expect(supabase.channel('room').topic).toBe('realtime:s07:room')
  })
})
