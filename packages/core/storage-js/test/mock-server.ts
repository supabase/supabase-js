/**
 * Mock server implementation for testing
 * Provides hardcoded responses for all API endpoints
 */

/// <reference types="jest" />

import { testData } from './setup'
import type { Fetch } from '../src/lib/vectors'

interface MockResponse {
  status: number
  data?: any
  error?: {
    statusCode: number
    error: string
    message: string
  }
}

/**
 * In-memory storage for mock data
 */
class MockStorage {
  private buckets = new Set<string>()
  private indexes = new Map<string, Map<string, any>>() // bucket -> index -> config
  private vectors = new Map<string, Map<string, any>>() // bucket:index -> key -> vector

  constructor() {
    // Initialize with test data
    this.buckets.add(testData.buckets.test)

    const indexConfig = {
      indexName: testData.indexes.test,
      vectorBucketName: testData.buckets.test,
      dataType: 'float32' as const,
      dimension: 3,
      distanceMetric: 'cosine' as const,
      creationTime: Math.floor(Date.now() / 1000),
    }

    const bucketIndexes = new Map()
    bucketIndexes.set(testData.indexes.test, indexConfig)
    this.indexes.set(testData.buckets.test, bucketIndexes)

    // Add sample vectors
    const vectorKey = `${testData.buckets.test}:${testData.indexes.test}`
    const vectorStorage = new Map()

    vectorStorage.set(testData.vectors.key1, {
      key: testData.vectors.key1,
      data: { float32: testData.sampleVectors.vector1 },
      metadata: testData.metadata.doc1,
    })

    vectorStorage.set(testData.vectors.key2, {
      key: testData.vectors.key2,
      data: { float32: testData.sampleVectors.vector2 },
      metadata: testData.metadata.doc2,
    })

    vectorStorage.set(testData.vectors.key3, {
      key: testData.vectors.key3,
      data: { float32: testData.sampleVectors.vector3 },
      metadata: testData.metadata.doc3,
    })

    this.vectors.set(vectorKey, vectorStorage)
  }

  reset() {
    this.buckets.clear()
    this.indexes.clear()
    this.vectors.clear()
  }

  // Bucket operations
  hasBucket(name: string): boolean {
    return this.buckets.has(name)
  }

  addBucket(name: string) {
    this.buckets.add(name)
    this.indexes.set(name, new Map())
  }

  removeBucket(name: string) {
    this.buckets.delete(name)
    this.indexes.delete(name)
  }

  getBuckets(prefix?: string): string[] {
    const buckets = Array.from(this.buckets)
    if (prefix) {
      return buckets.filter((b) => b.startsWith(prefix))
    }
    return buckets
  }

  // Index operations
  hasIndex(bucketName: string, indexName: string): boolean {
    return this.indexes.get(bucketName)?.has(indexName) ?? false
  }

  addIndex(bucketName: string, config: any) {
    let bucketIndexes = this.indexes.get(bucketName)
    if (!bucketIndexes) {
      bucketIndexes = new Map()
      this.indexes.set(bucketName, bucketIndexes)
    }
    bucketIndexes.set(config.indexName, config)

    // Initialize vector storage for this index
    const vectorKey = `${bucketName}:${config.indexName}`
    if (!this.vectors.has(vectorKey)) {
      this.vectors.set(vectorKey, new Map())
    }
  }

  getIndex(bucketName: string, indexName: string): any {
    return this.indexes.get(bucketName)?.get(indexName)
  }

  getIndexes(bucketName: string, prefix?: string): any[] {
    const bucketIndexes = this.indexes.get(bucketName)
    if (!bucketIndexes) return []

    const indexes = Array.from(bucketIndexes.values())
    if (prefix) {
      return indexes.filter((i) => i.indexName.startsWith(prefix))
    }
    return indexes
  }

  removeIndex(bucketName: string, indexName: string) {
    this.indexes.get(bucketName)?.delete(indexName)
    const vectorKey = `${bucketName}:${indexName}`
    this.vectors.delete(vectorKey)
  }

