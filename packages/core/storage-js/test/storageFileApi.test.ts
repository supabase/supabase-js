import { StorageClient } from '../src/index'

// TODO: need to setup storage-api server for this test
const URL = 'http://localhost:8000/storage/v1'
const KEY =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTYwMzk2ODgzNCwiZXhwIjoyNTUwNjUzNjM0LCJhdWQiOiIiLCJzdWIiOiIzMTdlYWRjZS02MzFhLTQ0MjktYTBiYi1mMTlhN2E1MTdiNGEiLCJSb2xlIjoicG9zdGdyZXMifQ.pZobPtp6gDcX0UbzMmG3FHSlg4m4Q-22tKtGWalOrNo'

const storage = new StorageClient(URL, { Authorization: `Bearer ${KEY}` })
const newBucketName = 'my-new-public-bucket'

test('get public URL', async () => {
  const res = storage.from(newBucketName).getPublicUrl('profiles/myUniqueUserId/profile.png')
  expect(res.error).toBeNull()
  expect(res.data).toMatchSnapshot()
  expect(res.publicURL).toMatchSnapshot()
})
