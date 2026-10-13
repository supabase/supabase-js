import StorageFileApi from '../src/packages/StorageFileApi'

const URL_BASE = 'https://proj.supabase.co/storage/v1'

const makeApi = (fetchImpl?: any) => new StorageFileApi(URL_BASE, {}, 'bucket', fetchImpl)

/**
 * A `#` in an object key ends the URL path and starts a fragment, and a `?`
 * starts the query string, so an unencoded key silently addresses a different
 * object than the one the caller asked for.
 */
describe('object keys that carry URL-significant characters', () => {
  describe('getPublicUrl', () => {
    test('percent-encodes a hash', () => {
      const { data } = makeApi().getPublicUrl('folder/report#1.png')

      expect(data.publicUrl).toBe(`${URL_BASE}/object/public/bucket/folder/report%231.png`)
    })

    test('percent-encodes a question mark', () => {
      const { data } = makeApi().getPublicUrl('folder/what?.png')

      expect(data.publicUrl).toBe(`${URL_BASE}/object/public/bucket/folder/what%3F.png`)
    })

    test('keeps path separators literal', () => {
      const { data } = makeApi().getPublicUrl('a/b/c.png')

      expect(data.publicUrl).toBe(`${URL_BASE}/object/public/bucket/a/b/c.png`)
    })

    test('leaves the query string it builds itself untouched', () => {
      const { data } = makeApi().getPublicUrl('folder/report#1.png', { download: 'report#1.png' })

      const [path, query] = data.publicUrl.split('?')
      expect(path).toBe(`${URL_BASE}/object/public/bucket/folder/report%231.png`)
      expect(query).toBe('download=report%231.png')
    })
  })

  describe('requests built from an object key', () => {
    const capture = () => {
      const calls: string[] = []
      const fetchImpl = jest.fn(async (url: string) => {
        calls.push(url)
        return new Response(JSON.stringify({ signedURL: '/object/sign/bucket/key?token=t' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      })

      return { calls, fetchImpl }
    }

    test('info() encodes the key', async () => {
      const { calls, fetchImpl } = capture()

      await makeApi(fetchImpl).info('folder/report#1.png')

      expect(calls[0]).toContain('/object/info/bucket/folder/report%231.png')
    })

    test('createSignedUrl() encodes the key', async () => {
      const { calls, fetchImpl } = capture()

      await makeApi(fetchImpl).createSignedUrl('folder/report#1.png', 60)

      expect(calls[0]).toContain('/object/sign/bucket/folder/report%231.png')
    })
  })
})

/**
 * The server echoes the object path back inside signed URLs, still encoded on
 * `/object/sign` and decoded on `/object/upload/sign`. The client must not
 * encode it a second time, and must not mistake a `?` in the key for the query.
 */
describe('signed URLs returned by the server', () => {
  const respond = (body: unknown) =>
    jest.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
    )

  test.each([
    ['encoded', '/object/sign/bucket/folder/what%3F%26.png?token=t'],
    ['decoded', '/object/sign/bucket/folder/what?&.png?token=t'],
  ])('createSignedUrl encodes the key once when the server echoes it %s', async (_, signedURL) => {
    const { data } = await makeApi(respond({ signedURL })).createSignedUrl('folder/what?&.png', 60)

    expect(data?.signedUrl).toBe(`${URL_BASE}/object/sign/bucket/folder/what%3F%26.png?token=t`)
  })

  test('createSignedUrl appends download after the token', async () => {
    const signedURL = '/object/sign/bucket/a%20b.png?token=t'
    const { data } = await makeApi(respond({ signedURL })).createSignedUrl('a b.png', 60, {
      download: true,
    })

    expect(data?.signedUrl).toBe(`${URL_BASE}/object/sign/bucket/a%20b.png?token=t&download=`)
  })

  test('createSignedUrls encodes each key once', async () => {
    const body = [
      { error: null, path: 'x?y.png', signedURL: '/object/sign/bucket/x?y.png?token=t1' },
      { error: null, path: 'x+y.png', signedURL: '/object/sign/bucket/x%2By.png?token=t2' },
    ]
    const { data } = await makeApi(respond(body)).createSignedUrls(['x?y.png', 'x+y.png'], 60)

    expect(data?.map((d) => d.signedUrl)).toEqual([
      `${URL_BASE}/object/sign/bucket/x%3Fy.png?token=t1`,
      `${URL_BASE}/object/sign/bucket/x%2By.png?token=t2`,
    ])
  })

  test('createSignedUploadUrl finds the token when the key carries a question mark', async () => {
    const url = '/object/upload/sign/bucket/x?y.png?token=t'
    const { data, error } = await makeApi(respond({ url })).createSignedUploadUrl('x?y.png')

    expect(error).toBeNull()
    expect(data?.token).toBe('t')
    expect(data?.signedUrl).toBe(`${URL_BASE}/object/upload/sign/bucket/x%3Fy.png?token=t`)
  })
})

describe('createSignedUrl request path', () => {
  test('keeps sub-delimiters literal so the server signs the key it later verifies', async () => {
    const calls: string[] = []
    const fetchImpl = jest.fn(async (url: string) => {
      calls.push(url)
      return new Response(JSON.stringify({ signedURL: '/object/sign/bucket/k?token=t' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    await makeApi(fetchImpl).createSignedUrl('a b/x&y+z=1@2.png', 60)

    expect(calls[0]).toBe(`${URL_BASE}/object/sign/bucket/a%20b/x&y+z=1@2.png`)
  })
})