  // Vector operations
  getVectorStorage(bucketName: string, indexName: string): Map<string, any> | undefined {
    const vectorKey = `${bucketName}:${indexName}`
    return this.vectors.get(vectorKey)
  }

  putVector(bucketName: string, indexName: string, vector: any) {
    const vectorKey = `${bucketName}:${indexName}`
    let storage = this.vectors.get(vectorKey)
    if (!storage) {
      storage = new Map()
      this.vectors.set(vectorKey, storage)
    }
    storage.set(vector.key, vector)
  }

  getVector(bucketName: string, indexName: string, key: string): any {
    const storage = this.getVectorStorage(bucketName, indexName)
    return storage?.get(key)
  }

  deleteVector(bucketName: string, indexName: string, key: string) {
    const storage = this.getVectorStorage(bucketName, indexName)
    storage?.delete(key)
  }
}

const storage = new MockStorage()

/**
 * Mock fetch implementation
 */
export function createMockFetch(): Fetch {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    // Handle different input types safely without assuming Request constructor exists
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as any).url || String(input)
    const urlStr = url.toString()
    const endpoint = urlStr.split('/').pop() || ''
    const body = init?.body ? JSON.parse(init.body as string) : {}
    const method = init?.method || 'GET'

    let response: MockResponse

    try {
      response = await handleRequest(endpoint, method, body)
    } catch (error: any) {
      response = {
        status: 500,
        error: {
          statusCode: 500,
          error: 'Internal Server Error',
          message: error.message,
        },
      }
    }

    // Create mock Response object
    const responseBody = JSON.stringify(response.error || response.data || {})

    // Check if Response constructor is available (Node 18+, modern browsers)
    if (typeof Response !== 'undefined') {
      return new Response(responseBody, {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
        },
      }) as any
    }

    // Fallback: Create a minimal Response-like object for older environments
    const mockResponse: any = {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.status === 200 ? 'OK' : 'Error',
      headers: {
        get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => JSON.parse(responseBody),
      text: async () => responseBody,
    }

    return mockResponse as Response
  }
}

async function handleRequest(endpoint: string, method: string, body: any): Promise<MockResponse> {
  // Bucket endpoints
  if (endpoint === 'CreateVectorBucket') {
    return handleCreateBucket(body)
  }
  if (endpoint === 'GetVectorBucket') {
    return handleGetBucket(body)
  }
  if (endpoint === 'ListVectorBuckets') {
    return handleListBuckets(body)
  }
  if (endpoint === 'DeleteVectorBucket') {
    return handleDeleteBucket(body)
  }

  // Index endpoints
  if (endpoint === 'CreateIndex') {
    return handleCreateIndex(body)
  }
  if (endpoint === 'GetIndex') {
    return handleGetIndex(body)
  }
  if (endpoint === 'ListIndexes') {
    return handleListIndexes(body)
  }
  if (endpoint === 'DeleteIndex') {
    return handleDeleteIndex(body)
  }

  // Vector data endpoints
  if (endpoint === 'PutVectors') {
    return handlePutVectors(body)
  }
  if (endpoint === 'GetVectors') {
    return handleGetVectors(body)
  }
  if (endpoint === 'ListVectors') {
    return handleListVectors(body)
  }
  if (endpoint === 'QueryVectors') {
    return handleQueryVectors(body)
  }
  if (endpoint === 'DeleteVectors') {
    return handleDeleteVectors(body)
  }

  return {
    status: 404,
    error: {
      statusCode: 404,
      error: 'Not Found',
      message: `Endpoint not found: ${endpoint}`,
    },
  }
}

// Bucket handlers
function handleCreateBucket(body: any): MockResponse {
  const { vectorBucketName } = body

  if (storage.hasBucket(vectorBucketName)) {
    return {
      status: 409,
      error: {
        statusCode: 409,
        error: 'Conflict',
        message: `Bucket '${vectorBucketName}' already exists`,
      },
    }
  }

  storage.addBucket(vectorBucketName)
  return { status: 200, data: {} }
}

