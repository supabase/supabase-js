/**
 * Integration tests for Vector Index API
 * Tests all index operations: create, get, list, delete
 */

import {
  createTestClient,
  setupTest,
  generateTestName,
  assertSuccessResponse,
  assertErrorResponse,
  assertErrorCode,
} from './helpers'

describe('VectorIndexApi Integration Tests', () => {
  let client: ReturnType<typeof createTestClient>
  let testBucket: string

  beforeEach(async () => {
    setupTest()
    client = createTestClient()
    testBucket = generateTestName('test-bucket')
    await client.createBucket(testBucket)
  })

  describe('createIndex', () => {
    it('should create a new index with all required parameters', async () => {
      const indexName = generateTestName('test-index')
      const bucket = client.from(testBucket)

      const response = await bucket.createIndex({
        indexName,
        dataType: 'float32',
        dimension: 1536,
        distanceMetric: 'cosine',
      })

      assertSuccessResponse(response)
      expect(response.data).toEqual({})
    })

    it('should create index with euclidean distance metric', async () => {
      const indexName = generateTestName('test-index')
      const bucket = client.from(testBucket)

      const response = await bucket.createIndex({
        indexName,
        dataType: 'float32',
        dimension: 768,
        distanceMetric: 'euclidean',
      })

      assertSuccessResponse(response)
    })

    it('should create index with dotproduct distance metric', async () => {
      const indexName = generateTestName('test-index')
      const bucket = client.from(testBucket)

      const response = await bucket.createIndex({
        indexName,
        dataType: 'float32',
        dimension: 384,
        distanceMetric: 'dotproduct',
      })

      assertSuccessResponse(response)
    })

    it('should create index with metadata configuration', async () => {
      const indexName = generateTestName('test-index')
      const bucket = client.from(testBucket)

      const response = await bucket.createIndex({
        indexName,
        dataType: 'float32',
        dimension: 1536,
        distanceMetric: 'cosine',
        metadataConfiguration: {
          nonFilterableMetadataKeys: ['raw_text', 'internal_id'],
        },
      })

      assertSuccessResponse(response)
    })

    it('should return conflict error when index already exists', async () => {
      const indexName = generateTestName('test-index')
      const bucket = client.from(testBucket)

      // Create index first time
      await bucket.createIndex({
        indexName,
        dataType: 'float32',
        dimension: 3,
        distanceMetric: 'cosine',
      })

      // Try to create again
      const response = await bucket.createIndex({
        indexName,
        dataType: 'float32',
        dimension: 3,
        distanceMetric: 'cosine',
      })

      const error = assertErrorResponse(response)
      assertErrorCode(error, 409)
      expect(error.message).toContain('already exists')
    })

    it('should return not found error when bucket does not exist', async () => {
      const bucket = client.from('non-existent-bucket')

      const response = await bucket.createIndex({
        indexName: 'test-index',
        dataType: 'float32',
        dimension: 3,
        distanceMetric: 'cosine',
      })

      const error = assertErrorResponse(response)
      assertErrorCode(error, 404)
    })

    it('should create multiple indexes in the same bucket', async () => {
      const index1 = generateTestName('test-index-1')
      const index2 = generateTestName('test-index-2')
      const bucket = client.from(testBucket)

      const response1 = await bucket.createIndex({
        indexName: index1,
        dataType: 'float32',
        dimension: 3,
        distanceMetric: 'cosine',
      })

      const response2 = await bucket.createIndex({
        indexName: index2,
        dataType: 'float32',
        dimension: 5,
        distanceMetric: 'euclidean',
      })

      assertSuccessResponse(response1)
      assertSuccessResponse(response2)
    })

    it('should create indexes with different dimensions', async () => {
      const dimensions = [3, 128, 384, 768, 1536, 3072]
      const bucket = client.from(testBucket)

      for (const dim of dimensions) {
        const indexName = generateTestName(`test-index-${dim}`)
        const response = await bucket.createIndex({
          indexName,
          dataType: 'float32',
          dimension: dim,
          distanceMetric: 'cosine',
        })

        assertSuccessResponse(response)
      }
    })
  })

  describe('getIndex', () => {
    it('should retrieve an existing index', async () => {
      const indexName = generateTestName('test-index')
      const bucket = client.from(testBucket)

      await bucket.createIndex({
        indexName,
        dataType: 'float32',
        dimension: 1536,
        distanceMetric: 'cosine',
      })

      const response = await bucket.getIndex(indexName)

      const data = assertSuccessResponse(response)
      expect(data.index).toBeDefined()
      expect(data.index.indexName).toBe(indexName)
      expect(data.index.vectorBucketName).toBe(testBucket)
      expect(data.index.dataType).toBe('float32')
      expect(data.index.dimension).toBe(1536)
      expect(data.index.distanceMetric).toBe('cosine')
      expect(data.index.creationTime).toBeDefined()
      expect(typeof data.index.creationTime).toBe('number')
    })

    it('should retrieve index with metadata configuration', async () => {
      const indexName = generateTestName('test-index')
      const bucket = client.from(testBucket)

      await bucket.createIndex({
        indexName,
        dataType: 'float32',
        dimension: 768,
        distanceMetric: 'euclidean',
        metadataConfiguration: {
          nonFilterableMetadataKeys: ['raw_text'],
        },
      })

      const response = await bucket.getIndex(indexName)

      const data = assertSuccessResponse(response)
      expect(data.index.metadataConfiguration).toBeDefined()
      expect(data.index.metadataConfiguration?.nonFilterableMetadataKeys).toContain('raw_text')
    })

    it('should return not found error for non-existent index', async () => {
      const bucket = client.from(testBucket)
      const response = await bucket.getIndex('non-existent-index')

      const error = assertErrorResponse(response)
      assertErrorCode(error, 404)
    })

    it('should return not found error when bucket does not exist', async () => {
      const bucket = client.from('non-existent-bucket')
      const response = await bucket.getIndex('test-index')

      const error = assertErrorResponse(response)
      assertErrorCode(error, 404)
    })
  })

  describe('listIndexes', () => {
    it('should list all indexes in a bucket', async () => {
      const index1 = generateTestName('test-index-1')
      const index2 = generateTestName('test-index-2')
      const bucket = client.from(testBucket)

      await bucket.createIndex({
        indexName: index1,
        dataType: 'float32',
        dimension: 3,
        distanceMetric: 'cosine',
      })

      await bucket.createIndex({
        indexName: index2,
        dataType: 'float32',
        dimension: 3,
        distanceMetric: 'cosine',
      })

      const response = await bucket.listIndexes()

      const data = assertSuccessResponse(response)
      expect(data.indexes).toBeDefined()
      expect(Array.isArray(data.indexes)).toBe(true)
      expect(data.indexes.length).toBeGreaterThanOrEqual(2)

      const indexNames = data.indexes.map((i) => i.indexName)
      expect(indexNames).toContain(index1)
      expect(indexNames).toContain(index2)
    })

    it('should filter indexes by prefix', async () => {
      const prefix = generateTestName('prefix-test')
      const index1 = `${prefix}-index-1`
      const index2 = `${prefix}-index-2`
      const index3 = generateTestName('other-index')
      const bucket = client.from(testBucket)

      await bucket.createIndex({
        indexName: index1,
        dataType: 'float32',
        dimension: 3,
        distanceMetric: 'cosine',
      })

      await bucket.createIndex({
        indexName: index2,
        dataType: 'float32',
        dimension: 3,
        distanceMetric: 'cosine',
      })

      await bucket.createIndex({
        indexName: index3,
        dataType: 'float32',
        dimension: 3,
        distanceMetric: 'cosine',
      })

      const response = await bucket.listIndexes({ prefix })

      const data = assertSuccessResponse(response)
      expect(data.indexes.length).toBeGreaterThanOrEqual(2)

      const indexNames = data.indexes.map((i) => i.indexName)
      expect(indexNames).toContain(index1)
      expect(indexNames).toContain(index2)
    })

    it('should support pagination with maxResults', async () => {
      const bucket = client.from(testBucket)

      // Create multiple indexes
      for (let i = 0; i < 3; i++) {
        await bucket.createIndex({
          indexName: generateTestName(`test-index-${i}`),
          dataType: 'float32',
          dimension: 3,
          distanceMetric: 'cosine',
        })
      }

      const response = await bucket.listIndexes({ maxResults: 1 })

      const data = assertSuccessResponse(response)
      expect(data.indexes.length).toBeLessThanOrEqual(1)

      if (data.indexes.length === 1 && data.nextToken) {
        expect(data.nextToken).toBeDefined()
        expect(typeof data.nextToken).toBe('string')
      }
    })

    it('should return empty array when no indexes exist', async () => {
      const emptyBucket = generateTestName('empty-bucket')
      await client.createBucket(emptyBucket)

      const bucket = client.from(emptyBucket)
      const response = await bucket.listIndexes()

      const data = assertSuccessResponse(response)
      expect(data.indexes).toEqual([])
    })

    it('should return not found error when bucket does not exist', async () => {
      const bucket = client.from('non-existent-bucket')
      const response = await bucket.listIndexes()

      const error = assertErrorResponse(response)
      assertErrorCode(error, 404)
    })
  })

  describe('deleteIndex', () => {
    it('should delete an index successfully', async () => {
      const indexName = generateTestName('test-index')
      const bucket = client.from(testBucket)

      await bucket.createIndex({
        indexName,
        dataType: 'float32',
        dimension: 3,
        distanceMetric: 'cosine',
      })

      const response = await bucket.deleteIndex(indexName)

      assertSuccessResponse(response)
      expect(response.data).toEqual({})

      // Verify index is deleted
      const getResponse = await bucket.getIndex(indexName)
      assertErrorResponse(getResponse)
    })

    it('should delete index with vectors', async () => {
      const indexName = generateTestName('test-index')
      const bucket = client.from(testBucket)
      const index = bucket.index(indexName)

      await bucket.createIndex({
        indexName,
        dataType: 'float32',
        dimension: 3,
        distanceMetric: 'cosine',
      })

      // Add some vectors
      await index.putVectors({
        vectors: [
          { key: 'vec-1', data: { float32: [0.1, 0.2, 0.3] } },
          { key: 'vec-2', data: { float32: [0.4, 0.5, 0.6] } },
        ],
      })

      // Delete index (should delete vectors too)
      const response = await bucket.deleteIndex(indexName)

      assertSuccessResponse(response)
    })

    it('should return not found error for non-existent index', async () => {
      const bucket = client.from(testBucket)
      const response = await bucket.deleteIndex('non-existent-index')

      const error = assertErrorResponse(response)
      assertErrorCode(error, 404)
    })

    it('should return not found error when bucket does not exist', async () => {
      const bucket = client.from('non-existent-bucket')
      const response = await bucket.deleteIndex('test-index')

      const error = assertErrorResponse(response)
      assertErrorCode(error, 404)
    })
  })

  describe('VectorIndexScope (index)', () => {
    it('should create an index scope successfully', async () => {
      const indexName = generateTestName('test-index')
      const bucket = client.from(testBucket)

      await bucket.createIndex({
        indexName,
        dataType: 'float32',
        dimension: 3,
        distanceMetric: 'cosine',
      })

      const indexScope = bucket.index(indexName)

      expect(indexScope).toBeDefined()
      expect(typeof indexScope.putVectors).toBe('function')
      expect(typeof indexScope.getVectors).toBe('function')
      expect(typeof indexScope.listVectors).toBe('function')
      expect(typeof indexScope.queryVectors).toBe('function')
      expect(typeof indexScope.deleteVectors).toBe('function')
    })
  })
})
