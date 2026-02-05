import { createFetchApi, get, post, put, head, remove } from '../../src/lib/common/fetch'
import { StorageApiError, StorageUnknownError } from '../../src/lib/common/errors'

// Mock Response class for testing
class MockResponse {
  ok: boolean
  status: number
  statusText: string
  private body: string
  private _headers: Map<string, string>

  constructor(
    body: string,
    options: { status: number; statusText: string; headers?: Record<string, string> }
  ) {
    this.body = body
    this.status = options.status
    this.statusText = options.statusText
    this.ok = this.status >= 200 && this.status < 300
    this._headers = new Map(Object.entries(options.headers || {}))
  }

  json() {
    return Promise.resolve(JSON.parse(this.body))
  }

  get headers() {
    return {
      get: (key: string) => this._headers.get(key) || null,
    }
  }
}

describe('Common Fetch', () => {
  let mockFetch: jest.Mock

  beforeEach(() => {
    mockFetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Default exports (storage namespace)', () => {
    describe('get', () => {
      it('should make GET request and parse JSON response', async () => {
        const responseData = { result: 'success' }
        mockFetch.mockResolvedValue(
          new MockResponse(JSON.stringify(responseData), {
            status: 200,
            statusText: 'OK',
          })
        )

        const result = await get(mockFetch, 'http://test.com/api')

        expect(mockFetch).toHaveBeenCalledWith('http://test.com/api', {
          method: 'GET',
          headers: {},
        })
        expect(result).toEqual(responseData)
      })

      it('should include custom headers', async () => {
        const responseData = { result: 'success' }
        mockFetch.mockResolvedValue(
          new MockResponse(JSON.stringify(responseData), {
            status: 200,
            statusText: 'OK',
          })
        )

        await get(mockFetch, 'http://test.com/api', {
          headers: { Authorization: 'Bearer token' },
        })

        expect(mockFetch).toHaveBeenCalledWith('http://test.com/api', {
          method: 'GET',
          headers: { Authorization: 'Bearer token' },
        })
      })

      it('should throw StorageApiError on HTTP error', async () => {
        const errorResponse = { message: 'Not found' }
        mockFetch.mockResolvedValue(
          new MockResponse(JSON.stringify(errorResponse), {
            status: 404,
            statusText: 'Not Found',
          })
        )

        await expect(get(mockFetch, 'http://test.com/api')).rejects.toThrow(StorageApiError)
        await expect(get(mockFetch, 'http://test.com/api')).rejects.toMatchObject({
          name: 'StorageApiError',
          status: 404,
          message: 'Not found',
        })
      })

      it('should throw StorageUnknownError on network error', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'))

        await expect(get(mockFetch, 'http://test.com/api')).rejects.toThrow(StorageUnknownError)
        await expect(get(mockFetch, 'http://test.com/api')).rejects.toMatchObject({
          name: 'StorageUnknownError',
        })
      })
    })

    describe('post', () => {
      it('should make POST request with JSON body', async () => {
        const requestBody = { data: 'test' }
        const responseData = { result: 'created' }
        mockFetch.mockResolvedValue(
          new MockResponse(JSON.stringify(responseData), {
            status: 201,
            statusText: 'Created',
          })
        )

        const result = await post(mockFetch, 'http://test.com/api', requestBody)

        expect(mockFetch).toHaveBeenCalledWith('http://test.com/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
        expect(result).toEqual(responseData)
      })

      it('should merge custom headers with Content-Type', async () => {
        const requestBody = { data: 'test' }
        const responseData = { result: 'created' }
        mockFetch.mockResolvedValue(
          new MockResponse(JSON.stringify(responseData), {
            status: 201,
            statusText: 'Created',
          })
        )

        await post(mockFetch, 'http://test.com/api', requestBody, {
          headers: { Authorization: 'Bearer token' },
        })

        expect(mockFetch).toHaveBeenCalledWith('http://test.com/api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token',
          },
          body: JSON.stringify(requestBody),
        })
      })

      it('should handle non-plain object bodies', async () => {
        const formData = new FormData()
        const responseData = { result: 'created' }
        mockFetch.mockResolvedValue(
          new MockResponse(JSON.stringify(responseData), {
            status: 201,
            statusText: 'Created',
          })
        )

        await post(mockFetch, 'http://test.com/api', formData as any)

        expect(mockFetch).toHaveBeenCalledWith('http://test.com/api', {
          method: 'POST',
          headers: {},
          body: formData,
        })
      })
    })

    describe('put', () => {
      it('should make PUT request with JSON body', async () => {
        const requestBody = { data: 'updated' }
        const responseData = { result: 'updated' }
        mockFetch.mockResolvedValue(
          new MockResponse(JSON.stringify(responseData), {
            status: 200,
            statusText: 'OK',
          })
        )

        const result = await put(mockFetch, 'http://test.com/api', requestBody)

        expect(mockFetch).toHaveBeenCalledWith('http://test.com/api', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
        expect(result).toEqual(responseData)
      })
    })

    describe('head', () => {
      it('should make HEAD request and return Response without parsing JSON', async () => {
        const response = new MockResponse('', {
          status: 200,
          statusText: 'OK',
        })
        mockFetch.mockResolvedValue(response)

        const result = await head(mockFetch, 'http://test.com/api')

        expect(mockFetch).toHaveBeenCalledWith('http://test.com/api', {
          method: 'HEAD',
          headers: {},
        })
        expect(result).toBe(response)
      })
    })

    describe('remove', () => {
      it('should make DELETE request with JSON body', async () => {
        const requestBody = { id: '123' }
        const responseData = { result: 'deleted' }
        mockFetch.mockResolvedValue(
          new MockResponse(JSON.stringify(responseData), {
            status: 200,
            statusText: 'OK',
          })
        )

        const result = await remove(mockFetch, 'http://test.com/api', requestBody)

        expect(mockFetch).toHaveBeenCalledWith('http://test.com/api', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
        expect(result).toEqual(responseData)
      })
    })

    describe('duplex option', () => {
      it('should include duplex option when provided for POST', async () => {
        const requestBody = { data: 'test' }
        const responseData = { result: 'created' }
        mockFetch.mockResolvedValue(
          new MockResponse(JSON.stringify(responseData), {
            status: 201,
            statusText: 'Created',
          })
        )

        await post(mockFetch, 'http://test.com/api', requestBody, { duplex: 'half' })

        expect(mockFetch).toHaveBeenCalledWith('http://test.com/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          duplex: 'half',
        })
      })
    })

    describe('AbortSignal parameter', () => {
      it('should include signal in request parameters', async () => {
        const controller = new AbortController()
        const responseData = { result: 'success' }
        mockFetch.mockResolvedValue(
          new MockResponse(JSON.stringify(responseData), {
            status: 200,
            statusText: 'OK',
          })
        )

        await get(mockFetch, 'http://test.com/api', undefined, { signal: controller.signal })

        expect(mockFetch).toHaveBeenCalledWith('http://test.com/api', {
          method: 'GET',
          headers: {},
          signal: controller.signal,
        })
      })
    })

    describe('FetchParameters with cache', () => {
      it('should include cache parameter', async () => {
        const responseData = { result: 'success' }
        mockFetch.mockResolvedValue(
          new MockResponse(JSON.stringify(responseData), {
            status: 200,
            statusText: 'OK',
          })
        )

        await get(mockFetch, 'http://test.com/api', undefined, {
          cache: 'no-store',
        })

        expect(mockFetch).toHaveBeenCalledWith('http://test.com/api', {
          method: 'GET',
          headers: {},
          cache: 'no-store',
        })
      })

      it('should include both signal and cache', async () => {
        const controller = new AbortController()
        const responseData = { result: 'success' }
        mockFetch.mockResolvedValue(
          new MockResponse(JSON.stringify(responseData), {
            status: 200,
            statusText: 'OK',
          })
        )

        await get(mockFetch, 'http://test.com/api', undefined, {
          signal: controller.signal,
          cache: 'no-store',
        })

        expect(mockFetch).toHaveBeenCalledWith('http://test.com/api', {
          method: 'GET',
          headers: {},
          signal: controller.signal,
          cache: 'no-store',
        })
      })

      it('should support all cache values', async () => {
        const cacheValues = [
          'default',
          'no-store',
          'reload',
          'no-cache',
          'force-cache',
          'only-if-cached',
        ] as const

        for (const cacheValue of cacheValues) {
          const responseData = { result: 'success' }
          mockFetch.mockResolvedValue(
            new MockResponse(JSON.stringify(responseData), {
              status: 200,
              statusText: 'OK',
            })
          )

          await get(mockFetch, 'http://test.com/api', undefined, {
            cache: cacheValue,
          })

          expect(mockFetch).toHaveBeenCalledWith('http://test.com/api', {
            method: 'GET',
            headers: {},
            cache: cacheValue,
          })

          mockFetch.mockClear()
        }
      })
    })

    describe('empty response handling', () => {
      it('should NOT handle content-length: 0 for storage namespace (only vectors)', async () => {
        // Storage namespace should fail on empty responses, as they indicate a bug
        mockFetch.mockResolvedValue(
          new MockResponse('', {
            status: 200,
            statusText: 'OK',
            headers: { 'content-length': '0' },
          })
        )

        // This should throw because storage API never returns empty responses intentionally
        await expect(post(mockFetch, 'http://test.com/api', {})).rejects.toThrow()
      })
    })
  })

  describe('createFetchApi with vectors namespace', () => {
    let vectorsApi: ReturnType<typeof createFetchApi>

    beforeEach(() => {
      vectorsApi = createFetchApi('vectors')
    })

    it('should create vectors API error with correct namespace', async () => {
      const errorResponse = { message: 'Conflict' }
      mockFetch.mockResolvedValue(
        new MockResponse(JSON.stringify(errorResponse), {
          status: 409,
          statusText: 'Conflict',
        })
      )

      await expect(vectorsApi.get(mockFetch, 'http://test.com/api')).rejects.toThrow(
        StorageApiError
      )
      await expect(vectorsApi.get(mockFetch, 'http://test.com/api')).rejects.toMatchObject({
        name: 'StorageVectorsApiError',
        status: 409,
      })
    })

    it('should handle empty responses for vectors namespace', async () => {
      mockFetch.mockResolvedValue(
        new MockResponse('', {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/plain' },
        })
      )

      const result = await vectorsApi.get(mockFetch, 'http://test.com/api')
      expect(result).toEqual({})
    })

    it('should handle content-length: 0 from AWS S3 Vectors API (putVectors, deleteVectors)', async () => {
      // AWS S3 Vectors API returns 200 with content-length: 0 for mutations
      mockFetch.mockResolvedValue(
        new MockResponse('', {
          status: 200,
          statusText: 'OK',
          headers: { 'content-length': '0' },
        })
      )

      const result = await vectorsApi.post(mockFetch, 'http://test.com/api', {})
      expect(result).toEqual({})
    })

    it('should handle 204 No Content responses', async () => {
      mockFetch.mockResolvedValue(
        new MockResponse('', {
          status: 204,
          statusText: 'No Content',
          headers: {},
        })
      )

      const result = await vectorsApi.post(mockFetch, 'http://test.com/api', {})
      expect(result).toEqual({})
    })

    it('should handle responses without content-type header', async () => {
      mockFetch.mockResolvedValue(
        new MockResponse('', {
          status: 200,
          statusText: 'OK',
          headers: {},
        })
      )

      const result = await vectorsApi.post(mockFetch, 'http://test.com/api', {})
      expect(result).toEqual({})
    })

    it('should parse JSON when content-type is application/json', async () => {
      const responseData = { result: 'success' }
      mockFetch.mockResolvedValue(
        new MockResponse(JSON.stringify(responseData), {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
        })
      )

      const result = await vectorsApi.get(mockFetch, 'http://test.com/api')
      expect(result).toEqual(responseData)
    })

    it('should handle JSON parsing errors for vectors by creating ApiError', async () => {
      // Create a mock response that will fail JSON parsing
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await expect(vectorsApi.get(mockFetch, 'http://test.com/api')).rejects.toThrow(
        StorageApiError
      )

      // Reset mock for second assertion
      mockFetch.mockResolvedValue(mockResponse)

      await expect(vectorsApi.get(mockFetch, 'http://test.com/api')).rejects.toMatchObject({
        name: 'StorageVectorsApiError',
        status: 500,
      })
    })
  })

  describe('Error message extraction', () => {
    it('should extract message from msg field', async () => {
      const errorResponse = { msg: 'Error from msg' }
      mockFetch.mockResolvedValue(
        new MockResponse(JSON.stringify(errorResponse), {
          status: 400,
          statusText: 'Bad Request',
        })
      )

      try {
        await get(mockFetch, 'http://test.com/api')
      } catch (error: any) {
        expect(error.message).toBe('Error from msg')
      }
    })

    it('should extract message from message field', async () => {
      const errorResponse = { message: 'Error from message' }
      mockFetch.mockResolvedValue(
        new MockResponse(JSON.stringify(errorResponse), {
          status: 400,
          statusText: 'Bad Request',
        })
      )

      try {
        await get(mockFetch, 'http://test.com/api')
      } catch (error: any) {
        expect(error.message).toBe('Error from message')
      }
    })

    it('should extract message from error_description field', async () => {
      const errorResponse = { error_description: 'Error from description' }
      mockFetch.mockResolvedValue(
        new MockResponse(JSON.stringify(errorResponse), {
          status: 400,
          statusText: 'Bad Request',
        })
      )

      try {
        await get(mockFetch, 'http://test.com/api')
      } catch (error: any) {
        expect(error.message).toBe('Error from description')
      }
    })

    it('should extract status code from statusCode field', async () => {
      const errorResponse = { message: 'Error', statusCode: 'CustomErrorCode' }
      mockFetch.mockResolvedValue(
        new MockResponse(JSON.stringify(errorResponse), {
          status: 400,
          statusText: 'Bad Request',
        })
      )

      try {
        await get(mockFetch, 'http://test.com/api')
      } catch (error: any) {
        expect(error.statusCode).toBe('CustomErrorCode')
      }
    })

    it('should use code field as statusCode if statusCode is not present', async () => {
      const errorResponse = { message: 'Error', code: 'CustomCode' }
      mockFetch.mockResolvedValue(
        new MockResponse(JSON.stringify(errorResponse), {
          status: 400,
          statusText: 'Bad Request',
        })
      )

      try {
        await get(mockFetch, 'http://test.com/api')
      } catch (error: any) {
        expect(error.statusCode).toBe('CustomCode')
      }
    })
  })
})
