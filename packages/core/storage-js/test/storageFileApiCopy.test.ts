import { CopyOptions, StorageClient } from '../src/index'

describe('Copy and move requests', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>
  let files: ReturnType<StorageClient['from']>

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ Key: 'bucket/destination.txt', message: 'Successfully moved' }),
        {
          headers: { 'content-type': 'application/json' },
        }
      )
    )
    files = new StorageClient('http://localhost/storage/v1', {}, fetchMock).from('bucket')
  })

  function request() {
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    return new Request(url, init)
  }

  const sourceAndDestination = {
    bucketId: 'bucket',
    sourceKey: 'source.txt',
    destinationKey: 'destination.txt',
  }

  test.each(['copy', 'move'] as const)(
    '%s leaves metadata preservation to the server by default',
    async (operation) => {
      const result = await files[operation]('source.txt', 'destination.txt')
      expect(result.error).toBeNull()

      const sent = request()
      expect(sent.url).toBe(`http://localhost/storage/v1/object/${operation}`)
      expect(sent.method).toBe('POST')
      expect(await sent.json()).toEqual(sourceAndDestination)
    }
  )

  test.each(['copy', 'move'] as const)(
    '%s forwards the destination bucket and source version',
    async (operation) => {
      const options = { destinationBucket: 'other-bucket', sourceVersionId: 'source-version' }
      const result = await files[operation]('source.txt', 'destination.txt', options)
      expect(result.error).toBeNull()
      expect(await request().json()).toEqual({ ...sourceAndDestination, ...options })
    }
  )

  test.each([{ owner: 'team' }, 'shared upload label'])(
    'copy ignores legacy shared metadata %j without an explicit override',
    async (metadata) => {
      const options = {
        destinationBucket: 'other-bucket',
        sourceVersionId: 'source-version',
        metadata,
      }
      const result = await files.copy('source.txt', 'destination.txt', options)
      expect(result.error).toBeNull()
      expect(await request().json()).toEqual({
        ...sourceAndDestination,
        destinationBucket: 'other-bucket',
        sourceVersionId: 'source-version',
      })
    }
  )

  test.each(['false', 0, null])(
    'copy ignores a legacy non-boolean flag %j',
    async (copyMetadata) => {
      const options = { destinationBucket: 'other-bucket', copyMetadata }
      const result = await files.copy('source.txt', 'destination.txt', options)
      expect(result.error).toBeNull()
      expect(await request().json()).toEqual({
        ...sourceAndDestination,
        destinationBucket: 'other-bucket',
      })
    }
  )

  test('copy forwards file metadata through a wrapper using inferred parameters', async () => {
    const copy = (...args: Parameters<typeof files.copy>) => files.copy(...args)
    const options: NonNullable<Parameters<typeof files.copy>[2]> = {
      destinationBucket: 'other-bucket',
      sourceVersionId: 'source-version',
      copyMetadata: false,
      metadata: {
        cacheControl: 'max-age=7200',
        contentEncoding: 'gzip',
        mimetype: 'text/plain',
      },
    }
    const result = await copy('source.txt', 'destination.txt', options)
    expect(result).toEqual({ data: { path: 'bucket/destination.txt' }, error: null })

    const sent = request()
    expect(sent.headers.get('content-type')).toBe('application/json')
    expect(sent.headers.get('content-encoding')).toBeNull()
    expect(await sent.json()).toEqual({ ...sourceAndDestination, ...options })
  })

  test.each(['', undefined])(
    'copy forwards partial metadata with contentEncoding %j',
    async (contentEncoding) => {
      const options: CopyOptions = {
        copyMetadata: false,
        metadata: contentEncoding === undefined ? {} : { contentEncoding },
      }
      const result = await files.copy('source.txt', 'destination.txt', options)
      expect(result.error).toBeNull()
      expect(await request().json()).toEqual({
        ...sourceAndDestination,
        copyMetadata: false,
        metadata: contentEncoding === undefined ? {} : { contentEncoding },
      })
    }
  )

  test('copy forwards explicit metadata preservation', async () => {
    const options: CopyOptions = { copyMetadata: true, metadata: { contentEncoding: 'gzip' } }
    const result = await files.copy('source.txt', 'destination.txt', options)
    expect(result.error).toBeNull()
    expect(await request().json()).toEqual({ ...sourceAndDestination, copyMetadata: true })
  })

  test('copy can disable metadata copying without file metadata overrides', async () => {
    const result = await files.copy('source.txt', 'destination.txt', { copyMetadata: false })
    expect(result.error).toBeNull()
    expect(await request().json()).toEqual({ ...sourceAndDestination, copyMetadata: false })
  })
})
