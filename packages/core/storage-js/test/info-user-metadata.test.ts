import { StorageClient } from '../src/index'

// Unit test (custom fetch) for info(). The server's `metadata` field is the object's
// user_metadata, i.e. whatever the caller passed to upload({ metadata }). Only the
// top-level response fields should be camelCased; the user's own keys must come back as-is.
describe('StorageFileApi.info() user metadata', () => {
  const URL = 'http://localhost/storage/v1'

  const makeClient = (responseBody: unknown) => {
    const fetch = (async () =>
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof globalThis.fetch
    return new StorageClient(URL, {}, fetch)
  }

  test('camelCases top-level fields but returns user metadata keys unchanged', async () => {
    const userMetadata = {
      user_id: 'u-42',
      'x-source-app': 'mobile',
      nested: { order_id: 7 },
    }
    const client = makeClient({
      id: 'obj-id',
      name: 'folder/file.txt',
      version: 'v1',
      bucket_id: 'bucket',
      size: 5,
      content_type: 'text/plain',
      cache_control: 'max-age=3600',
      etag: '"abc"',
      metadata: userMetadata,
      last_modified: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
    })

    const { data, error } = await client.from('bucket').info('folder/file.txt')

    expect(error).toBeNull()
    expect(data).toMatchObject({
      bucketId: 'bucket',
      contentType: 'text/plain',
      cacheControl: 'max-age=3600',
      lastModified: '2026-01-01T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    })
    expect(data?.metadata).toEqual(userMetadata)
  })
})
