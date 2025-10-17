/**
 * Integration tests for Vector Data API
 * Tests all vector operations: put, get, list, query, delete
 */

import {
  createTestClient,
  setupTest,
  generateTestName,
  generateRandomVector,
  assertSuccessResponse,
  assertErrorResponse,
  assertErrorCode,
} from './helpers'

describe('VectorDataApi Integration Tests', () => {
  let client: ReturnType<typeof createTestClient>
  let testBucket: string
  let testIndex: string

  beforeEach(async () => {
    setupTest()
    client = createTestClient()
    testBucket = generateTestName('test-bucket')
    testIndex = generateTestName('test-index')

    await client.createBucket(testBucket)
    const bucket = client.from(testBucket)
    await bucket.createIndex({
      indexName: testIndex,
      dataType: 'float32',
      dimension: 3,
      distanceMetric: 'cosine',
    })
  })

  describe('putVectors', () => {
    it('should insert a single vector successfully', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.putVectors({
        vectors: [
          {
            key: 'vector-1',
            data: { float32: [0.1, 0.2, 0.3] },
            metadata: { title: 'Test Vector' },
          },
        ],
      })

      assertSuccessResponse(response)
      expect(response.data).toEqual({})
    })

    it('should insert multiple vectors in batch', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.putVectors({
        vectors: [
          { key: 'vec-1', data: { float32: [0.1, 0.2, 0.3] }, metadata: { id: 1 } },
          { key: 'vec-2', data: { float32: [0.4, 0.5, 0.6] }, metadata: { id: 2 } },
          { key: 'vec-3', data: { float32: [0.7, 0.8, 0.9] }, metadata: { id: 3 } },
        ],
      })

      assertSuccessResponse(response)
    })

    it('should insert vector without metadata', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.putVectors({
        vectors: [{ key: 'vec-no-meta', data: { float32: [0.1, 0.2, 0.3] } }],
      })

      assertSuccessResponse(response)
    })

    it('should upsert (update existing vector)', async () => {
      const index = client.from(testBucket).index(testIndex)

      // Insert first time
      await index.putVectors({
        vectors: [
          {
            key: 'vec-1',
            data: { float32: [0.1, 0.2, 0.3] },
            metadata: { version: 1 },
          },
        ],
      })

      // Update same key
      const response = await index.putVectors({
        vectors: [
          {
            key: 'vec-1',
            data: { float32: [0.4, 0.5, 0.6] },
            metadata: { version: 2 },
          },
        ],
      })

      assertSuccessResponse(response)

      // Verify updated
      const getResponse = await index.getVectors({
        keys: ['vec-1'],
        returnData: true,
        returnMetadata: true,
      })

      const data = assertSuccessResponse(getResponse)
      expect(data.vectors[0].metadata?.version).toBe(2)
    })

    it('should insert vectors with complex metadata', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.putVectors({
        vectors: [
          {
            key: 'complex-meta',
            data: { float32: [0.1, 0.2, 0.3] },
            metadata: {
              title: 'Document Title',
              category: 'tech',
              tags: ['ai', 'ml', 'vectors'],
              published: true,
              score: 4.5,
              nested: { field: 'value' },
            },
          },
        ],
      })

      assertSuccessResponse(response)
    })

    it('should return not found error when bucket does not exist', async () => {
      const index = client.from('non-existent-bucket').index(testIndex)

      const response = await index.putVectors({
        vectors: [{ key: 'vec-1', data: { float32: [0.1, 0.2, 0.3] } }],
      })

      const error = assertErrorResponse(response)
      assertErrorCode(error, 404)
    })

    it('should return not found error when index does not exist', async () => {
      const index = client.from(testBucket).index('non-existent-index')

      const response = await index.putVectors({
        vectors: [{ key: 'vec-1', data: { float32: [0.1, 0.2, 0.3] } }],
      })

      const error = assertErrorResponse(response)
      assertErrorCode(error, 404)
    })

    it('should handle batch size limits', async () => {
      const index = client.from(testBucket).index(testIndex)

      // Create a large batch (500 vectors)
      const vectors = Array.from({ length: 500 }, (_, i) => ({
        key: `vec-${i}`,
        data: { float32: generateRandomVector(3) },
      }))

      const response = await index.putVectors({ vectors })

      assertSuccessResponse(response)
    })
  })

  describe('getVectors', () => {
    beforeEach(async () => {
      const index = client.from(testBucket).index(testIndex)

      // Insert test vectors
      await index.putVectors({
        vectors: [
          {
            key: 'vec-1',
            data: { float32: [0.1, 0.2, 0.3] },
            metadata: { title: 'Vector 1' },
          },
          {
            key: 'vec-2',
            data: { float32: [0.4, 0.5, 0.6] },
            metadata: { title: 'Vector 2' },
          },
          {
            key: 'vec-3',
            data: { float32: [0.7, 0.8, 0.9] },
            metadata: { title: 'Vector 3' },
          },
        ],
      })
    })

    it('should retrieve vectors by keys', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.getVectors({
        keys: ['vec-1', 'vec-2'],
        returnData: true,
        returnMetadata: true,
      })

      const data = assertSuccessResponse(response)
      expect(data.vectors).toBeDefined()
      expect(data.vectors.length).toBe(2)

      const keys = data.vectors.map((v) => v.key)
      expect(keys).toContain('vec-1')
      expect(keys).toContain('vec-2')
    })

    it('should retrieve vectors with data', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.getVectors({
        keys: ['vec-1'],
        returnData: true,
        returnMetadata: false,
      })

      const data = assertSuccessResponse(response)
      expect(data.vectors[0].data).toBeDefined()
      expect(data.vectors[0].data?.float32).toEqual([0.1, 0.2, 0.3])
      expect(data.vectors[0].metadata).toBeUndefined()
    })

    it('should retrieve vectors with metadata only', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.getVectors({
        keys: ['vec-1'],
        returnData: false,
        returnMetadata: true,
      })

      const data = assertSuccessResponse(response)
      expect(data.vectors[0].data).toBeUndefined()
      expect(data.vectors[0].metadata).toBeDefined()
      expect(data.vectors[0].metadata?.title).toBe('Vector 1')
    })

    it('should retrieve vectors with keys only', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.getVectors({
        keys: ['vec-1'],
        returnData: false,
        returnMetadata: false,
      })

      const data = assertSuccessResponse(response)
      expect(data.vectors[0].key).toBe('vec-1')
      expect(data.vectors[0].data).toBeUndefined()
      expect(data.vectors[0].metadata).toBeUndefined()
    })

    it('should return empty array for non-existent keys', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.getVectors({
        keys: ['non-existent-key'],
        returnData: true,
        returnMetadata: true,
      })

      const data = assertSuccessResponse(response)
      expect(data.vectors).toEqual([])
    })

    it('should retrieve mix of existing and non-existent keys', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.getVectors({
        keys: ['vec-1', 'non-existent', 'vec-2'],
        returnData: true,
        returnMetadata: true,
      })

      const data = assertSuccessResponse(response)
      expect(data.vectors.length).toBe(2)

      const keys = data.vectors.map((v) => v.key)
      expect(keys).toContain('vec-1')
      expect(keys).toContain('vec-2')
      expect(keys).not.toContain('non-existent')
    })
  })

  describe('listVectors', () => {
    beforeEach(async () => {
      const index = client.from(testBucket).index(testIndex)

      // Insert multiple vectors
      await index.putVectors({
        vectors: Array.from({ length: 10 }, (_, i) => ({
          key: `vec-${i}`,
          data: { float32: generateRandomVector(3) },
          metadata: { index: i },
        })),
      })
    })

    it('should list all vectors in index', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.listVectors({
        returnData: true,
        returnMetadata: true,
      })

      const data = assertSuccessResponse(response)
      expect(data.vectors).toBeDefined()
      expect(data.vectors.length).toBeGreaterThanOrEqual(10)
    })

    it('should list vectors with data', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.listVectors({
        returnData: true,
        returnMetadata: false,
      })

      const data = assertSuccessResponse(response)
      expect(data.vectors[0].data).toBeDefined()
      expect(data.vectors[0].metadata).toBeUndefined()
    })

    it('should list vectors with metadata only', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.listVectors({
        returnData: false,
        returnMetadata: true,
      })

      const data = assertSuccessResponse(response)
      expect(data.vectors[0].data).toBeUndefined()
      expect(data.vectors[0].metadata).toBeDefined()
    })

    it('should support pagination with maxResults', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.listVectors({
        maxResults: 5,
        returnMetadata: true,
      })

      const data = assertSuccessResponse(response)
      expect(data.vectors.length).toBeLessThanOrEqual(5)

      if (data.vectors.length === 5 && data.nextToken) {
        expect(data.nextToken).toBeDefined()
      }
    })

    it('should return empty array for empty index', async () => {
      const emptyIndex = generateTestName('empty-index')
      const bucket = client.from(testBucket)

      await bucket.createIndex({
        indexName: emptyIndex,
        dataType: 'float32',
        dimension: 3,
        distanceMetric: 'cosine',
      })

      const index = bucket.index(emptyIndex)
      const response = await index.listVectors()

      const data = assertSuccessResponse(response)
      expect(data.vectors).toEqual([])
    })
  })

  describe('queryVectors', () => {
    beforeEach(async () => {
      const index = client.from(testBucket).index(testIndex)

      // Insert test vectors with different metadata
      await index.putVectors({
        vectors: [
          {
            key: 'doc-1',
            data: { float32: [0.1, 0.2, 0.3] },
            metadata: { category: 'tech', published: true, score: 5 },
          },
          {
            key: 'doc-2',
            data: { float32: [0.15, 0.25, 0.35] },
            metadata: { category: 'tech', published: false, score: 3 },
          },
          {
            key: 'doc-3',
            data: { float32: [0.4, 0.5, 0.6] },
            metadata: { category: 'science', published: true, score: 4 },
          },
          {
            key: 'doc-4',
            data: { float32: [0.7, 0.8, 0.9] },
            metadata: { category: 'science', published: true, score: 5 },
          },
        ],
      })
    })

    it('should query for similar vectors', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.queryVectors({
        queryVector: { float32: [0.12, 0.22, 0.32] },
        topK: 3,
        returnMetadata: true,
      })

      const data = assertSuccessResponse(response)
      expect(data.matches).toBeDefined()
      expect(Array.isArray(data.matches)).toBe(true)
      expect(data.matches.length).toBeGreaterThan(0)
      expect(data.matches.length).toBeLessThanOrEqual(3)
    })

    it('should return vectors with distance scores', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.queryVectors({
        queryVector: { float32: [0.1, 0.2, 0.3] },
        topK: 2,
        returnDistance: true,
        returnMetadata: true,
      })

      const data = assertSuccessResponse(response)
      expect(data.matches[0].distance).toBeDefined()
      expect(typeof data.matches[0].distance).toBe('number')
    })

    it('should filter by metadata', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.queryVectors({
        queryVector: { float32: [0.1, 0.2, 0.3] },
        topK: 5,
        filter: { category: 'tech' },
        returnMetadata: true,
      })

      const data = assertSuccessResponse(response)
      expect(data.matches.length).toBeGreaterThan(0)

      // All results should match filter
      for (const match of data.matches) {
        expect(match.metadata?.category).toBe('tech')
      }
    })

    it('should filter by multiple metadata fields', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.queryVectors({
        queryVector: { float32: [0.1, 0.2, 0.3] },
        topK: 5,
        filter: { category: 'tech', published: true },
        returnMetadata: true,
      })

      const data = assertSuccessResponse(response)

      for (const match of data.matches) {
        expect(match.metadata?.category).toBe('tech')
        expect(match.metadata?.published).toBe(true)
      }
    })

    it('should respect topK parameter', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.queryVectors({
        queryVector: { float32: [0.5, 0.5, 0.5] },
        topK: 2,
      })

      const data = assertSuccessResponse(response)
      expect(data.matches.length).toBeLessThanOrEqual(2)
    })

    it('should return empty matches when filter matches nothing', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.queryVectors({
        queryVector: { float32: [0.1, 0.2, 0.3] },
        topK: 5,
        filter: { category: 'non-existent' },
      })

      const data = assertSuccessResponse(response)
      expect(data.matches).toEqual([])
    })

    it('should query without metadata in results', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.queryVectors({
        queryVector: { float32: [0.1, 0.2, 0.3] },
        topK: 3,
        returnMetadata: false,
        returnDistance: true,
      })

      const data = assertSuccessResponse(response)
      expect(data.matches[0].key).toBeDefined()
      expect(data.matches[0].metadata).toBeUndefined()
    })
  })

  describe('deleteVectors', () => {
    beforeEach(async () => {
      const index = client.from(testBucket).index(testIndex)

      // Insert test vectors
      await index.putVectors({
        vectors: [
          { key: 'vec-1', data: { float32: [0.1, 0.2, 0.3] } },
          { key: 'vec-2', data: { float32: [0.4, 0.5, 0.6] } },
          { key: 'vec-3', data: { float32: [0.7, 0.8, 0.9] } },
        ],
      })
    })

    it('should delete a single vector', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.deleteVectors({ keys: ['vec-1'] })

      assertSuccessResponse(response)
      expect(response.data).toEqual({})

      // Verify deletion
      const getResponse = await index.getVectors({ keys: ['vec-1'] })
      const data = assertSuccessResponse(getResponse)
      expect(data.vectors).toEqual([])
    })

    it('should delete multiple vectors', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.deleteVectors({
        keys: ['vec-1', 'vec-2'],
      })

      assertSuccessResponse(response)

      // Verify deletion
      const getResponse = await index.getVectors({
        keys: ['vec-1', 'vec-2', 'vec-3'],
      })
      const data = assertSuccessResponse(getResponse)
      expect(data.vectors.length).toBe(1)
      expect(data.vectors[0].key).toBe('vec-3')
    })

    it('should succeed when deleting non-existent keys', async () => {
      const index = client.from(testBucket).index(testIndex)

      const response = await index.deleteVectors({
        keys: ['non-existent-1', 'non-existent-2'],
      })

      assertSuccessResponse(response)
    })

    it('should handle batch deletion limits', async () => {
      const index = client.from(testBucket).index(testIndex)

      // Insert many vectors
      const vectors = Array.from({ length: 100 }, (_, i) => ({
        key: `batch-vec-${i}`,
        data: { float32: generateRandomVector(3) },
      }))

      await index.putVectors({ vectors })

      // Delete in batch (max 500)
      const keysToDelete = vectors.slice(0, 50).map((v) => v.key)
      const response = await index.deleteVectors({ keys: keysToDelete })

      assertSuccessResponse(response)

      // Verify deletion
      const getResponse = await index.getVectors({ keys: keysToDelete })
      const data = assertSuccessResponse(getResponse)
      expect(data.vectors).toEqual([])
    })

    it('should return not found error when bucket does not exist', async () => {
      const index = client.from('non-existent-bucket').index(testIndex)

      const response = await index.deleteVectors({ keys: ['vec-1'] })

      const error = assertErrorResponse(response)
      assertErrorCode(error, 404)
    })

    it('should return not found error when index does not exist', async () => {
      const index = client.from(testBucket).index('non-existent-index')

      const response = await index.deleteVectors({ keys: ['vec-1'] })

      const error = assertErrorResponse(response)
      assertErrorCode(error, 404)
    })
  })

  describe('Batch operations', () => {
    it('should handle large batch inserts efficiently', async () => {
      const index = client.from(testBucket).index(testIndex)

      // Insert 500 vectors (max batch size)
      const vectors = Array.from({ length: 500 }, (_, i) => ({
        key: `large-batch-${i}`,
        data: { float32: generateRandomVector(3) },
        metadata: { batch: 'large', index: i },
      }))

      const response = await index.putVectors({ vectors })

      assertSuccessResponse(response)

      // Verify some vectors were inserted
      const getResponse = await index.getVectors({
        keys: ['large-batch-0', 'large-batch-100', 'large-batch-499'],
      })

      const data = assertSuccessResponse(getResponse)
      expect(data.vectors.length).toBe(3)
    })
  })
})
