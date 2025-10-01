/**
 * @jest-environment node
 */

import { StorageClient } from '../src/index'
import * as fs from 'fs'
import * as path from 'path'

const URL = 'http://localhost:8000/storage/v1'
const KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCIsInN1YiI6IjMxN2VhZGNlLTYzMWEtNDQyOS1hMGJiLWYxOWE3YTUxN2I0YSIsImlhdCI6MTcxMzQzMzgwMCwiZXhwIjoyMDI5MDA5ODAwfQ.jVFIR-MB7rNfUuJaUH-_CyDFZEHezzXiqcRcdrGd29o'

const storage = new StorageClient(URL, { Authorization: `Bearer ${KEY}` })

const newBucket = async (isPublic = true, prefix = '') => {
  const bucketName = `${prefix ? prefix + '-' : ''}bucket-${Date.now()}`
  await storage.createBucket(bucketName, { public: isPublic })
  return bucketName
}

const uploadFilePath = (fileName: string) => path.resolve(__dirname, 'fixtures', 'upload', fileName)

describe('Object API', () => {
  let bucketName: string
  beforeEach(async () => {
    bucketName = await newBucket()
  })

  describe('Stream handling in node', () => {
    test('uploading stream with duplex option', async () => {
      const file = await fs.createReadStream(uploadFilePath('file.txt'))
      const uploadPathWithDuplex = `testpath/file-duplex-${Date.now()}.txt`

      const res = await storage.from(bucketName).upload(uploadPathWithDuplex, file, {
        duplex: 'half',
      })
      expect(res.error).toBeNull()
      expect(res.data?.path).toEqual(uploadPathWithDuplex)
    })
  })
})
