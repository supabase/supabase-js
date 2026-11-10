/**
 * Checks that every request a namespaced client makes carries the namespace, and that
 * every Storage object path is prefixed with it.
 */
import { createClient, NAMESPACE_HEADER } from '../../src/index'

const URL = 'https://project-ref.supabase.co'
const KEY = 'some.fake.key'
const NS = 's07'

type Recorded = { url: string; method: string; headers: Headers; body: string }

function setup() {
  const requests: Recorded[] = []
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    requests.push({
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: typeof init?.body === 'string' ? init.body : '',
    })
    return new Response('{}', { headers: { 'content-type': 'application/json' } })
  })
  const supabase = createClient(URL, KEY, {
    namespace: NS,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchMock as unknown as typeof fetch },
  })
  return { supabase, requests, fetchMock }
}

type Client = ReturnType<typeof setup>['supabase']

// One entry per public operation that makes a request. Each must send the namespace header.
const operations: Record<
  string,
  (supabase: Client, fetchMock: typeof fetch) => PromiseLike<unknown>
> = {
  // Database
  'from().select': (s) => s.from('todos').select(),
  'from().insert': (s) => s.from('todos').insert({ id: 1 }),
  'from().update': (s) => s.from('todos').update({ id: 1 }).eq('id', 1),
  'from().upsert': (s) => s.from('todos').upsert({ id: 1 }),
  'from().delete': (s) => s.from('todos').delete().eq('id', 1),
  'from() with per-request fetch': (s, fetchMock) =>
    s.from('todos', { fetch: (input, init) => fetchMock(input, init) }).select(),
  'rpc() POST': (s) => s.rpc('fn', { a: 1 }),
  'rpc() GET': (s) => s.rpc('fn', {}, { get: true }),
  'schema().from()': (s) => s.schema('other').from('todos').select(),
  getOpenApiSpec: (s) => s.getOpenApiSpec(),
  // Auth
  'auth.signUp': (s) => s.auth.signUp({ email: 'a@example.com', password: 'secret-password' }),
  'auth.signInWithPassword': (s) =>
    s.auth.signInWithPassword({ email: 'a@example.com', password: 'secret-password' }),
  'auth.signInWithOtp': (s) => s.auth.signInWithOtp({ email: 'a@example.com' }),
  'auth.verifyOtp': (s) => s.auth.verifyOtp({ email: 'a@example.com', token: '1', type: 'email' }),
  'auth.signInAnonymously': (s) => s.auth.signInAnonymously(),
  'auth.resetPasswordForEmail': (s) => s.auth.resetPasswordForEmail('a@example.com'),
  'auth.resend': (s) => s.auth.resend({ type: 'signup', email: 'a@example.com' }),
  'auth.getUser(jwt)': (s) => s.auth.getUser('jwt'),
  'auth.admin.listUsers': (s) => s.auth.admin.listUsers(),
  'auth.admin.createUser': (s) => s.auth.admin.createUser({ email: 'a@example.com' }),
  'auth.admin.deleteUser': (s) => s.auth.admin.deleteUser('8bf8a5d1-0b6d-4a63-8e0e-2a6b4d4a4b0c'),
  // Storage objects
  'storage.upload': (s) => s.storage.from('b').upload('a.txt', 'x'),
  'storage.update': (s) => s.storage.from('b').update('a.txt', 'x'),
  'storage.list': (s) => s.storage.from('b').list(),
  'storage.listV2': (s) => s.storage.from('b').listV2(),
  'storage.remove': (s) => s.storage.from('b').remove(['a.txt']),
  // Storage buckets
  'storage.listBuckets': (s) => s.storage.listBuckets(),
  'storage.createBucket': (s) => s.storage.createBucket('b'),
  // Storage vectors and analytics
  'storage.vectors.listBuckets': (s) => s.storage.vectors.listBuckets(),
  'storage.vectors index.putVectors': (s) =>
    s.storage.vectors
      .from('vb')
      .index('i')
      .putVectors({ vectors: [{ key: 'k', data: { float32: [1] } }] }),
  'storage.analytics.listBuckets': (s) => s.storage.analytics.listBuckets(),
  // Edge Functions
  'functions.invoke POST': (s) => s.functions.invoke('hello', { body: { a: 1 } }),
  'functions.invoke GET': (s) => s.functions.invoke('hello', { method: 'GET' }),
}

