/**
 * @jest-environment node
 */

import { StorageClient } from '../src/index'
import * as fs from 'fs'
import * as path from 'path'

// Supabase CLI local development defaults
const URL = 'http://127.0.0.1:54321/storage/v1'
// service_role key - bypasses RLS for testing
const KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

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
