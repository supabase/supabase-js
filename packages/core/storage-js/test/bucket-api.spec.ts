/**
 * Integration tests for Vector Bucket API
 * Tests all bucket operations: create, get, list, delete
 */

import {
  createTestClient,
  setupTest,
  generateTestName,
  assertSuccessResponse,
  assertErrorResponse,
  assertErrorCode,
} from './helpers'

describe('VectorBucketApi Integration Tests', () => {
  let client: ReturnType<typeof createTestClient>

  beforeEach(() => {
    setupTest()
    client = createTestClient()
  })

  describe('createBucket', () => {
    it('should create a new vector bucket successfully', async () => {
      const bucketName = generateTestName('test-bucket')

      const response = await client.createBucket(bucketName)

      assertSuccessResponse(response)
      expect(response.data).toEqual({})
    })

    it('should return conflict error when bucket already exists', async () => {
      const bucketName = generateTestName('test-bucket')

      // Create bucket first time
      await client.createBucket(bucketName)

      // Try to create again
      const response = await client.createBucket(bucketName)

      const error = assertErrorResponse(response)
      assertErrorCode(error, 409)
      expect(error.message).toContain('already exists')
    })

    it('should create multiple buckets with different names', async () => {
      const bucket1 = generateTestName('test-bucket-1')
      const bucket2 = generateTestName('test-bucket-2')

      const response1 = await client.createBucket(bucket1)
      const response2 = await client.createBucket(bucket2)

      assertSuccessResponse(response1)
      assertSuccessResponse(response2)
    })
  })

  describe('getBucket', () => {
    it('should retrieve an existing bucket', async () => {
      const bucketName = generateTestName('test-bucket')

      // Create bucket
      await client.createBucket(bucketName)

      // Retrieve bucket
      const response = await client.getBucket(bucketName)

      const data = assertSuccessResponse(response)
      expect(data.vectorBucket).toBeDefined()
      expect(data.vectorBucket.vectorBucketName).toBe(bucketName)
      expect(data.vectorBucket.creationTime).toBeDefined()
      expect(typeof data.vectorBucket.creationTime).toBe('number')
    })

    it('should return not found error for non-existent bucket', async () => {
      const response = await client.getBucket('non-existent-bucket')

      const error = assertErrorResponse(response)
      assertErrorCode(error, 404)
      expect(error.message).toContain('not found')
    })

    it('should return bucket with encryption configuration if set', async () => {
      const bucketName = generateTestName('test-bucket')

      await client.createBucket(bucketName)
      const response = await client.getBucket(bucketName)

      const data = assertSuccessResponse(response)
      // Encryption configuration is optional
      if (data.vectorBucket.encryptionConfiguration) {
        expect(data.vectorBucket.encryptionConfiguration).toHaveProperty('sseType')
      }
    })
  })

  describe('listBuckets', () => {
    it('should list all buckets', async () => {
      const bucket1 = generateTestName('test-bucket-1')
      const bucket2 = generateTestName('test-bucket-2')

      await client.createBucket(bucket1)
      await client.createBucket(bucket2)

      const response = await client.listBuckets()

      const data = assertSuccessResponse(response)
      expect(data.vectorBuckets).toBeDefined()
      expect(Array.isArray(data.vectorBuckets)).toBe(true)
      expect(data.vectorBuckets.length).toBeGreaterThanOrEqual(2)

      const bucketNames = data.vectorBuckets.map((b) => b.vectorBucketName)
      expect(bucketNames).toContain(bucket1)
      expect(bucketNames).toContain(bucket2)
    })

    it('should filter buckets by prefix', async () => {
      const prefix = generateTestName('prefix-test')
      const bucket1 = `${prefix}-bucket-1`
      const bucket2 = `${prefix}-bucket-2`
      const bucket3 = generateTestName('other-bucket')

      await client.createBucket(bucket1)
      await client.createBucket(bucket2)
      await client.createBucket(bucket3)

      const response = await client.listBuckets({ prefix })

      const data = assertSuccessResponse(response)
      expect(data.vectorBuckets.length).toBeGreaterThanOrEqual(2)

      const bucketNames = data.vectorBuckets.map((b) => b.vectorBucketName)
      expect(bucketNames).toContain(bucket1)
      expect(bucketNames).toContain(bucket2)
      // bucket3 should not be included as it doesn't match prefix
      const hasOtherBucket = bucketNames.some((name) => name.includes('other-bucket'))
      if (hasOtherBucket) {
        // If other buckets exist, they should match the prefix
        expect(bucketNames.every((name) => name.startsWith(prefix))).toBe(true)
      }
    })

    it('should support pagination with maxResults', async () => {
      const response = await client.listBuckets({ maxResults: 1 })

      const data = assertSuccessResponse(response)
      expect(data.vectorBuckets.length).toBeLessThanOrEqual(1)

      if (data.vectorBuckets.length === 1 && data.nextToken) {
        expect(data.nextToken).toBeDefined()
        expect(typeof data.nextToken).toBe('string')
      }
    })

    it('should return empty array when no buckets match prefix', async () => {
      const response = await client.listBuckets({
        prefix: 'non-existent-prefix-' + Date.now(),
      })

      const data = assertSuccessResponse(response)
      expect(data.vectorBuckets).toEqual([])
      expect(data.nextToken).toBeUndefined()
    })
  })

  describe('deleteBucket', () => {
    it('should delete an empty bucket successfully', async () => {
      const bucketName = generateTestName('test-bucket')

      await client.createBucket(bucketName)

      const response = await client.deleteBucket(bucketName)

      assertSuccessResponse(response)
      expect(response.data).toEqual({})

      // Verify bucket is deleted
      const getResponse = await client.getBucket(bucketName)
      assertErrorResponse(getResponse)
    })

    it('should return not found error for non-existent bucket', async () => {
      const response = await client.deleteBucket('non-existent-bucket')

      const error = assertErrorResponse(response)
      assertErrorCode(error, 404)
    })

    it('should return error when bucket is not empty', async () => {
      const bucketName = generateTestName('test-bucket')

      await client.createBucket(bucketName)

      // Create an index in the bucket
      const bucket = client.from(bucketName)
      await bucket.createIndex({
        indexName: 'test-index',
        dataType: 'float32',
        dimension: 3,
        distanceMetric: 'cosine',
      })

      // Try to delete bucket with index
      const response = await client.deleteBucket(bucketName)

      const error = assertErrorResponse(response)
      assertErrorCode(error, 400)
      expect(error.message).toContain('not empty')
    })

    it('should successfully delete bucket after removing all indexes', async () => {
      const bucketName = generateTestName('test-bucket')

      await client.createBucket(bucketName)

      const bucket = client.from(bucketName)
      await bucket.createIndex({
        indexName: 'test-index',
        dataType: 'float32',
        dimension: 3,
        distanceMetric: 'cosine',
      })

      // Delete the index first
      await bucket.deleteIndex('test-index')

      // Now delete the bucket
      const response = await client.deleteBucket(bucketName)

      assertSuccessResponse(response)
    })
  })

  describe('throwOnError mode', () => {
    it('should throw error instead of returning error response', async () => {
      client.throwOnError()

      await expect(client.getBucket('non-existent-bucket')).rejects.toThrow()
    })

    it('should still return data on success', async () => {
      const bucketName = generateTestName('test-bucket')
      client.throwOnError()

      await client.createBucket(bucketName)
      const response = await client.getBucket(bucketName)

      expect(response.data).toBeDefined()
      expect(response.error).toBeNull()
    })
  })

  describe('VectorBucketScope (from)', () => {
    it('should create a bucket scope successfully', async () => {
      const bucketName = generateTestName('test-bucket')

      await client.createBucket(bucketName)

      const bucketScope = client.from(bucketName)

      expect(bucketScope).toBeDefined()
      expect(typeof bucketScope.createIndex).toBe('function')
      expect(typeof bucketScope.listIndexes).toBe('function')
      expect(typeof bucketScope.index).toBe('function')
    })
  })
})
