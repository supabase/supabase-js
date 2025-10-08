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

  describe('purgeCache', () => {
    it('wraps non-Response errors as StorageUnknownError', async () => {
      const nonResponseError = new TypeError('Invalid copy operation')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(nonResponseError))
      const storage = new StorageClient(URL, { apikey: KEY })
      const { data, error } = await storage.from(BUCKET_ID).purgeCache('test.png')
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Invalid copy operation')
    })

    it('rejects empty paths', async () => {
      const storage = new StorageClient(URL, { apikey: KEY })
      const { data, error } = await storage.from(BUCKET_ID).purgeCache('')
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe(
        'Path is required for cache purging. Use purgeCacheByPrefix() to purge folders or entire buckets.'
      )
    })

    it('rejects wildcard paths', async () => {
      const storage = new StorageClient(URL, { apikey: KEY })
      const { data, error } = await storage.from(BUCKET_ID).purgeCache('folder/*')
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe(
        'Wildcard purging is not supported. Please specify an exact file path.'
      )
    })

    it('wraps non-Response errors as StorageUnknownError', async () => {
      const nonResponseError = new TypeError('Invalid purge operation')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(nonResponseError))

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).purgeCache('test.png')
      expect(data).toBeNull()
      expect(error).toBeInstanceOf(StorageUnknownError)
      expect(error?.message).toBe('Invalid purge operation')
    })

    it('throws non-StorageError exceptions', async () => {
      const storage = new StorageClient(URL, { apikey: KEY })

      const mockFn = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        const error = new Error('Unexpected error in purgeCache')
        Object.defineProperty(error, 'name', { value: 'CustomError' })
        throw error
      })

      await expect(storage.from(BUCKET_ID).purgeCache('test.png')).rejects.toThrow(
        'Unexpected error in purgeCache'
      )

      mockFn.mockRestore()
    })
  })

  describe('purgeCacheByPrefix', () => {
    beforeEach(() => {
      // Mock Response constructor globally
      global.Response = jest.fn().mockImplementation((body, init) => ({
        json: () => Promise.resolve(JSON.parse(body)),
        status: init?.status || 200,
        headers: new Map(Object.entries(init?.headers || {})),
        ok: init?.status ? init.status >= 200 && init.status < 300 : true,
      })) as unknown as typeof Response
    })

    it('handles StorageError during list operation', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            statusCode: '403',
            error: 'Forbidden',
            message: 'Access denied to list objects',
          }),
        headers: new Map([['Content-Type', 'application/json']]),
      }
      global.fetch = jest.fn().mockImplementation(() => Promise.resolve(mockResponse))
      const storage = new StorageClient(URL, { apikey: KEY })
      const { data, error } = await storage.from(BUCKET_ID).purgeCacheByPrefix('folder')
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toContain(':403')
    })

    it('handles mixed success and failure during purge operations', async () => {
      // Mock successful list response
      const listResponse = new Response(
        JSON.stringify([
          { name: 'file1.jpg', id: '1' },
          { name: 'file2.png', id: '2' },
          { name: 'file3.gif', id: '3' },
        ]),
        {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }
      )

      // Mock purge responses - some succeed, some fail
      const successResponse = new Response(JSON.stringify({ message: 'success' }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      })

      const errorResponse = new Response(
        JSON.stringify({
          statusCode: '404',
          error: 'Not Found',
          message: 'Object not found',
        }),
        {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'application/json' },
        }
      )

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(listResponse) // List succeeds
        .mockResolvedValueOnce(successResponse) // First purge succeeds
        .mockResolvedValueOnce(errorResponse) // Second purge fails
        .mockResolvedValueOnce(successResponse) // Third purge succeeds

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).purgeCacheByPrefix('folder')
      expect(error).toBeNull()
      expect(data?.purgedPaths).toHaveLength(2)
      expect(data?.warnings).toHaveLength(1)
      expect(data?.warnings?.[0]).toContain('Failed to purge folder/file2.png')
      expect(data?.message).toContain('Successfully purged 2 object(s) (1 failed)')
    })

    it('handles all purge operations failing', async () => {
      // Mock successful list response
      const listResponse = new Response(
        JSON.stringify([
          { name: 'file1.jpg', id: '1' },
          { name: 'file2.png', id: '2' },
        ]),
        {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }
      )

      const errorResponse = new Response(
        JSON.stringify({
          statusCode: '404',
          error: 'Not Found',
          message: 'Object not found',
        }),
        {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'application/json' },
        }
      )

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(listResponse) // List succeeds
        .mockResolvedValue(errorResponse) // All purge operations fail

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).purgeCacheByPrefix('folder')
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toContain('All purge operations failed')
    })

    it('handles non-StorageError exceptions during individual purge operations', async () => {
      // Mock successful list response
      const listResponse = new Response(
        JSON.stringify([
          { name: 'file1.jpg', id: '1' },
          { name: 'file2.png', id: '2' },
        ]),
        {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }
      )

      const successResponse = new Response(JSON.stringify({ message: 'success' }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      })

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(listResponse) // List succeeds
        .mockResolvedValueOnce(successResponse) // First purge succeeds
        .mockImplementationOnce(() => {
          const error = new Error('Unexpected network error')
          Object.defineProperty(error, 'name', { value: 'CustomError' })
          throw error
        }) // Second purge throws non-StorageError

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).purgeCacheByPrefix('folder')
      expect(error).toBeNull()
      expect(data?.purgedPaths).toHaveLength(1)
      expect(data?.warnings).toHaveLength(1)
      expect(data?.warnings?.[0]).toContain(
        'Failed to purge folder/file2.png: Unexpected network error'
      )
      expect(data?.message).toContain('Successfully purged 1 object(s) (1 failed)')
    })

    it('throws non-StorageError exceptions at top level', async () => {
      const storage = new StorageClient(URL, { apikey: KEY })

      const mockFn = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        const error = new Error('Unexpected error in purgeCacheByPrefix')
        Object.defineProperty(error, 'name', { value: 'CustomError' })
        throw error
      })

      await expect(storage.from(BUCKET_ID).purgeCacheByPrefix('folder')).rejects.toThrow(
        'Unexpected error in purgeCacheByPrefix'
      )

      mockFn.mockRestore()
    })

    it('handles empty list response', async () => {
      const listResponse = new Response(JSON.stringify([]), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      })

      global.fetch = jest.fn().mockResolvedValue(listResponse)
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).purgeCacheByPrefix('empty-folder')
      expect(error).toBeNull()
      expect(data?.purgedPaths).toHaveLength(0)
      expect(data?.message).toEqual('No objects found to purge')
    })

    it('handles list response with only folders', async () => {
      const listResponse = new Response(
        JSON.stringify([
          { name: 'subfolder1/', id: null },
          { name: 'subfolder2/', id: null },
        ]),
        {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }
      )

      global.fetch = jest.fn().mockResolvedValue(listResponse)
      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).purgeCacheByPrefix('folder')
      expect(error).toBeNull()
      expect(data?.purgedPaths).toHaveLength(0)
      expect(data?.message).toEqual('No files found to purge (only folders detected)')
    })

    it('wraps non-Response errors from list as StorageUnknownError', async () => {
      const nonResponseError = new TypeError('Invalid list operation during purge')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(nonResponseError))

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).purgeCacheByPrefix('folder')
      expect(data).toBeNull()
      expect(error).toBeInstanceOf(StorageUnknownError)
      expect(error?.message).toBe('Invalid list operation during purge')
    })

    it('handles partial success with many warnings', async () => {
      // Create many files to test warning truncation
      const files = Array.from({ length: 10 }, (_, i) => ({ name: `file${i}.jpg`, id: String(i) }))
      const listResponse = new Response(JSON.stringify(files), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      })

      const errorResponse = new Response(
        JSON.stringify({
          statusCode: '404',
          error: 'Not Found',
          message: 'Object not found',
        }),
        {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'application/json' },
        }
      )

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(listResponse) // List succeeds
        .mockResolvedValue(errorResponse) // All purge operations fail

      const storage = new StorageClient(URL, { apikey: KEY })

      const { data, error } = await storage.from(BUCKET_ID).purgeCacheByPrefix('folder')
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toContain('All purge operations failed')
      // Should truncate the error message to avoid extremely long messages
      expect(error?.message.length).toBeLessThan(1000)
    })

    it('handles AbortController signal properly', async () => {
      const listResponse = {
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ name: 'file1.jpg', id: '1' }]),
      }

      const purgeResponse = {
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'success' }),
      }

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(listResponse)
        .mockResolvedValueOnce(purgeResponse)

      const storage = new StorageClient(URL, { apikey: KEY })
      const abortController = new AbortController()

      const { data, error } = await storage
        .from(BUCKET_ID)
        .purgeCacheByPrefix('folder', { batchDelayMs: 10 }, { signal: abortController.signal })
      expect(error).toBeNull()
      expect(data?.purgedPaths).toHaveLength(1)
      expect(data?.purgedPaths).toEqual(['folder/file1.jpg'])
      expect(data?.message).toContain('Successfully purged 1 object(s)')
    })
  })
})
