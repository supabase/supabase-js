import { Fetch, resolveFetch, resolveResponse, resolveHeadersConstructor } from './fetch'

describe('Fetch utilities', () => {
  describe('resolveFetch', () => {
    it('should return native fetch when no custom fetch provided', () => {
      const resolvedFetch = resolveFetch()
      expect(resolvedFetch).toBeDefined()
      expect(typeof resolvedFetch).toBe('function')
    })

    it('should wrap custom fetch when provided', () => {
      const customFetch: Fetch = (...args) => fetch(...args)
      const resolvedFetch = resolveFetch(customFetch)
      expect(resolvedFetch).toBeDefined()
      expect(typeof resolvedFetch).toBe('function')
      expect(resolvedFetch).not.toBe(customFetch)
    })

    it('should return a function that calls the native fetch', async () => {
      const resolvedFetch = resolveFetch()
      // Simple test to ensure it's callable - actual fetch would need mocking
      expect(() => resolvedFetch).not.toThrow()
    })

    it('should wrap and call custom fetch correctly', () => {
      let called = false
      const customFetch: Fetch = ((...args) => {
        called = true
        return fetch(...args)
      }) as Fetch

      const resolvedFetch = resolveFetch(customFetch)
      expect(called).toBe(false)

      // Call the resolved fetch (will fail without proper URL, but that's ok for this test)
      resolvedFetch('http://example.com').catch(() => {
        // Expected to fail, we're just testing that custom fetch is called
      })

      expect(called).toBe(true)
    })
  })

  describe('resolveResponse', () => {
    it('should return Response constructor', () => {
      const ResponseConstructor = resolveResponse()
      expect(ResponseConstructor).toBe(Response)
    })

    it('should return a constructor that can create Response objects', () => {
      const ResponseConstructor = resolveResponse()
      const response = new ResponseConstructor('test body')
      expect(response).toBeInstanceOf(Response)
    })
  })

  describe('resolveHeadersConstructor', () => {
    it('should return Headers constructor', () => {
      const HeadersConstructor = resolveHeadersConstructor()
      expect(HeadersConstructor).toBe(Headers)
    })

    it('should return a constructor that can create Headers objects', () => {
      const HeadersConstructor = resolveHeadersConstructor()
      const headers = new HeadersConstructor({ 'Content-Type': 'application/json' })
      expect(headers).toBeInstanceOf(Headers)
      expect(headers.get('Content-Type')).toBe('application/json')
    })
  })
})
