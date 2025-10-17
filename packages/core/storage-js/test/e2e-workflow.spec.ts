/**
 * End-to-end workflow integration tests
 * Tests complete workflows from bucket creation to vector operations
 */

import {
  createTestClient,
  setupTest,
  generateTestName,
  generateRandomVector,
  assertSuccessResponse,
} from './helpers'

describe('End-to-End Workflow Tests', () => {
  let client: ReturnType<typeof createTestClient>

  beforeEach(() => {
    setupTest()
    client = createTestClient()
  })

  describe('Complete Vector Search Workflow', () => {
    it('should complete full workflow: create bucket, index, insert, query, delete', async () => {
      const bucketName = generateTestName('e2e-bucket')
      const indexName = generateTestName('e2e-index')

      // Step 1: Create bucket
      const createBucketResponse = await client.createBucket(bucketName)
      assertSuccessResponse(createBucketResponse)

      // Step 2: Verify bucket exists
      const getBucketResponse = await client.getBucket(bucketName)
      const bucketData = assertSuccessResponse(getBucketResponse)
      expect(bucketData.vectorBucket.vectorBucketName).toBe(bucketName)

      // Step 3: Create index
      const bucket = client.from(bucketName)
      const createIndexResponse = await bucket.createIndex({
        indexName,
        dataType: 'float32',
        dimension: 384,
        distanceMetric: 'cosine',
        metadataConfiguration: {
          nonFilterableMetadataKeys: ['raw_text'],
        },
      })
      assertSuccessResponse(createIndexResponse)

      // Step 4: Verify index exists
      const getIndexResponse = await bucket.getIndex(indexName)
      const indexData = assertSuccessResponse(getIndexResponse)
      expect(indexData.index.indexName).toBe(indexName)
      expect(indexData.index.dimension).toBe(384)
      expect(indexData.index.distanceMetric).toBe('cosine')

      // Step 5: Insert vectors
      const index = bucket.index(indexName)
      const documents = [
        {
          key: 'doc-1',
          data: { float32: generateRandomVector(384) },
          metadata: {
            title: 'Introduction to Vector Databases',
            category: 'tech',
            published: true,
          },
        },
        {
          key: 'doc-2',
          data: { float32: generateRandomVector(384) },
          metadata: {
            title: 'Advanced Vector Search Techniques',
            category: 'tech',
            published: true,
          },
        },
        {
          key: 'doc-3',
          data: { float32: generateRandomVector(384) },
          metadata: {
            title: 'Machine Learning Fundamentals',
            category: 'science',
            published: false,
          },
        },
      ]

      const putResponse = await index.putVectors({ vectors: documents })
      assertSuccessResponse(putResponse)

      // Step 6: Query for similar vectors
      const queryResponse = await index.queryVectors({
        queryVector: { float32: generateRandomVector(384) },
        topK: 2,
        filter: { published: true },
        returnDistance: true,
        returnMetadata: true,
      })

      const queryData = assertSuccessResponse(queryResponse)
      expect(queryData.matches.length).toBeGreaterThan(0)
      expect(queryData.matches.length).toBeLessThanOrEqual(2)

      // All matches should have published: true
      for (const match of queryData.matches) {
        expect(match.metadata?.published).toBe(true)
      }

      // Step 7: List all vectors
      const listResponse = await index.listVectors({
        returnMetadata: true,
      })

      const listData = assertSuccessResponse(listResponse)
      expect(listData.vectors.length).toBeGreaterThanOrEqual(3)

      // Step 8: Get specific vectors
      const getResponse = await index.getVectors({
        keys: ['doc-1', 'doc-2'],
        returnData: true,
        returnMetadata: true,
      })

      const getData = assertSuccessResponse(getResponse)
      expect(getData.vectors.length).toBe(2)

      // Step 9: Update a vector
      const updateResponse = await index.putVectors({
        vectors: [
          {
            key: 'doc-1',
            data: { float32: generateRandomVector(384) },
            metadata: {
              title: 'Updated: Introduction to Vector Databases',
              category: 'tech',
              published: true,
              updated: true,
            },
          },
        ],
      })
      assertSuccessResponse(updateResponse)

      // Step 10: Verify update
      const verifyResponse = await index.getVectors({
        keys: ['doc-1'],
        returnMetadata: true,
      })

      const verifyData = assertSuccessResponse(verifyResponse)
      expect(verifyData.vectors[0].metadata?.updated).toBe(true)

      // Step 11: Delete some vectors
      const deleteResponse = await index.deleteVectors({
        keys: ['doc-3'],
      })
      assertSuccessResponse(deleteResponse)

      // Step 12: Verify deletion
      const verifyDeleteResponse = await index.getVectors({
        keys: ['doc-3'],
      })

      const verifyDeleteData = assertSuccessResponse(verifyDeleteResponse)
      expect(verifyDeleteData.vectors).toEqual([])

      // Step 13: Delete index
      const deleteIndexResponse = await bucket.deleteIndex(indexName)
      assertSuccessResponse(deleteIndexResponse)

      // Step 14: Delete bucket
      const deleteBucketResponse = await client.deleteBucket(bucketName)
      assertSuccessResponse(deleteBucketResponse)
    })
  })

  describe('Multi-Index Workflow', () => {
    it('should manage multiple indexes in the same bucket', async () => {
      const bucketName = generateTestName('multi-index-bucket')

      // Create bucket
      await client.createBucket(bucketName)
      const bucket = client.from(bucketName)

      // Create multiple indexes with different configurations
      const indexes = [
        {
          name: 'embeddings-small',
          dimension: 384,
          metric: 'cosine' as const,
        },
        {
          name: 'embeddings-large',
          dimension: 1536,
          metric: 'euclidean' as const,
        },
        {
          name: 'embeddings-dotproduct',
          dimension: 768,
          metric: 'dotproduct' as const,
        },
      ]

      for (const indexConfig of indexes) {
        const response = await bucket.createIndex({
          indexName: indexConfig.name,
          dataType: 'float32',
          dimension: indexConfig.dimension,
          distanceMetric: indexConfig.metric,
        })
        assertSuccessResponse(response)
      }

      // List all indexes
      const listResponse = await bucket.listIndexes()
      const listData = assertSuccessResponse(listResponse)
      expect(listData.indexes.length).toBeGreaterThanOrEqual(3)

      // Insert vectors into each index
      for (const indexConfig of indexes) {
        const index = bucket.index(indexConfig.name)
        const response = await index.putVectors({
          vectors: [
            {
              key: 'vec-1',
              data: { float32: generateRandomVector(indexConfig.dimension) },
              metadata: { index: indexConfig.name },
            },
          ],
        })
        assertSuccessResponse(response)
      }

      // Query each index
      for (const indexConfig of indexes) {
        const index = bucket.index(indexConfig.name)
        const response = await index.queryVectors({
          queryVector: { float32: generateRandomVector(indexConfig.dimension) },
          topK: 1,
          returnMetadata: true,
        })
        const data = assertSuccessResponse(response)
        expect(data.matches.length).toBeGreaterThan(0)
      }

      // Cleanup: Delete all indexes
      for (const indexConfig of indexes) {
        await bucket.deleteIndex(indexConfig.name)
      }

      // Delete bucket
      await client.deleteBucket(bucketName)
    })
  })

  describe('Semantic Search Workflow', () => {
    it('should perform semantic search with metadata filtering', async () => {
      const bucketName = generateTestName('semantic-bucket')
      const indexName = generateTestName('semantic-index')

      // Setup
      await client.createBucket(bucketName)
      const bucket = client.from(bucketName)
      await bucket.createIndex({
        indexName,
        dataType: 'float32',
        dimension: 128,
        distanceMetric: 'cosine',
      })

      const index = bucket.index(indexName)

      // Insert documents with semantic embeddings
      const documents = [
        {
          key: 'article-1',
          data: { float32: generateRandomVector(128) },
          metadata: {
            type: 'article',
            category: 'technology',
            tags: ['ai', 'ml'],
            year: 2024,
            score: 4.5,
          },
        },
        {
          key: 'article-2',
          data: { float32: generateRandomVector(128) },
          metadata: {
            type: 'article',
            category: 'technology',
            tags: ['web', 'dev'],
            year: 2023,
            score: 4.0,
          },
        },
        {
          key: 'paper-1',
          data: { float32: generateRandomVector(128) },
          metadata: {
            type: 'paper',
            category: 'science',
            tags: ['research', 'ml'],
            year: 2024,
            score: 5.0,
          },
        },
        {
          key: 'blog-1',
          data: { float32: generateRandomVector(128) },
          metadata: {
            type: 'blog',
            category: 'technology',
            tags: ['tutorial'],
            year: 2024,
            score: 3.5,
          },
        },
      ]

      await index.putVectors({ vectors: documents })

      // Search 1: Find technology articles
      const tech1Response = await index.queryVectors({
        queryVector: { float32: generateRandomVector(128) },
        topK: 10,
        filter: { type: 'article', category: 'technology' },
        returnMetadata: true,
      })

      const tech1Data = assertSuccessResponse(tech1Response)
      expect(tech1Data.matches.length).toBeGreaterThan(0)
      for (const match of tech1Data.matches) {
        expect(match.metadata?.type).toBe('article')
        expect(match.metadata?.category).toBe('technology')
      }

      // Search 2: Find 2024 content
      const year2024Response = await index.queryVectors({
        queryVector: { float32: generateRandomVector(128) },
        topK: 10,
        filter: { year: 2024 },
        returnMetadata: true,
      })

      const year2024Data = assertSuccessResponse(year2024Response)
      expect(year2024Data.matches.length).toBeGreaterThan(0)
      for (const match of year2024Data.matches) {
        expect(match.metadata?.year).toBe(2024)
      }

      // Search 3: Find papers
      const papersResponse = await index.queryVectors({
        queryVector: { float32: generateRandomVector(128) },
        topK: 10,
        filter: { type: 'paper' },
        returnMetadata: true,
      })

      const papersData = assertSuccessResponse(papersResponse)
      expect(papersData.matches.length).toBeGreaterThan(0)
      for (const match of papersData.matches) {
        expect(match.metadata?.type).toBe('paper')
      }

      // Cleanup
      await bucket.deleteIndex(indexName)
      await client.deleteBucket(bucketName)
    })
  })

  describe('Batch Processing Workflow', () => {
    it('should handle large-scale batch operations', async () => {
      const bucketName = generateTestName('batch-bucket')
      const indexName = generateTestName('batch-index')

      // Setup
      await client.createBucket(bucketName)
      const bucket = client.from(bucketName)
      await bucket.createIndex({
        indexName,
        dataType: 'float32',
        dimension: 64,
        distanceMetric: 'cosine',
      })

      const index = bucket.index(indexName)

      // Insert in batches of 500
      const totalVectors = 1000
      const batchSize = 500

      for (let i = 0; i < totalVectors; i += batchSize) {
        const batch = Array.from({ length: Math.min(batchSize, totalVectors - i) }, (_, j) => ({
          key: `vector-${i + j}`,
          data: { float32: generateRandomVector(64) },
          metadata: { batch: Math.floor((i + j) / batchSize), index: i + j },
        }))

        const response = await index.putVectors({ vectors: batch })
        assertSuccessResponse(response)
      }

      // List all vectors (paginated)
      const listResponse = await index.listVectors({
        maxResults: 100,
        returnMetadata: true,
      })

      const listData = assertSuccessResponse(listResponse)
      expect(listData.vectors.length).toBeGreaterThan(0)
      expect(listData.vectors.length).toBeLessThanOrEqual(100)

      // Query for similar vectors
      const queryResponse = await index.queryVectors({
        queryVector: { float32: generateRandomVector(64) },
        topK: 10,
        returnDistance: true,
      })

      const queryData = assertSuccessResponse(queryResponse)
      expect(queryData.matches.length).toBeGreaterThan(0)
      expect(queryData.matches.length).toBeLessThanOrEqual(10)

      // Delete in batches
      const keysToDelete = Array.from({ length: 100 }, (_, i) => `vector-${i}`)
      const deleteResponse = await index.deleteVectors({ keys: keysToDelete })
      assertSuccessResponse(deleteResponse)

      // Verify deletion
      const getResponse = await index.getVectors({ keys: keysToDelete.slice(0, 10) })
      const getData = assertSuccessResponse(getResponse)
      expect(getData.vectors).toEqual([])

      // Cleanup
      await bucket.deleteIndex(indexName)
      await client.deleteBucket(bucketName)
    })
  })

  describe('Error Recovery Workflow', () => {
    it('should handle errors gracefully and allow recovery', async () => {
      const bucketName = generateTestName('error-bucket')
      const indexName = generateTestName('error-index')

      // Create bucket
      await client.createBucket(bucketName)
      const bucket = client.from(bucketName)

      // Try to create index in non-existent bucket (error)
      const badBucket = client.from('non-existent-bucket')
      const errorResponse = await badBucket.createIndex({
        indexName,
        dataType: 'float32',
        dimension: 3,
        distanceMetric: 'cosine',
      })

      expect(errorResponse.error).toBeTruthy()

      // Recover: Create index in correct bucket
      const goodResponse = await bucket.createIndex({
        indexName,
        dataType: 'float32',
        dimension: 3,
        distanceMetric: 'cosine',
      })

      assertSuccessResponse(goodResponse)

      // Continue normal operations
      const index = bucket.index(indexName)
      const putResponse = await index.putVectors({
        vectors: [{ key: 'vec-1', data: { float32: [0.1, 0.2, 0.3] } }],
      })

      assertSuccessResponse(putResponse)

      // Cleanup
      await bucket.deleteIndex(indexName)
      await client.deleteBucket(bucketName)
    })
  })
})
