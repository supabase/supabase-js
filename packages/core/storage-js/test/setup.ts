/**
 * Test configuration and setup
 * Supports both real API testing and mock server testing
 */

/// <reference types="jest" />

export interface TestConfig {
  /**
   * Whether to use a mock server or real API
   */
  useMockServer: boolean
  /**
   * Base URL for the API (used when useMockServer is false)
   */
  apiUrl?: string
  /**
   * API headers (e.g., Authorization token)
   */
  headers?: Record<string, string>
}

/**
 * Get test configuration from environment variables
 */
export function getTestConfig(): TestConfig {
  const useMockServer = process.env.USE_MOCK_SERVER !== 'false'
  const apiUrl = process.env.STORAGE_VECTORS_API_URL
  const authToken = process.env.STORAGE_VECTORS_API_TOKEN

  const headers: Record<string, string> = {}
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  return {
    useMockServer,
    apiUrl: useMockServer ? undefined : apiUrl,
    headers: useMockServer ? {} : headers,
  }
}

/**
 * Shared test data
 */
export const testData = {
  buckets: {
    test: 'test-bucket',
    test2: 'test-bucket-2',
    nonExistent: 'non-existent-bucket',
  },
  indexes: {
    test: 'test-index',
    test2: 'test-index-2',
    nonExistent: 'non-existent-index',
  },
  vectors: {
    key1: 'vector-1',
    key2: 'vector-2',
    key3: 'vector-3',
    nonExistent: 'non-existent-vector',
  },
  // Sample 3-dimensional vectors for testing
  sampleVectors: {
    vector1: [0.1, 0.2, 0.3],
    vector2: [0.4, 0.5, 0.6],
    vector3: [0.7, 0.8, 0.9],
    query: [0.15, 0.25, 0.35],
  },
  metadata: {
    doc1: { title: 'Document 1', category: 'tech', page: 1 },
    doc2: { title: 'Document 2', category: 'science', page: 2 },
    doc3: { title: 'Document 3', category: 'tech', page: 3 },
  },
}