function handleGetBucket(body: any): MockResponse {
  const { vectorBucketName } = body

  if (!storage.hasBucket(vectorBucketName)) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Bucket '${vectorBucketName}' not found`,
      },
    }
  }

  return {
    status: 200,
    data: {
      vectorBucket: {
        vectorBucketName,
        creationTime: Math.floor(Date.now() / 1000),
      },
    },
  }
}

function handleListBuckets(body: any): MockResponse {
  const { prefix, maxResults = 100 } = body
  const buckets = storage.getBuckets(prefix)

  return {
    status: 200,
    data: {
      vectorBuckets: buckets.slice(0, maxResults).map((name) => ({ vectorBucketName: name })),
      nextToken: buckets.length > maxResults ? 'mock-next-token' : undefined,
    },
  }
}

function handleDeleteBucket(body: any): MockResponse {
  const { vectorBucketName } = body

  if (!storage.hasBucket(vectorBucketName)) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Bucket '${vectorBucketName}' not found`,
      },
    }
  }

  const indexes = storage.getIndexes(vectorBucketName)
  if (indexes.length > 0) {
    return {
      status: 400,
      error: {
        statusCode: 400,
        error: 'Bad Request',
        message: `Bucket '${vectorBucketName}' is not empty`,
      },
    }
  }

  storage.removeBucket(vectorBucketName)
  return { status: 200, data: {} }
}

// Index handlers
function handleCreateIndex(body: any): MockResponse {
  const { vectorBucketName, indexName } = body

  if (!storage.hasBucket(vectorBucketName)) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Bucket '${vectorBucketName}' not found`,
      },
    }
  }

  if (storage.hasIndex(vectorBucketName, indexName)) {
    return {
      status: 409,
      error: {
        statusCode: 409,
        error: 'Conflict',
        message: `Index '${indexName}' already exists`,
      },
    }
  }

  storage.addIndex(vectorBucketName, {
    ...body,
    creationTime: Math.floor(Date.now() / 1000),
  })

  return { status: 200, data: {} }
}

function handleGetIndex(body: any): MockResponse {
  const { vectorBucketName, indexName } = body

  if (!storage.hasBucket(vectorBucketName)) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Bucket '${vectorBucketName}' not found`,
      },
    }
  }

  const index = storage.getIndex(vectorBucketName, indexName)
  if (!index) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Index '${indexName}' not found`,
      },
    }
  }

  return {
    status: 200,
    data: { index },
  }
}

function handleListIndexes(body: any): MockResponse {
  const { vectorBucketName, prefix, maxResults = 100 } = body

  if (!storage.hasBucket(vectorBucketName)) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Bucket '${vectorBucketName}' not found`,
      },
    }
  }

  const indexes = storage.getIndexes(vectorBucketName, prefix)

  return {
    status: 200,
    data: {
      indexes: indexes.slice(0, maxResults).map((i) => ({ indexName: i.indexName })),
      nextToken: indexes.length > maxResults ? 'mock-next-token' : undefined,
    },
  }
}

function handleDeleteIndex(body: any): MockResponse {
  const { vectorBucketName, indexName } = body

  if (!storage.hasBucket(vectorBucketName)) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Bucket '${vectorBucketName}' not found`,
      },
    }
  }

  if (!storage.hasIndex(vectorBucketName, indexName)) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Index '${indexName}' not found`,
      },
    }
  }

  storage.removeIndex(vectorBucketName, indexName)
  return { status: 200, data: {} }
}

// Vector data handlers
function handlePutVectors(body: any): MockResponse {
  const { vectorBucketName, indexName, vectors } = body

  if (!storage.hasBucket(vectorBucketName)) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Bucket '${vectorBucketName}' not found`,
      },
    }
  }

  if (!storage.hasIndex(vectorBucketName, indexName)) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Index '${indexName}' not found`,
      },
    }
  }

  for (const vector of vectors) {
    storage.putVector(vectorBucketName, indexName, vector)
  }

  return { status: 200, data: {} }
}

