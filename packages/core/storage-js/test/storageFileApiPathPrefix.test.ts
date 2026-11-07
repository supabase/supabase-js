import { StorageClient } from '../src/index'

describe('pathPrefix', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>

  function respondWith(body: unknown) {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
    )
  }

  function files(pathPrefix?: string) {
    return new StorageClient('http://localhost/storage/v1', {}, fetchMock, {
      ...(pathPrefix !== undefined && { pathPrefix }),
    }).from('bucket')
  }

  function request() {
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    return new Request(url, init)
  }

  beforeEach(() => {
    fetchMock = jest.fn()
    respondWith({})
  })

  test('upload stores the object under the prefix and returns the relative path', async () => {
    respondWith({ Id: 'id', Key: 'bucket/s07/folder/a.txt' })
    const { data, error } = await files('s07').upload('/folder/a.txt', 'hello')

    expect(error).toBeNull()
    expect(request().url).toBe('http://localhost/storage/v1/object/bucket/s07/folder/a.txt')
    expect(data).toEqual({ id: 'id', path: 'folder/a.txt', fullPath: 'bucket/s07/folder/a.txt' })
  })

  test('surrounding slashes in the prefix are ignored', async () => {
    respondWith({ Id: 'id', Key: 'bucket/s07/a.txt' })
    await files('/s07/').upload('a.txt', 'hello')
    expect(request().url).toBe('http://localhost/storage/v1/object/bucket/s07/a.txt')
  })

  test('an empty prefix behaves like no prefix', async () => {
    respondWith({ Id: 'id', Key: 'bucket/a.txt' })
    await files('').upload('a.txt', 'hello')
    expect(request().url).toBe('http://localhost/storage/v1/object/bucket/a.txt')
  })

  test('getPublicUrl includes the prefix', () => {
    const { data } = files('s07').getPublicUrl('a.png')
    expect(data.publicUrl).toBe('http://localhost/storage/v1/object/public/bucket/s07/a.png')
  })

  test('createSignedUrl signs the prefixed path', async () => {
    respondWith({ signedURL: '/object/sign/bucket/s07/a.png?token=t' })
    await files('s07').createSignedUrl('a.png', 60)
    expect(request().url).toBe('http://localhost/storage/v1/object/sign/bucket/s07/a.png')
  })

  test('createSignedUploadUrl and uploadToSignedUrl use the prefixed path', async () => {
    respondWith({ url: '/object/upload/sign/bucket/s07/a.png?token=t' })
    const signed = await files('s07').createSignedUploadUrl('a.png')
    expect(request().url).toBe('http://localhost/storage/v1/object/upload/sign/bucket/s07/a.png')
    expect(signed.data?.path).toBe('a.png')

    fetchMock.mockClear()
    respondWith({ Key: 'bucket/s07/a.png' })
    const uploaded = await files('s07').uploadToSignedUrl('a.png', 't', 'hello')
    expect(request().url).toBe(
      'http://localhost/storage/v1/object/upload/sign/bucket/s07/a.png?token=t'
    )
    expect(uploaded.data).toEqual({ path: 'a.png', fullPath: 'bucket/s07/a.png' })
  })

  test('download and info read the prefixed path and info returns the relative name', async () => {
    respondWith({ name: 's07/a.png', bucket_id: 'bucket' })
    const { data } = await files('s07').info('a.png')
    expect(request().url).toBe('http://localhost/storage/v1/object/info/bucket/s07/a.png')
    expect(data).toMatchObject({ name: 'a.png', bucketId: 'bucket' })

    fetchMock.mockClear()
    fetchMock.mockResolvedValue(new Response('file'))
    await files('s07').download('a.png')
    expect(request().url).toBe('http://localhost/storage/v1/object/bucket/s07/a.png')
  })

  test.each(['copy', 'move'] as const)('%s prefixes source and destination', async (operation) => {
    respondWith({ Key: 'bucket/s07/b.txt', message: 'ok' })
    await files('s07')[operation]('a.txt', 'b.txt')
    expect(await request().json()).toEqual({
      bucketId: 'bucket',
      sourceKey: 's07/a.txt',
      destinationKey: 's07/b.txt',
    })
  })

  test('createSignedUrls prefixes the request paths and strips them from the response', async () => {
    respondWith([
      { path: 's07/a.png', signedURL: '/object/sign/bucket/s07/a.png?token=t', error: null },
      { path: 's07/b.png', signedURL: null, error: 'Either the object does not exist' },
    ])
    const { data } = await files('s07').createSignedUrls(['a.png', 'b.png'], 60)

    expect(await request().json()).toEqual({ expiresIn: 60, paths: ['s07/a.png', 's07/b.png'] })
    expect(data?.map((d) => d.path)).toEqual(['a.png', 'b.png'])
    expect(data?.[0].signedUrl).toBe(
      'http://localhost/storage/v1/object/sign/bucket/s07/a.png?token=t'
    )
  })

  test('remove prefixes every entry and strips names from the response', async () => {
    respondWith([{ name: 's07/a.png' }, { name: 's07/b.png' }])
    const { data } = await files('s07').remove(['a.png', { path: 'b.png', versionId: 'v1' }])

    expect(await request().json()).toEqual({
      prefixes: ['s07/a.png', { path: 's07/b.png', versionId: 'v1' }],
    })
    expect(data?.map((d) => d.name)).toEqual(['a.png', 'b.png'])
  })

  test.each([
    [undefined, 's07/'],
    ['', 's07/'],
    ['folder', 's07/folder'],
  ])('list(%j) searches under %j', async (path, prefix) => {
    respondWith([])
    await files('s07').list(path)
    expect((await request().json()).prefix).toBe(prefix)
  })

  test('listV2 scopes the prefix and strips it from keys and names', async () => {
    respondWith({
      hasNext: false,
      folders: [{ name: 's07/folder/', key: 's07/folder/' }],
      objects: [{ name: 's07/a.png', key: 's07/a.png', id: 'id' }],
    })
    const { data } = await files('s07').listV2({ with_delimiter: true })

    expect(await request().json()).toEqual({ with_delimiter: true, prefix: 's07/' })
    expect(data).toEqual({
      hasNext: false,
      folders: [{ name: 'folder/', key: 'folder/' }],
      objects: [{ name: 'a.png', key: 'a.png', id: 'id' }],
    })
  })

  test('listV2 appends a caller prefix to the path prefix', async () => {
    respondWith({ hasNext: false, folders: [], objects: [] })
    await files('s07').listV2({ prefix: 'folder/' })
    expect((await request().json()).prefix).toBe('s07/folder/')
  })

  test('purgeCache purges the prefixed path', async () => {
    respondWith({ message: 'ok' })
    await files('s07').purgeCache('a.png')
    expect(request().url).toBe('http://localhost/storage/v1/cdn/bucket/s07/a.png')
  })

  test('without a prefix, requests and responses are unchanged', async () => {
    respondWith([{ name: 's07/a.png' }])
    const { data } = await files().remove(['s07/a.png'])
    expect(await request().json()).toEqual({ prefixes: ['s07/a.png'] })
    expect(data?.[0].name).toBe('s07/a.png')

    fetchMock.mockClear()
    respondWith({ hasNext: false, folders: [], objects: [{ name: 's07/a.png' }] })
    const listed = await files().listV2()
    expect(await request().json()).toEqual({})
    expect(listed.data?.objects[0].name).toBe('s07/a.png')
  })
})
