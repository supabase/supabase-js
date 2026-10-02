import { StorageClient } from '../src/index'

// `?` ` ` `&` `=` `+` are all accepted by the Storage server as part of an object
// key, and all of them change the meaning of a URL if interpolated raw.
const KEY = 'folder/a?b&c=d e+f.txt'
const ENCODED = 'folder/a%3Fb%26c%3Dd%20e%2Bf.txt'

// Unit test (custom fetch capture) — proves such a key stays inside the path
// instead of starting a querystring.
describe('object keys containing URL delimiters', () => {
  const URL = 'http://localhost/storage/v1'

  const makeClient = () => {
    const urls: string[] = []
    const fetch = (async (url: string) => {
      urls.push(url)
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof globalThis.fetch
    return { client: new StorageClient(URL, {}, fetch), urls }
  }

  test('getPublicUrl keeps the key in the path', () => {
    const { client } = makeClient()
    const { data } = client.from('bucket').getPublicUrl(KEY)
    const parsed = new global.URL(data.publicUrl)
    expect(parsed.pathname).toBe(`/storage/v1/object/public/bucket/${ENCODED}`)
    expect(parsed.search).toBe('')
  })

  test('info sends the key as path only', async () => {
    const { client, urls } = makeClient()
    await client.from('bucket').info(KEY)
    expect(new global.URL(urls[0]).pathname).toBe(`/storage/v1/object/info/bucket/${ENCODED}`)
  })

  test('exists sends the key as path only', async () => {
    const { client, urls } = makeClient()
    await client.from('bucket').exists(KEY)
    expect(new global.URL(urls[0]).pathname).toBe(`/storage/v1/object/bucket/${ENCODED}`)
  })

  test('createSignedUrl sends the key as path only', async () => {
    const { client, urls } = makeClient()
    await client.from('bucket').createSignedUrl(KEY, 60)
    expect(new global.URL(urls[0]).pathname).toBe(`/storage/v1/object/sign/bucket/${ENCODED}`)
  })
})

// Integration test — the encoding above is only useful if the Storage server
// decodes each segment back to the original key, so round-trip the key against a
// real server rather than assuming it.
describe('object keys containing URL delimiters, against the server', () => {
  // Supabase CLI local development defaults
  const SERVER_URL = 'http://127.0.0.1:54321/storage/v1'
  // secret key - bypasses RLS for testing
  const SERVICE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

  const storage = new StorageClient(SERVER_URL, { Authorization: `Bearer ${SERVICE_KEY}` })
  const body = 'delimiter key contents'

  let bucketName: string

  beforeAll(async () => {
    bucketName = `delimiter-bucket-${Date.now()}`
    const { error } = await storage.createBucket(bucketName, { public: true })
    expect(error).toBeNull()
  })

  test('upload, then read the same object back through every path-based method', async () => {
    const { data: uploaded, error: uploadError } = await storage
      .from(bucketName)
      .upload(KEY, body, { contentType: 'text/plain' })
    expect(uploadError).toBeNull()
    expect(uploaded?.path).toBe(KEY)

    // The server stored the whole key, delimiters and all.
    const { data: listed } = await storage.from(bucketName).list('folder')
    expect(listed?.map((entry) => entry.name)).toContain('a?b&c=d e+f.txt')

    expect(await storage.from(bucketName).exists(KEY)).toEqual({ data: true, error: null })

    const { data: info, error: infoError } = await storage.from(bucketName).info(KEY)
    expect(infoError).toBeNull()
    expect(info?.name).toBe(KEY)

    const { data: blob, error: downloadError } = await storage.from(bucketName).download(KEY)
    expect(downloadError).toBeNull()
    expect(await blob?.text()).toBe(body)

    const { publicUrl } = storage.from(bucketName).getPublicUrl(KEY).data
    expect(await (await fetch(publicUrl)).text()).toBe(body)
  })

  // `createSignedUrl` is deliberately excluded above. The server signs a token
  // over the percent-encoded key but validates the request against the decoded
  // path, so the signature never matches for a key whose encoding is anything
  // other than `%20` — the URL the server itself returns fails the same way, so
  // this is not something the client can encode its way out of.
  test('createSignedUrl still cannot serve a key containing `?`', async () => {
    const { data: signed, error } = await storage.from(bucketName).createSignedUrl(KEY, 60)
    expect(error).toBeNull()
    expect((await fetch(signed!.signedUrl)).status).toBe(400)
  })

  test('createSignedUrl works for a key whose only escape is `%20`', async () => {
    const spaceKey = 'folder/a b.txt'
    const { error: uploadError } = await storage
      .from(bucketName)
      .upload(spaceKey, body, { contentType: 'text/plain' })
    expect(uploadError).toBeNull()

    const { data: signed, error } = await storage.from(bucketName).createSignedUrl(spaceKey, 60)
    expect(error).toBeNull()
    expect(await (await fetch(signed!.signedUrl)).text()).toBe(body)
  })
})
