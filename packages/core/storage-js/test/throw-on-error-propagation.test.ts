import { StorageClient } from '../src/index'

const failingFetch = () =>
  jest.fn().mockImplementation(
    async () =>
      new Response(JSON.stringify({ message: 'denied', statusCode: '403' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })
  )

const URL = 'http://localhost/storage/v1'

describe('throwOnError() on the storage client', () => {
  test('is kept by from()', async () => {
    const storage = new StorageClient(URL, {}, failingFetch()).throwOnError()

    await expect(storage.from('bucket').list()).rejects.toMatchObject({ message: 'denied' })
  })

  test('is kept by analytics', async () => {
    const storage = new StorageClient(URL, {}, failingFetch()).throwOnError()

    await expect(storage.analytics.listBuckets()).rejects.toMatchObject({ message: 'denied' })
  })

  test('is kept by vectors, vectors.from() and index()', async () => {
    const storage = new StorageClient(URL, {}, failingFetch()).throwOnError()

    await expect(storage.vectors.listBuckets()).rejects.toMatchObject({ message: 'denied' })
    await expect(storage.vectors.from('vb').listIndexes({})).rejects.toMatchObject({
      message: 'denied',
    })
    await expect(storage.vectors.from('vb').index('idx').listVectors({})).rejects.toMatchObject({
      message: 'denied',
    })
  })

  test('is off by default', async () => {
    const storage = new StorageClient(URL, {}, failingFetch())

    const { data, error } = await storage.from('bucket').list()

    expect(data).toBeNull()
    expect(error?.message).toBe('denied')
  })
})
