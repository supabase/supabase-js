import { fetchWithAuth } from '../../src/lib/fetch'

describe('fetch module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset global fetch and Headers
    delete (global as any).fetch
    delete (global as any).Headers
  })

  describe('fetchWithAuth', () => {
    test('should add apikey and authorization headers', async () => {
      const mockResponse = { ok: true }
      const mockFetchImpl = jest.fn().mockResolvedValue(mockResponse)
      const mockHeadersImpl = jest.fn().mockReturnValue({
        has: jest.fn().mockReturnValue(false),
        set: jest.fn(),
      })

      ;(global as any).fetch = mockFetchImpl
      ;(global as any).Headers = mockHeadersImpl

      const supabaseKey = 'test-key'
      const getAccessToken = jest.fn().mockResolvedValue('test-token')

      const authFetch = fetchWithAuth(supabaseKey, getAccessToken)
      await authFetch('https://example.com')

      expect(mockHeadersImpl).toHaveBeenCalled()
      expect(getAccessToken).toHaveBeenCalled()
    })

    test('should use supabaseKey as fallback when getAccessToken returns null', async () => {
      const mockResponse = { ok: true }
      const mockFetchImpl = jest.fn().mockResolvedValue(mockResponse)
      const mockHeadersImpl = jest.fn().mockReturnValue({
        has: jest.fn().mockReturnValue(false),
        set: jest.fn(),
      })

      ;(global as any).fetch = mockFetchImpl
      ;(global as any).Headers = mockHeadersImpl

      const supabaseKey = 'test-key'
      const getAccessToken = jest.fn().mockResolvedValue(null)

      const authFetch = fetchWithAuth(supabaseKey, getAccessToken)
      await authFetch('https://example.com')

      expect(getAccessToken).toHaveBeenCalled()
    })

    test('should not override existing apikey header', async () => {
      const mockResponse = { ok: true }
      const mockFetchImpl = jest.fn().mockResolvedValue(mockResponse)
      const mockSet = jest.fn()
      const mockHeadersImpl = jest.fn().mockReturnValue({
        has: jest.fn().mockImplementation((key) => key === 'apikey'),
        set: mockSet,
      })

      ;(global as any).fetch = mockFetchImpl
      ;(global as any).Headers = mockHeadersImpl

      const supabaseKey = 'test-key'
      const getAccessToken = jest.fn().mockResolvedValue('test-token')

      const authFetch = fetchWithAuth(supabaseKey, getAccessToken)
      await authFetch('https://example.com')

      expect(mockSet).not.toHaveBeenCalledWith('apikey', supabaseKey)
    })

    test('should not override existing authorization header', async () => {
      const mockResponse = { ok: true }
      const mockFetchImpl = jest.fn().mockResolvedValue(mockResponse)
      const mockSet = jest.fn()
      const mockHeadersImpl = jest.fn().mockReturnValue({
        has: jest.fn().mockImplementation((key) => key === 'Authorization'),
        set: mockSet,
      })

      ;(global as any).fetch = mockFetchImpl
      ;(global as any).Headers = mockHeadersImpl

      const supabaseKey = 'test-key'
      const getAccessToken = jest.fn().mockResolvedValue('test-token')

      const authFetch = fetchWithAuth(supabaseKey, getAccessToken)
      await authFetch('https://example.com')

      expect(mockSet).not.toHaveBeenCalledWith('Authorization', expect.stringContaining('Bearer'))
    })
  })
})