function handleGetVectors(body: any): MockResponse {
  const { vectorBucketName, indexName, keys, returnData = true, returnMetadata = true } = body

  if (!storage.hasBucket(vectorBucketName)) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Bucket '${vectorBucketName}' not found`,
      },
    }
  }

  if (!storage.hasIndex(vectorBucketName, indexName)) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Index '${indexName}' not found`,
      },
    }
  }

  const vectors = keys
    .map((key: string) => {
      const vector = storage.getVector(vectorBucketName, indexName, key)
      if (!vector) return null

      const result: any = { key: vector.key }
      if (returnData) result.data = vector.data
      if (returnMetadata) result.metadata = vector.metadata

      return result
    })
    .filter(Boolean)

  return {
    status: 200,
    data: { vectors },
  }
}

function handleListVectors(body: any): MockResponse {
  const {
    vectorBucketName,
    indexName,
    maxResults = 500,
    returnData = true,
    returnMetadata = true,
  } = body

  if (!storage.hasBucket(vectorBucketName)) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Bucket '${vectorBucketName}' not found`,
      },
    }
  }

  if (!storage.hasIndex(vectorBucketName, indexName)) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Index '${indexName}' not found`,
      },
    }
  }

  const vectorStorage = storage.getVectorStorage(vectorBucketName, indexName)
  const allVectors = Array.from(vectorStorage?.values() || [])

  const vectors = allVectors.slice(0, maxResults).map((vector) => {
    const result: any = { key: vector.key }
    if (returnData) result.data = vector.data
    if (returnMetadata) result.metadata = vector.metadata
    return result
  })

  return {
    status: 200,
    data: {
      vectors,
      nextToken: allVectors.length > maxResults ? 'mock-next-token' : undefined,
    },
  }
}

function handleQueryVectors(body: any): MockResponse {
  const {
    vectorBucketName,
    indexName,
    topK = 10,
    filter,
    returnDistance = false,
    returnMetadata = true,
  } = body

  if (!storage.hasBucket(vectorBucketName)) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Bucket '${vectorBucketName}' not found`,
      },
    }
  }

  if (!storage.hasIndex(vectorBucketName, indexName)) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Index '${indexName}' not found`,
      },
    }
  }

  const vectorStorage = storage.getVectorStorage(vectorBucketName, indexName)
  let allVectors = Array.from(vectorStorage?.values() || [])

  // Apply filter if provided
  if (filter) {
    allVectors = allVectors.filter((vector) => {
      if (!vector.metadata) return false
      return Object.entries(filter).every(([key, value]) => vector.metadata[key] === value)
    })
  }

  // Calculate cosine similarity (simplified mock)
  const matches = allVectors
    .map((vector, index) => {
      const result: any = { key: vector.key }
      if (returnDistance) {
        // Mock distance calculation
        result.distance = 0.1 + index * 0.05
      }
      if (returnMetadata) result.metadata = vector.metadata
      return result
    })
    .slice(0, topK)

  return {
    status: 200,
    data: { matches },
  }
}

function handleDeleteVectors(body: any): MockResponse {
  const { vectorBucketName, indexName, keys } = body

  if (!storage.hasBucket(vectorBucketName)) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Bucket '${vectorBucketName}' not found`,
      },
    }
  }

  if (!storage.hasIndex(vectorBucketName, indexName)) {
    return {
      status: 404,
      error: {
        statusCode: 404,
        error: 'Not Found',
        message: `Index '${indexName}' not found`,
      },
    }
  }

  for (const key of keys) {
    storage.deleteVector(vectorBucketName, indexName, key)
  }

  return { status: 200, data: {} }
}

/**
 * Reset mock storage to initial state
 */
export function resetMockStorage() {
  storage.reset()
  // Re-initialize with default test data
  const newStorage = new MockStorage()
  Object.assign(storage, newStorage)
}
