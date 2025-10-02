import { StorageClient } from '../src/index'
import { StorageError, StorageUnknownError } from '../src/lib/errors'

// Create a simple Response implementation for testing
class MockResponse {
  ok: boolean
  status: number
  statusText: string
  private body: string

  constructor(body: string, options: { status: number; statusText: string }) {
    this.body = body
    this.status = options.status
    this.statusText = options.statusText
    this.ok = this.status >= 200 && this.status < 300
  }

  json() {
    return Promise.resolve(JSON.parse(this.body))
  }
}

// Mock URL and credentials for testing
const URL = 'http://localhost:8000/storage/v1'
const KEY = 'test-api-key'

describe('Bucket API Error Handling', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('URL Construction', () => {
    const urlTestCases = [
      [
        'https://blah.supabase.co/storage/v1',
        'https://blah.storage.supabase.co/storage/v1',
        'update legacy prod host to new host',
      ],
      [
        'https://blah.supabase.red/storage/v1',
        'https://blah.storage.supabase.red/storage/v1',
        'update legacy staging host to new host',
      ],
      [
        'https://blah.storage.supabase.co/storage/v1',
        'https://blah.storage.supabase.co/storage/v1',
        'accept new host without modification',
      ],
      [
        'https://blah.supabase.co.example.com/storage/v1',
        'https://blah.supabase.co.example.com/storage/v1',
        'not modify non-platform hosts',
      ],
      [
        'http://localhost:1234/storage/v1',
        'http://localhost:1234/storage/v1',
        'support local host with port without modification',
      ],
    ]

    urlTestCases.forEach(([inputUrl, expectUrl, description]) => {
      it('should ' + description + ' if useNewHostname is true', () => {
        const storage = new StorageClient(inputUrl, { apikey: KEY }, undefined, {
          useNewHostname: true,
        })
        expect(storage['url']).toBe(expectUrl)
      })
      it('should not modify host if useNewHostname is false', () => {
        const storage = new StorageClient(inputUrl, { apikey: KEY }, undefined, {
          useNewHostname: false,
        })
        expect(storage['url']).toBe(inputUrl)
      })
    })
  })

  describe('listBuckets', () => {
    it('handles missing authorization errors if header is not provided', async () => {
      const storage = new StorageClient(URL)
      const { data, error } = await storage.listBuckets()
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe(`headers must have required property 'authorization'`)

      // throws when .throwOnError is enabled
      await expect(storage.throwOnError().listBuckets()).rejects.toThrowError(
        "headers must have required property 'authorization'"
      )
    })

    it('handles network errors', async () => {
      const mockError = new Error('Network failure')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(mockError))
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.listBuckets()
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Network failure')

      // throws when .throwOnError is enabled
      await expect(storage.throwOnError().listBuckets()).rejects.toThrowError('Network failure')
    })

    it('wraps non-Response errors as StorageUnknownError', async () => {
      // Create an error that's not a Response object
      const nonResponseError = new TypeError('Invalid argument')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(nonResponseError))

      const storage = new StorageClient(URL, { apikey: KEY })

      // Check that the error is wrapped in a StorageUnknownError
      const { data, error } = await storage.listBuckets()
      expect(data).toBeNull()
      expect(error).toBeInstanceOf(StorageUnknownError)
      expect(error?.message).toBe('Invalid argument')

      // throws when .throwOnError is enabled
      await expect(storage.throwOnError().listBuckets()).rejects.toThrowError('Invalid argument')
    })

    it('throws non-StorageError exceptions', async () => {
      // Create a storage client
      const storage = new StorageClient(URL, { apikey: KEY })

      // Create a spy on the get method that will throw a non-StorageError
      const mockFn = jest.spyOn(require('../src/lib/fetch'), 'get').mockImplementationOnce(() => {
        const error = new Error('Unexpected error')
        // Ensure it's not recognized as a StorageError
        Object.defineProperty(error, 'name', { value: 'CustomError' })
        throw error
      })

      // The error should be thrown all the way up
      await expect(storage.listBuckets()).rejects.toThrow('Unexpected error')

      // Clean up
      mockFn.mockRestore()
    })
  })

  describe('getBucket', () => {
    it('handles network errors', async () => {
      const mockError = new Error('Network failure')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(mockError))
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.getBucket('non-existent-bucket')
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Network failure')

      // throws when .throwOnError is enabled
      await expect(storage.throwOnError().getBucket('non-existent-bucket')).rejects.toThrow(
        'Network failure'
      )
    })

    it('wraps non-Response errors as StorageUnknownError', async () => {
      const nonResponseError = new TypeError('Invalid bucket format')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(nonResponseError))

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.getBucket('test-bucket')
      expect(data).toBeNull()
      expect(error).toBeInstanceOf(StorageUnknownError)
      expect(error?.message).toBe('Invalid bucket format')
    })

    it('throws non-StorageError exceptions', async () => {
      // Create a storage client
      const storage = new StorageClient(URL, { apikey: KEY })

      // Create a spy on the get method that will throw a non-StorageError
      const mockFn = jest.spyOn(require('../src/lib/fetch'), 'get').mockImplementationOnce(() => {
        const error = new Error('Unexpected error in getBucket')
        // Ensure it's not recognized as a StorageError
        Object.defineProperty(error, 'name', { value: 'CustomError' })
        throw error
      })

      // The error should be thrown all the way up
      await expect(storage.getBucket('test-bucket')).rejects.toThrow(
        'Unexpected error in getBucket'
      )

      // Clean up
      mockFn.mockRestore()
    })
  })

  describe('createBucket', () => {
    it('handles network errors', async () => {
      const mockError = new Error('Network failure')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(mockError))
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.createBucket('new-bucket')
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Network failure')

      // throws when .throwOnError is enabled
      await expect(storage.throwOnError().createBucket('new-bucket')).rejects.toThrow(
        'Network failure'
      )
    })

    it('wraps non-Response errors as StorageUnknownError', async () => {
      const nonResponseError = new TypeError('Invalid bucket configuration')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(nonResponseError))

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.createBucket('test-bucket')
      expect(data).toBeNull()
      expect(error).toBeInstanceOf(StorageUnknownError)
      expect(error?.message).toBe('Invalid bucket configuration')
    })

    it('throws non-StorageError exceptions', async () => {
      // Create a storage client
      const storage = new StorageClient(URL, { apikey: KEY })

      // Create a spy on the post method that will throw a non-StorageError
      const mockFn = jest.spyOn(require('../src/lib/fetch'), 'post').mockImplementationOnce(() => {
        const error = new Error('Unexpected error in createBucket')
        // Ensure it's not recognized as a StorageError
        Object.defineProperty(error, 'name', { value: 'CustomError' })
        throw error
      })

      // The error should be thrown all the way up
      await expect(storage.createBucket('test-bucket')).rejects.toThrow(
        'Unexpected error in createBucket'
      )

      // Clean up
      mockFn.mockRestore()
    })
  })

  describe('updateBucket', () => {
    it('handles network errors', async () => {
      const mockError = new Error('Network failure')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(mockError))
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.updateBucket('existing-bucket', { public: true })
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Network failure')

      // throws when .throwOnError is enabled
      await expect(
        storage.throwOnError().updateBucket('existing-bucket', { public: true })
      ).rejects.toThrow('Network failure')
    })

    it('wraps non-Response errors as StorageUnknownError', async () => {
      const nonResponseError = new TypeError('Invalid update options')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(nonResponseError))

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.updateBucket('test-bucket', { public: true })
      expect(data).toBeNull()
      expect(error).toBeInstanceOf(StorageUnknownError)
      expect(error?.message).toBe('Invalid update options')
    })

    it('throws non-StorageError exceptions', async () => {
      // Create a storage client
      const storage = new StorageClient(URL, { apikey: KEY })

      // Create a spy on the put method that will throw a non-StorageError
      const mockFn = jest.spyOn(require('../src/lib/fetch'), 'put').mockImplementationOnce(() => {
        const error = new Error('Unexpected error in updateBucket')
        // Ensure it's not recognized as a StorageError
        Object.defineProperty(error, 'name', { value: 'CustomError' })
        throw error
      })

      // The error should be thrown all the way up
      await expect(storage.updateBucket('test-bucket', { public: true })).rejects.toThrow(
        'Unexpected error in updateBucket'
      )

      // Clean up
      mockFn.mockRestore()
    })
  })

  describe('emptyBucket', () => {
    it('handles network errors', async () => {
      const mockError = new Error('Network failure')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(mockError))
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.emptyBucket('existing-bucket')
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Network failure')

      // throws when .throwOnError is enabled
      await expect(storage.throwOnError().emptyBucket('existing-bucket')).rejects.toThrow(
        'Network failure'
      )
    })

    it('wraps non-Response errors as StorageUnknownError', async () => {
      const nonResponseError = new TypeError('Operation not supported')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(nonResponseError))

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.emptyBucket('test-bucket')
      expect(data).toBeNull()
      expect(error).toBeInstanceOf(StorageUnknownError)
      expect(error?.message).toBe('Operation not supported')
    })

    it('throws non-StorageError exceptions', async () => {
      // Create a storage client
      const storage = new StorageClient(URL, { apikey: KEY })

      // Create a spy on the post method that will throw a non-StorageError
      const mockFn = jest.spyOn(require('../src/lib/fetch'), 'post').mockImplementationOnce(() => {
        const error = new Error('Unexpected error in emptyBucket')
        // Ensure it's not recognized as a StorageError
        Object.defineProperty(error, 'name', { value: 'CustomError' })
        throw error
      })

      // The error should be thrown all the way up
      await expect(storage.emptyBucket('test-bucket')).rejects.toThrow(
        'Unexpected error in emptyBucket'
      )

      // Clean up
      mockFn.mockRestore()
    })
  })

  describe('deleteBucket', () => {
    it('handles network errors', async () => {
      const mockError = new Error('Network failure')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(mockError))
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.deleteBucket('existing-bucket')
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Network failure')

      // throws when .throwOnError is enabled
      await expect(storage.throwOnError().deleteBucket('existing-bucket')).rejects.toThrow(
        'Network failure'
      )
    })

    it('wraps non-Response errors as StorageUnknownError', async () => {
      const nonResponseError = new TypeError('Invalid delete operation')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(nonResponseError))

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.deleteBucket('test-bucket')
      expect(data).toBeNull()
      expect(error).toBeInstanceOf(StorageUnknownError)
      expect(error?.message).toBe('Invalid delete operation')

      // throws when .throwOnError is enabled
      await expect(storage.throwOnError().deleteBucket('test-bucket')).rejects.toThrow(
        'Invalid delete operation'
      )
    })

    it('throws non-StorageError exceptions', async () => {
      // Create a storage client
      const storage = new StorageClient(URL, { apikey: KEY })

      // Create a spy on the remove method that will throw a non-StorageError
      const mockFn = jest
        .spyOn(require('../src/lib/fetch'), 'remove')
        .mockImplementationOnce(() => {
          const error = new Error('Unexpected error in deleteBucket')
          // Ensure it's not recognized as a StorageError
          Object.defineProperty(error, 'name', { value: 'CustomError' })
          throw error
        })

      // The error should be thrown all the way up
      await expect(storage.deleteBucket('test-bucket')).rejects.toThrow(
        'Unexpected error in deleteBucket'
      )

      // Clean up
      mockFn.mockRestore()
    })
  })
})
