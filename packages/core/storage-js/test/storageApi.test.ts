import { StorageClient } from '../src/index'

// TODO: need to setup storage-api server for this test
const URL = 'http://localhost:8000/storage/v1'
const KEY =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJPbmxpbmUgSldUIEJ1aWxkZXIiLCJpYXQiOjE2ODA5NjcxMTUsImV4cCI6MTcxMjUwMzI1MywiYXVkIjoiIiwic3ViIjoiMzE3ZWFkY2UtNjMxYS00NDI5LWEwYmItZjE5YTdhNTE3YjRhIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQifQ.NNzc54y9cZ2QLUHVSrCPOcGE2E0i8ouldc-AaWLsI08'

const storage = new StorageClient(URL, { Authorization: `Bearer ${KEY}` })
const newBucketName = `my-new-bucket-${Date.now()}`

describe('bucket api', () => {
  test('Build to succeed', async () => {
    // Basic test to ensure TS build is working.
    expect(true).toEqual(true)
  })

  test('Get all buckets', async () => {
    const res = await storage.listBuckets()
    expect(res.data).not.toBeNull()
  })

  test('Get bucket by id', async () => {
    const res = await storage.getBucket('bucket2')
    expect(res.data).toMatchSnapshot()
  })

  test('Get bucket with wrong id', async () => {
    const res = await storage.getBucket('not-exist-id')
    expect(res.error).toMatchSnapshot()
  })

  test('create new bucket', async () => {
    const res = await storage.createBucket(newBucketName)
    expect(res.data?.name).toEqual(newBucketName)
  })

  test('create new public bucket', async () => {
    const newPublicBucketName = 'my-new-public-bucket'
    await storage.createBucket(newPublicBucketName, { public: true })
    const res = await storage.getBucket(newPublicBucketName)
    expect(res.data!.public).toBe(true)
  })

  test('update bucket', async () => {
    const newBucketName = `my-new-bucket-${Date.now()}`
    await storage.createBucket(newBucketName)
    const updateRes = await storage.updateBucket(newBucketName, {
      public: true,
      fileSizeLimit: '20mb',
      allowedMimeTypes: ['image/jpeg'],
    })
    expect(updateRes.error).toBeNull()
    expect(updateRes.data).toMatchSnapshot()
    const getRes = await storage.getBucket(newBucketName)
    expect(getRes.data!.public).toBe(true)
    expect(getRes.data!.file_size_limit).toBe(20000000)
    expect(getRes.data!.allowed_mime_types).toEqual(['image/jpeg'])
  })

  test('partially update bucket', async () => {
    const newBucketName = `my-new-bucket-${Date.now()}`
    await storage.createBucket(newBucketName, {
      public: true,
      fileSizeLimit: '20mb',
      allowedMimeTypes: ['image/jpeg'],
    })
    const updateRes = await storage.updateBucket(newBucketName, { public: false })
    expect(updateRes.error).toBeNull()
    expect(updateRes.data).toMatchSnapshot()
    const getRes = await storage.getBucket(newBucketName)
    expect(getRes.data!.public).toBe(false)
    expect(getRes.data!.file_size_limit).toBe(20000000)
    expect(getRes.data!.allowed_mime_types).toEqual(['image/jpeg'])
  })

  test('empty bucket', async () => {
    const res = await storage.emptyBucket(newBucketName)
    expect(res.error).toBeNull()
    expect(res.data).toMatchSnapshot()
  })

  test('delete bucket', async () => {
    const res = await storage.deleteBucket(newBucketName)
    expect(res.error).toBeNull()
    expect(res.data).toMatchSnapshot()
  })
})
