import BaseApiClient from '../../src/lib/common/BaseApiClient'
import { StorageError, StorageApiError } from '../../src/lib/common/errors'
import { StorageClient } from '../../src/index'

// Test implementation of BaseApiClient
class TestApiClient extends BaseApiClient {
  // Public method that uses handleOperation
  async testSuccessOperation() {
    return this.handleOperation(async () => {
      return { result: 'success' }
    })
  }

  // Public method that throws StorageError
  async testStorageErrorOperation() {
    return this.handleOperation(async () => {
      throw new StorageApiError('API Error', 404, 'NotFound')
    })
  }

  // Public method that throws unknown error
  async testUnknownErrorOperation() {
    return this.handleOperation(async () => {
      throw new Error('Unknown error')
    })
  }

  // Public method that throws non-StorageError
  async testNonStorageErrorOperation() {
    return this.handleOperation(async () => {
      throw new TypeError('Type error')
    })
  }
}

describe('BaseApiClient', () => {
  let client: TestApiClient

  beforeEach(() => {
    client = new TestApiClient('http://test.com', { 'x-custom': 'header' })
  })

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(client['url']).toBe('http://test.com')
      expect(client['headers']).toEqual({ 'x-custom': 'header' })
      expect(client['shouldThrowOnError']).toBe(false)
      expect(client['namespace']).toBe('storage')
      expect(client['fetch']).toBeDefined()
    })

    it('should initialize with vectors namespace', () => {
      const vectorClient = new TestApiClient('http://test.com', {}, undefined, 'vectors')
      expect(vectorClient['namespace']).toBe('vectors')
    })

    it('should use custom fetch if provided', () => {
      const customFetch = jest.fn()
      const clientWithFetch = new TestApiClient('http://test.com', {}, customFetch)
      expect(clientWithFetch['fetch']).toBeDefined()
    })

    it('should initialize with empty headers if not provided', () => {
      const minimalClient = new TestApiClient('http://test.com')
      expect(minimalClient['headers']).toEqual({})
    })
  })

  describe('throwOnError', () => {
    it('should enable throwing errors', () => {
      expect(client['shouldThrowOnError']).toBe(false)
      const result = client.throwOnError()
      expect(client['shouldThrowOnError']).toBe(true)
      expect(result).toBe(client) // For chaining
    })

    it('should allow method chaining', () => {
      const result = client.throwOnError()
      expect(result).toBe(client)
      expect(result['shouldThrowOnError']).toBe(true)
    })
  })

  describe('handleOperation - success path', () => {
    it('should return success response on successful operation', async () => {
      const result = await client.testSuccessOperation()

      expect(result).toEqual({
        data: { result: 'success' },
        error: null,
      })
    })

    it('should handle different data types', async () => {
      const client2 = new (class extends BaseApiClient {
        async testString() {
          return this.handleOperation(async () => 'string result')
        }
        async testNumber() {
          return this.handleOperation(async () => 42)
        }
        async testArray() {
          return this.handleOperation(async () => [1, 2, 3])
        }
        async testNull() {
          return this.handleOperation(async () => null)
        }
      })('http://test.com')

      expect(await client2.testString()).toEqual({
        data: 'string result',
        error: null,
      })
      expect(await client2.testNumber()).toEqual({
        data: 42,
        error: null,
      })
      expect(await client2.testArray()).toEqual({
        data: [1, 2, 3],
        error: null,
      })
      expect(await client2.testNull()).toEqual({
        data: null,
        error: null,
      })
    })
  })

  describe('handleOperation - error path (shouldThrowOnError = false)', () => {
    it('should return error response on StorageError', async () => {
      const result = await client.testStorageErrorOperation()

      expect(result).toEqual({
        data: null,
        error: expect.objectContaining({
          name: 'StorageApiError',
          message: 'API Error',
          status: 404,
          statusCode: 'NotFound',
        }),
      })
    })

    it('should throw on non-StorageError', async () => {
      await expect(client.testUnknownErrorOperation()).rejects.toThrow('Unknown error')
      await expect(client.testNonStorageErrorOperation()).rejects.toThrow(TypeError)
    })

    it('should handle StorageError subclasses', async () => {
      const customClient = new (class extends BaseApiClient {
        async testCustomError() {
          return this.handleOperation(async () => {
            throw new StorageApiError('Custom API Error', 500, 'InternalError')
          })
        }
      })('http://test.com')

      const result = await customClient.testCustomError()

      expect(result).toEqual({
        data: null,
        error: expect.objectContaining({
          name: 'StorageApiError',
          message: 'Custom API Error',
          status: 500,
          statusCode: 'InternalError',
        }),
      })
    })
  })

  describe('handleOperation - error path (shouldThrowOnError = true)', () => {
    beforeEach(() => {
      client.throwOnError()
    })

    it('should throw StorageError when shouldThrowOnError is true', async () => {
      await expect(client.testStorageErrorOperation()).rejects.toThrow(StorageApiError)
      await expect(client.testStorageErrorOperation()).rejects.toMatchObject({
        name: 'StorageApiError',
        message: 'API Error',
        status: 404,
        statusCode: 'NotFound',
      })
    })

    it('should throw unknown errors when shouldThrowOnError is true', async () => {
      await expect(client.testUnknownErrorOperation()).rejects.toThrow('Unknown error')
    })

    it('should throw non-StorageErrors when shouldThrowOnError is true', async () => {
      await expect(client.testNonStorageErrorOperation()).rejects.toThrow(TypeError)
    })

    it('should not affect successful operations', async () => {
      const result = await client.testSuccessOperation()

      expect(result).toEqual({
        data: { result: 'success' },
        error: null,
      })
    })
  })

  describe('setHeader', () => {
    it('should set a header on the instance', () => {
      client.setHeader('x-new', 'value')
      expect(client['headers']).toEqual({ 'x-custom': 'header', 'x-new': 'value' })
    })

    it('should return this for method chaining', () => {
      const result = client.setHeader('x-new', 'value')
      expect(result).toBe(client)
    })

    it('should support chaining multiple setHeader calls', () => {
      client.setHeader('x-a', '1').setHeader('x-b', '2')
      expect(client['headers']).toEqual({
        'x-custom': 'header',
        'x-a': '1',
        'x-b': '2',
      })
    })

    it('should override an existing header', () => {
      client.setHeader('x-custom', 'overridden')
      expect(client['headers']).toEqual({ 'x-custom': 'overridden' })
    })

    it('should not mutate the original headers object', () => {
      const originalHeaders = { authorization: 'Bearer token' }
      const c = new TestApiClient('http://test.com', originalHeaders)
      c.setHeader('x-extra', 'val')
      expect(originalHeaders).toEqual({ authorization: 'Bearer token' })
    })

    it('should not mutate parent StorageClient headers when called on StorageFileApi from from()', () => {
      const storageClient = new StorageClient('http://test.com', {
        authorization: 'Bearer token',
      })
      const fileApi = storageClient.from('my-bucket')
      fileApi.setHeader('x-per-request', 'value')

      // Parent should be unaffected — no 'x-per-request' header
      expect(storageClient['headers']).not.toHaveProperty('x-per-request')
      // Child should have the new header
      expect(fileApi['headers']).toHaveProperty('x-per-request', 'value')
    })
  })

  describe('Namespace behavior', () => {
    it('should create storage namespace errors by default', async () => {
      const storageClient = new TestApiClient('http://test.com')
      const result = await storageClient.testStorageErrorOperation()

      expect(result.error).toMatchObject({
        name: 'StorageApiError',
      })
    })

    it('should create vectors namespace errors when specified', async () => {
      const vectorsClient = new (class extends BaseApiClient {
        constructor() {
          super('http://test.com', {}, undefined, 'vectors')
        }
        async testVectorsError() {
          return this.handleOperation(async () => {
            throw new StorageApiError('Vectors Error', 409, 'Conflict', 'vectors')
          })
        }
      })()

      const result = await vectorsClient.testVectorsError()

      expect(result.error).toMatchObject({
        name: 'StorageVectorsApiError',
      })
    })
  })

  describe('Type safety', () => {
    it('should maintain type safety for data', async () => {
      interface CustomData {
        id: string
        name: string
      }

      const typedClient = new (class extends BaseApiClient {
        async getCustomData(): Promise<
          { data: CustomData; error: null } | { data: null; error: StorageError }
        > {
          return this.handleOperation<CustomData>(async () => {
            return { id: '123', name: 'test' }
          })
        }
      })('http://test.com')

      const result = await typedClient.getCustomData()

      if (result.error === null) {
        // TypeScript should know data is CustomData here
        expect(result.data.id).toBe('123')
        expect(result.data.name).toBe('test')
      }
    })
  })

  describe('Async operation handling', () => {
    it('should handle async operations with delays', async () => {
      const delayedClient = new (class extends BaseApiClient {
        async delayedOperation() {
          return this.handleOperation(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            return { delayed: true }
          })
        }
      })('http://test.com')

      const result = await delayedClient.delayedOperation()

      expect(result).toEqual({
        data: { delayed: true },
        error: null,
      })
    })

    it('should handle async errors', async () => {
      const asyncErrorClient = new (class extends BaseApiClient {
        async asyncErrorOperation() {
          return this.handleOperation(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            throw new StorageApiError('Async error', 500, 'InternalError')
          })
        }
      })('http://test.com')

      const result = await asyncErrorClient.asyncErrorOperation()

      expect(result).toEqual({
        data: null,
        error: expect.objectContaining({
          name: 'StorageApiError',
          message: 'Async error',
        }),
      })
    })
  })
})
