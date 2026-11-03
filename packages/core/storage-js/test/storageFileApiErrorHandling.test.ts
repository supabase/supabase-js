import { StorageClient } from '../src/index'
import { StorageApiError, StorageError, StorageUnknownError } from '../src/lib/common/errors'

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

  describe('download', () => {
    it('handles network errors', async () => {
      const mockError = new Error('Network failure')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(mockError))
      const storage = new StorageClient(URL, { apikey: KEY })

      const blobDownload = await storage.from(BUCKET_ID).download('test.jpg')
      expect(blobDownload.data).toBeNull()
      expect(blobDownload.error).not.toBeNull()
      expect(blobDownload.error?.message).toBe('Network failure')

      const streamDownload = await storage.from(BUCKET_ID).download('test.jpg').asStream()
      expect(streamDownload.data).toBeNull()
      expect(streamDownload.error).not.toBeNull()
      expect(streamDownload.error?.message).toBe('Network failure')
    })

    it('wraps non-Response errors as StorageUnknownError', async () => {
      const nonResponseError = new TypeError('Invalid download format')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(nonResponseError))

      const storage = new StorageClient(URL, { apikey: KEY })

      const blobDownload = await storage.from(BUCKET_ID).download('test.jpg')
      expect(blobDownload.data).toBeNull()
      expect(blobDownload.error).toBeInstanceOf(StorageUnknownError)
      expect(blobDownload.error?.message).toBe('Invalid download format')

      const streamDownload = await storage.from(BUCKET_ID).download('test.jpg').asStream()
      expect(streamDownload.data).toBeNull()
      expect(streamDownload.error).toBeInstanceOf(StorageUnknownError)
      expect(streamDownload.error?.message).toBe('Invalid download format')
    })

    it('throws non-StorageError exceptions', async () => {
      // Create a storage client
      const storage = new StorageClient(URL, { apikey: KEY })

      // Create a spy on the fetch method that will throw a non-StorageError
      const mockFn = jest.spyOn(global, 'fetch').mockImplementation(() => {
        const error = new Error('Unexpected error in download')
        Object.defineProperty(error, 'name', { value: 'CustomError' })
        throw error
      })

      await expect(storage.from(BUCKET_ID).download('test.jpg')).rejects.toThrow(
        'Unexpected error in download'
      )

      await expect(storage.from(BUCKET_ID).download('test.jpg').asStream()).rejects.toThrow(
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

  describe('exists', () => {
    const mockResponse = (status: number, body: object) =>
      (global.fetch = jest
        .fn()
        .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(body), { status }))))

    it('returns true when the object info is found', async () => {
      const fetchMock = mockResponse(200, { id: '1', name: 'test.jpg' })
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).exists('test.jpg')
      expect(data).toBe(true)
      expect(error).toBeNull()
      expect(fetchMock.mock.calls[0][0]).toBe(`${URL}/object/info/${BUCKET_ID}/test.jpg`)
    })

    it('returns false for NoSuchKey', async () => {
      mockResponse(404, {
        statusCode: '404',
        error: 'not_found',
        message: 'Object not found',
        code: 'NoSuchKey',
      })
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).exists('missing.jpg')
      expect(data).toBe(false)
      expect(error).toBeInstanceOf(StorageApiError)
    })

    it('returns false for a 404 without an error code', async () => {
      mockResponse(404, { statusCode: '404', error: 'not_found', message: 'Object not found' })
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).exists('missing.jpg')
      expect(data).toBe(false)
      expect(error).toBeInstanceOf(StorageApiError)
    })

    it('rethrows InvalidJWT instead of reporting a missing file', async () => {
      mockResponse(400, {
        statusCode: '400',
        error: 'InvalidJWT',
        message: 'exp claim timestamp check failed',
        code: 'InvalidJWT',
      })
      const storage = new StorageClient(URL, { apikey: KEY })

      await expect(storage.from(BUCKET_ID).exists('test.jpg')).rejects.toMatchObject({
        status: 400,
        code: 'InvalidJWT',
      })
    })

    it('rethrows NoSuchBucket instead of reporting a missing file', async () => {
      mockResponse(404, {
        statusCode: '404',
        error: 'Bucket not found',
        message: 'Bucket not found',
        code: 'NoSuchBucket',
      })
      const storage = new StorageClient(URL, { apikey: KEY })

      await expect(storage.from(BUCKET_ID).exists('test.jpg')).rejects.toMatchObject({
        status: 404,
        code: 'NoSuchBucket',
      })
    })

    it('rethrows network errors', async () => {
      global.fetch = jest
        .fn()
        .mockImplementation(() => Promise.reject(new Error('Network failure')))
      const storage = new StorageClient(URL, { apikey: KEY })

      await expect(storage.from(BUCKET_ID).exists('test.jpg')).rejects.toBeInstanceOf(
        StorageUnknownError
      )
    })

    it('throws on a missing object when throwOnError is enabled', async () => {
      mockResponse(404, {
        statusCode: '404',
        error: 'not_found',
        message: 'Object not found',
        code: 'NoSuchKey',
      })
      const storage = new StorageClient(URL, { apikey: KEY })

      await expect(storage.from(BUCKET_ID).throwOnError().exists('missing.jpg')).rejects.toThrow(
        'Object not found'
      )
    })
  })
})
