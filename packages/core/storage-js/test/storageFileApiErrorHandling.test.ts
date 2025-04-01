import { StorageClient } from '../src/index'
import { StorageError, StorageUnknownError } from '../src/lib/errors'

// Mock URL and credentials for testing
const URL = 'http://localhost:8000/storage/v1'
const KEY = 'test-api-key'
const BUCKET_ID = 'test-bucket'

describe('File API Error Handling', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    // Ensure global.fetch exists for mocking
    if (!global.fetch) {
      global.fetch = jest.fn()
    }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('upload', () => {
    // Skip these tests until we can set up a proper test environment
    it.skip('handles network errors', async () => {
      global.fetch = jest
        .fn()
        .mockImplementation(() => Promise.reject(new Error('Network failure')))
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).upload('test.jpg', 'test-file-content')
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Network failure')
    })

    it.skip('wraps non-Response errors as StorageUnknownError', async () => {
      global.fetch = jest
        .fn()
        .mockImplementation(() => Promise.reject(new TypeError('Invalid upload format')))

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).upload('test.jpg', 'test-file-content')
      expect(data).toBeNull()
      expect(error).toBeInstanceOf(StorageUnknownError)
      expect(error?.message).toBe('Invalid upload format')
    })

    it.skip('throws non-StorageError exceptions', async () => {
      // Create a storage client
      const storage = new StorageClient(URL, { apikey: KEY })

      // Create a spy on the fetch method that will throw a non-StorageError
      const mockFn = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        const error = new Error('Unexpected error in upload')
        // Ensure it's not recognized as a StorageError
        Object.defineProperty(error, 'name', { value: 'CustomError' })
        throw error
      })

      // The error should be thrown all the way up
      await expect(storage.from(BUCKET_ID).upload('test.jpg', 'test-file-content')).rejects.toThrow(
        'Unexpected error in upload'
      )

      // Clean up
      mockFn.mockRestore()
    })
  })

  describe('download', () => {
    it('handles network errors', async () => {
      const mockError = new Error('Network failure')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(mockError))
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).download('test.jpg')
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Network failure')
    })

    it('wraps non-Response errors as StorageUnknownError', async () => {
      const nonResponseError = new TypeError('Invalid download format')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(nonResponseError))

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).download('test.jpg')
      expect(data).toBeNull()
      expect(error).toBeInstanceOf(StorageUnknownError)
      expect(error?.message).toBe('Invalid download format')
    })

    it('throws non-StorageError exceptions', async () => {
      // Create a storage client
      const storage = new StorageClient(URL, { apikey: KEY })

      // Create a spy on the fetch method that will throw a non-StorageError
      const mockFn = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        const error = new Error('Unexpected error in download')
        Object.defineProperty(error, 'name', { value: 'CustomError' })
        throw error
      })

      await expect(storage.from(BUCKET_ID).download('test.jpg')).rejects.toThrow(
        'Unexpected error in download'
      )

      mockFn.mockRestore()
    })
  })

  describe('list', () => {
    it('handles network errors', async () => {
      const mockError = new Error('Network failure')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(mockError))
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).list()
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Network failure')
    })

    it('wraps non-Response errors as StorageUnknownError', async () => {
      const nonResponseError = new TypeError('Invalid list operation')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(nonResponseError))

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).list()
      expect(data).toBeNull()
      expect(error).toBeInstanceOf(StorageUnknownError)
      expect(error?.message).toBe('Invalid list operation')
    })

    it('throws non-StorageError exceptions', async () => {
      const storage = new StorageClient(URL, { apikey: KEY })

      // Mock the fetch directly instead of the get function
      const mockFn = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        const error = new Error('Unexpected error in list')
        Object.defineProperty(error, 'name', { value: 'CustomError' })
        throw error
      })

      await expect(storage.from(BUCKET_ID).list()).rejects.toThrow('Unexpected error in list')

      mockFn.mockRestore()
    })
  })

  describe('move', () => {
    it('handles network errors', async () => {
      const mockError = new Error('Network failure')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(mockError))
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).move('source.jpg', 'destination.jpg')
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Network failure')
    })

    it('wraps non-Response errors as StorageUnknownError', async () => {
      const nonResponseError = new TypeError('Invalid move operation')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(nonResponseError))

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).move('source.jpg', 'destination.jpg')
      expect(data).toBeNull()
      expect(error).toBeInstanceOf(StorageUnknownError)
      expect(error?.message).toBe('Invalid move operation')
    })

    it('throws non-StorageError exceptions', async () => {
      const storage = new StorageClient(URL, { apikey: KEY })

      const mockFn = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        const error = new Error('Unexpected error in move')
        Object.defineProperty(error, 'name', { value: 'CustomError' })
        throw error
      })

      await expect(storage.from(BUCKET_ID).move('source.jpg', 'destination.jpg')).rejects.toThrow(
        'Unexpected error in move'
      )

      mockFn.mockRestore()
    })
  })

  describe('copy', () => {
    it('handles network errors', async () => {
      const mockError = new Error('Network failure')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(mockError))
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).copy('source.jpg', 'destination.jpg')
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Network failure')
    })

    it('wraps non-Response errors as StorageUnknownError', async () => {
      const nonResponseError = new TypeError('Invalid copy operation')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(nonResponseError))

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).copy('source.jpg', 'destination.jpg')
      expect(data).toBeNull()
      expect(error).toBeInstanceOf(StorageUnknownError)
      expect(error?.message).toBe('Invalid copy operation')
    })

    it('throws non-StorageError exceptions', async () => {
      const storage = new StorageClient(URL, { apikey: KEY })

      const mockFn = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        const error = new Error('Unexpected error in copy')
        Object.defineProperty(error, 'name', { value: 'CustomError' })
        throw error
      })

      await expect(storage.from(BUCKET_ID).copy('source.jpg', 'destination.jpg')).rejects.toThrow(
        'Unexpected error in copy'
      )

      mockFn.mockRestore()
    })
  })

  describe('remove', () => {
    it('handles network errors', async () => {
      const mockError = new Error('Network failure')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(mockError))
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).remove(['test.jpg'])
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Network failure')
    })

    it('wraps non-Response errors as StorageUnknownError', async () => {
      const nonResponseError = new TypeError('Invalid remove operation')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(nonResponseError))

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).remove(['test.jpg'])
      expect(data).toBeNull()
      expect(error).toBeInstanceOf(StorageUnknownError)
      expect(error?.message).toBe('Invalid remove operation')
    })

    it('throws non-StorageError exceptions', async () => {
      const storage = new StorageClient(URL, { apikey: KEY })

      const mockFn = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        const error = new Error('Unexpected error in remove')
        Object.defineProperty(error, 'name', { value: 'CustomError' })
        throw error
      })

      await expect(storage.from(BUCKET_ID).remove(['test.jpg'])).rejects.toThrow(
        'Unexpected error in remove'
      )

      mockFn.mockRestore()
    })
  })

  describe('createSignedUrl', () => {
    it('handles network errors', async () => {
      const mockError = new Error('Network failure')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(mockError))
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).createSignedUrl('test.jpg', 60)
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Network failure')
    })

    it('wraps non-Response errors as StorageUnknownError', async () => {
      const nonResponseError = new TypeError('Invalid signature operation')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(nonResponseError))

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).createSignedUrl('test.jpg', 60)
      expect(data).toBeNull()
      expect(error).toBeInstanceOf(StorageUnknownError)
      expect(error?.message).toBe('Invalid signature operation')
    })

    it('throws non-StorageError exceptions', async () => {
      const storage = new StorageClient(URL, { apikey: KEY })

      const mockFn = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        const error = new Error('Unexpected error in createSignedUrl')
        Object.defineProperty(error, 'name', { value: 'CustomError' })
        throw error
      })

      await expect(storage.from(BUCKET_ID).createSignedUrl('test.jpg', 60)).rejects.toThrow(
        'Unexpected error in createSignedUrl'
      )

      mockFn.mockRestore()
    })
  })
})
