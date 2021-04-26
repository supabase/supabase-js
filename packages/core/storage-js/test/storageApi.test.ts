import { StorageBucketApi } from '../src/lib'

// TODO: need to setup storage-api server for this test
const URL = 'http://localhost:8000/storage/v1'
const KEY =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTYwMzk2ODgzNCwiZXhwIjoyNTUwNjUzNjM0LCJhdWQiOiIiLCJzdWIiOiIiLCJSb2xlIjoicG9zdGdyZXMifQ.magCcozTMKNrl76Tj2dsM7XTl_YH0v0ilajzAvIlw3U'

const storage = new StorageBucketApi(URL, { Authorization: `Bearer ${KEY}` })
const newBucketName = `my-new-bucket-${Date.now()}`
let createdBucketId = ''

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
  console.log(res.error)
  console.log(res.data)
  createdBucketId = res.data!.id
  expect(res.data!.name).toEqual(newBucketName)
})

// test('empty bucket', async () => {
//   const res = await storage.emptyBucket(createdBucketId)
//   expect(res.data).toMatchSnapshot()
// })

// test('delete bucket', async () => {
//   const res = await storage.deleteBucket(createdBucketId)
//   expect(res.data).toMatchSnapshot()
// })
