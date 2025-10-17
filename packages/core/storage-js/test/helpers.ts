/**
 * Test helpers and utilities
 */

/// <reference types="jest" />

import { StorageVectorsClient } from '../src/lib/vectors'
import { createMockFetch, resetMockStorage } from './mock-server'
import { getTestConfig } from './setup'

/**
 * Create a test client based on configuration
 */
export function createTestClient(): StorageVectorsClient {
  const config = getTestConfig()

  if (config.useMockServer) {
    return new StorageVectorsClient('https://mock.example.com', {
      fetch: createMockFetch(),
      headers: {},
    })
  }

  if (!config.apiUrl) {
    throw new Error(
      'STORAGE_VECTORS_API_URL environment variable is required when USE_MOCK_SERVER=false'
    )
  }

  return new StorageVectorsClient(config.apiUrl, {
    headers: config.headers,
  })
}

/**
 * Setup before each test
 */
export function setupTest() {
  const config = getTestConfig()
  if (config.useMockServer) {
    resetMockStorage()
  }
}

/**
 * Generate unique test names to avoid conflicts
 */
export function generateTestName(prefix: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  return `${prefix}-${timestamp}-${random}`
}

/**
 * Sleep utility for tests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    initialDelay?: number
    maxDelay?: number
    factor?: number
  } = {}
): Promise<T> {
  const { maxAttempts = 3, initialDelay = 100, maxDelay = 5000, factor = 2 } = options

  let lastError: Error | undefined
  let delay = initialDelay

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxAttempts) {
        await sleep(Math.min(delay, maxDelay))
        delay *= factor
      }
    }
  }

  throw lastError
}

/**
 * Assert that an error has a specific status code
 */
export function assertErrorCode(error: any, expectedCode: number) {
  expect(error).toBeTruthy()
  expect(error.statusCode.toString()).toBe(expectedCode.toString())
}

/**
 * Assert that data is successfully returned
 */
export function assertSuccessResponse<T>(response: { data: T | null; error: any }): T {
  expect(response.error).toBeNull()
  expect(response.data).toBeTruthy()
  return response.data!
}

/**
 * Assert that an error response is returned
 */
export function assertErrorResponse(response: { data: any; error: any }) {
  expect(response.data).toBeNull()
  expect(response.error).toBeTruthy()
  return response.error
}

/**
 * Generate a random vector of specified dimension
 */
export function generateRandomVector(dimension: number): number[] {
  return Array.from({ length: dimension }, () => Math.random())
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (normA * normB)
}

/**
 * Normalize a vector to unit length
 */
export function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  if (norm === 0) return vector
  return vector.map((val) => val / norm)
}
