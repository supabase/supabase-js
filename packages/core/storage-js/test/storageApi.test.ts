import { StorageClient } from '../src/index'

// TODO: need to setup storage-api server for this test
const URL = 'http://localhost:8000/storage/v1'
const KEY =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTYwMzk2ODgzNCwiZXhwIjoyNTUwNjUzNjM0LCJhdWQiOiIiLCJzdWIiOiIzMTdlYWRjZS02MzFhLTQ0MjktYTBiYi1mMTlhN2E1MTdiNGEiLCJSb2xlIjoicG9zdGdyZXMifQ.pZobPtp6gDcX0UbzMmG3FHSlg4m4Q-22tKtGWalOrNo'

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
    const updateRes = await storage.updateBucket(newBucketName, { public: true })
    expect(updateRes.error).toBeNull()
    expect(updateRes.data).toMatchSnapshot()
    const getRes = await storage.getBucket(newBucketName)
    expect(getRes.data!.public).toBe(true)
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