describe('namespace coverage', () => {
  test.each(Object.entries(operations))('%s sends the namespace header', async (_, run) => {
    const { supabase, requests, fetchMock } = setup()
    await Promise.resolve(run(supabase, fetchMock as unknown as typeof fetch)).then(
      () => undefined,
      () => undefined
    )

    expect(requests.length).toBeGreaterThan(0)
    for (const request of requests) {
      expect([request.url, request.headers.get(NAMESPACE_HEADER)]).toEqual([request.url, NS])
    }
  })

  // Every public StorageFileApi method must be listed here, so a new one can't skip the
  // prefix unnoticed. `null` marks methods that don't take an object path.
  const storageOperations: Record<
    string,
    ((files: ReturnType<Client['storage']['from']>) => PromiseLike<unknown> | unknown) | null
  > = {
    upload: (f) => f.upload('dir/a.txt', 'x'),
    update: (f) => f.update('dir/a.txt', 'x'),
    uploadToSignedUrl: (f) => f.uploadToSignedUrl('dir/a.txt', 'token', 'x'),
    createSignedUploadUrl: (f) => f.createSignedUploadUrl('dir/a.txt'),
    move: (f) => f.move('dir/a.txt', 'dir/b.txt'),
    copy: (f) => f.copy('dir/a.txt', 'dir/b.txt'),
    createSignedUrl: (f) => f.createSignedUrl('dir/a.txt', 60),
    createSignedUrls: (f) => f.createSignedUrls(['dir/a.txt'], 60),
    download: (f) => f.download('dir/a.txt'),
    info: (f) => f.info('dir/a.txt'),
    exists: (f) => f.exists('dir/a.txt'),
    getPublicUrl: (f) => f.getPublicUrl('dir/a.txt'),
    remove: (f) => f.remove(['dir/a.txt']),
    purgeCache: (f) => f.purgeCache('dir/a.txt'),
    list: (f) => f.list('dir'),
    listV2: (f) => f.listV2({ prefix: 'dir/' }),
    toBase64: null,
    throwOnError: null,
  }

  test('every StorageFileApi method is classified', () => {
    const { supabase } = setup()
    const files = supabase.storage.from('b')
    const methods = new Set<string>()
    for (let proto = Object.getPrototypeOf(files); proto !== Object.prototype; ) {
      for (const name of Object.getOwnPropertyNames(proto)) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, name)
        if (name !== 'constructor' && typeof descriptor?.value === 'function') {
          methods.add(name)
        }
      }
      proto = Object.getPrototypeOf(proto)
    }
    const internal = [...methods].filter((name) => name.startsWith('_') || isInternal(name))
    const publicMethods = [...methods].filter((name) => !internal.includes(name)).sort()

    expect(publicMethods).toEqual(Object.keys(storageOperations).sort())
  })

  test.each(
    Object.entries(storageOperations).filter(
      (entry): entry is [string, NonNullable<(typeof entry)[1]>] => entry[1] !== null
    )
  )('storage %s uses the prefixed path', async (name, run) => {
    const { supabase, requests } = setup()
    const result = await Promise.resolve(run(supabase.storage.from('b'))).then(
      (value) => value,
      () => undefined
    )

    if (name === 'getPublicUrl') {
      expect((result as any).data.publicUrl).toContain(`/b/${NS}/dir/a.txt`)
      return
    }
    expect(requests.length).toBeGreaterThan(0)
    const sent = requests.map((r) => decodeURIComponent(r.url) + ' ' + r.body).join('\n')
    expect(sent).toContain(`${NS}/dir`)
    expect(sent).not.toMatch(/(?<!s07\/)dir\/a\.txt/)
  })

  test('Realtime topics are prefixed, including REST broadcasts', async () => {
    const { supabase, requests } = setup()
    const channel = supabase.channel('room')

    expect(channel.topic).toBe(`realtime:${NS}:room`)
    await channel.httpSend('ping', {}).catch(() => undefined)
    expect(requests).toHaveLength(1)
    expect(decodeURIComponent(requests[0].url)).toContain(`/${NS}:room/events/ping`)
  })
})

// Protected helpers that are reachable on the prototype but are not part of the public API.
function isInternal(name: string) {
  return [
    'uploadOrUpdate',
    'prepareUploadFormData',
    'encodeMetadata',
    'applyTransformOptsToQuery',
    'handleOperation',
    'setHeader',
  ].includes(name)
}
