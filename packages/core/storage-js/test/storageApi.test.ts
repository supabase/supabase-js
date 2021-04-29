import { StorageBucketApi } from '../src/lib'

// TODO: need to setup storage-api server for this test
const URL = 'http://localhost:8000/storage/v1'
const KEY =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTYwMzk2ODgzNCwiZXhwIjoyNTUwNjUzNjM0LCJhdWQiOiIiLCJzdWIiOiIzMTdlYWRjZS02MzFhLTQ0MjktYTBiYi1mMTlhN2E1MTdiNGEiLCJSb2xlIjoicG9zdGdyZXMifQ.pZobPtp6gDcX0UbzMmG3FHSlg4m4Q-22tKtGWalOrNo'

const storage = new StorageBucketApi(URL, { Authorization: `Bearer ${KEY}` })
const newBucketName = `my-new-bucket-${Date.now()}`

test('Build to succeed', async () => {
  // Basic test to ensure TS build is working.
  expect(true).toEqual(true)
})

test('Get all buckets', async () => {
  const res = await storage.listBuckets()
  expect(res.data).not.toBeNull()
  expect(res.data).toMatchSnapshot()
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
  expect(res.data).toEqual(newBucketName)
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
