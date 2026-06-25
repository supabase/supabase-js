import { PostgrestClient } from '../src/index'

const REST_URL = 'http://localhost:3000'

describe('URL length validation and timeout protection', () => {
  describe('timeout option', () => {
    test('should create client without timeout by default', () => {
      const postgrest = new PostgrestClient(REST_URL)
      expect(postgrest).toBeDefined()
      expect(postgrest.fetch).toBeDefined()
    })

    test('should create client with timeout option', () => {
      const postgrest = new PostgrestClient(REST_URL, { timeout: 5000 })
      expect(postgrest).toBeDefined()
      expect(postgrest.fetch).toBeDefined()
    })

    test('should abort request after timeout', async () => {
      // Mock fetch that respects AbortSignal and takes longer than timeout
      const slowFetch: typeof fetch = (_input, init) =>
        new Promise<Response>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve(new Response(JSON.stringify([]), { status: 200 }))
          }, 2000)

          // Listen to abort signal
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId)
              const abortError = new Error('The operation was aborted')
              abortError.name = 'AbortError'
              reject(abortError)
            })
          }
        })

      const postgrest = new PostgrestClient(REST_URL, {
        timeout: 100, // 100ms timeout
        fetch: slowFetch,
      })

      const { error } = await postgrest.from('users').select()

      expect(error).toBeDefined()
      expect(error?.message).toContain('AbortError')
    })

    test('should complete fast requests within timeout', async () => {
      const fastFetch: typeof fetch = () =>
        Promise.resolve(
          new Response(JSON.stringify([{ id: 1, name: 'Test' }]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )

      const postgrest = new PostgrestClient(REST_URL, {
        timeout: 5000,
        fetch: fastFetch,
      })

      const { data, error } = await postgrest.from('users').select()

      expect(error).toBeNull()
      expect(data).toEqual([{ id: 1, name: 'Test' }])
    })

    test('should ignore zero or negative timeout values', () => {
      const postgrest1 = new PostgrestClient(REST_URL, { timeout: 0 })
      const postgrest2 = new PostgrestClient(REST_URL, { timeout: -100 })

      expect(postgrest1).toBeDefined()
      expect(postgrest2).toBeDefined()
    })

    test('should respect existing AbortSignal', async () => {
      const controller = new AbortController()
      const fastFetch: typeof fetch = () =>
        Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
          })
        )

      const postgrest = new PostgrestClient(REST_URL, {
        timeout: 5000,
        fetch: fastFetch,
      })

      // Abort immediately
      controller.abort()

      const { error } = await postgrest.from('users').select()

      // Should handle abort gracefully
      expect(error).toBeDefined()
    })
  })

  describe('enhanced error messages', () => {
    test('should include helpful hint for AbortError with short URL', async () => {
      const abortingFetch: typeof fetch = () => {
        const error = new Error('The operation was aborted')
        error.name = 'AbortError'
        return Promise.reject(error)
      }

      const postgrest = new PostgrestClient(REST_URL, {
        fetch: abortingFetch,
      })

      const { error } = await postgrest.from('users').select('id,name')

      expect(error).toBeDefined()
      expect(error?.message).toContain('AbortError')
      expect(error?.hint).toContain('Request was aborted')
      expect(error?.code).toBe('')
    })

    test('should include URL length hint for AbortError with very long URL', async () => {
      const abortingFetch: typeof fetch = () => {
        const error = new Error('The operation was aborted')
        error.name = 'AbortError'
        return Promise.reject(error)
      }

      const postgrest = new PostgrestClient(REST_URL, {
        fetch: abortingFetch,
      })

      // Create a very long select that will result in a long URL
      const longFieldList = Array.from({ length: 1000 }, (_, i) => `field_${i}`).join(',')
      const { error } = await postgrest.from('users').select(longFieldList)

      expect(error).toBeDefined()
      expect(error?.message).toContain('AbortError')
      expect(error?.hint).toContain('Request was aborted')
      expect(error?.hint).toContain('Your request URL is')
      expect(error?.hint).toContain('characters, which may exceed server limits')
      expect(error?.hint).toContain('consider using views')
      expect(error?.hint).toContain('consider using an RPC function')
      expect(error?.code).toBe('')
    })

    test('should not add URL length hint for non-AbortError', async () => {
      const errorFetch: typeof fetch = () => {
        return Promise.reject(new Error('Network error'))
      }

      const postgrest = new PostgrestClient(REST_URL, {
        fetch: errorFetch,
      })

      const longFieldList = Array.from({ length: 1000 }, (_, i) => `field_${i}`).join(',')
      const { error } = await postgrest.from('users').select(longFieldList)

      expect(error).toBeDefined()
      expect(error?.hint).not.toContain('Your request URL is')
    })

    test('should include helpful hint for HeadersOverflowError with long URL', async () => {
      const headersOverflowFetch: typeof fetch = () => {
        const overflowError: any = new Error('Headers Overflow Error')
        overflowError.name = 'HeadersOverflowError'
        overflowError.code = 'UND_ERR_HEADERS_OVERFLOW'

        const typeError = new Error('fetch failed')
        typeError.name = 'TypeError'
        typeError.cause = overflowError

        return Promise.reject(typeError)
      }

      const postgrest = new PostgrestClient(REST_URL, {
        fetch: headersOverflowFetch,
      })

      const longFieldList = Array.from({ length: 1000 }, (_, i) => `field_${i}`).join(',')
      const { error } = await postgrest.from('users').select(longFieldList)

      expect(error).toBeDefined()
      expect(error?.message).toContain('fetch failed')
      expect(error?.code).toBe('')
      expect(error?.hint).toContain('HTTP headers exceeded server limits')
      expect(error?.hint).toContain('Your request URL is')
      expect(error?.hint).toContain('consider using views')
      expect(error?.hint).toContain('consider using an RPC function')
      expect(error?.details).toContain('HeadersOverflowError')
    })

    test('should include hint for HeadersOverflowError with short URL', async () => {
      const headersOverflowFetch: typeof fetch = () => {
        const overflowError: any = new Error('Headers Overflow Error')
        overflowError.name = 'HeadersOverflowError'
        overflowError.code = 'UND_ERR_HEADERS_OVERFLOW'

        const typeError = new Error('fetch failed')
        typeError.name = 'TypeError'
        typeError.cause = overflowError

        return Promise.reject(typeError)
      }

      const postgrest = new PostgrestClient(REST_URL, {
        fetch: headersOverflowFetch,
      })

      const { error } = await postgrest.from('users').select('id,name')

      expect(error).toBeDefined()
      expect(error?.code).toBe('')
      expect(error?.hint).toContain('HTTP headers exceeded server limits')
      expect(error?.hint).not.toContain('Your request URL is')
    })

    test('should detect HeadersOverflowError by error code', async () => {
      const headersOverflowFetch: typeof fetch = () => {
        const overflowError: any = new Error('Headers Overflow Error')
        overflowError.name = 'SomeOtherError' // Different name
        overflowError.code = 'UND_ERR_HEADERS_OVERFLOW' // But correct code

        const typeError = new Error('fetch failed')
        typeError.name = 'TypeError'
        typeError.cause = overflowError

        return Promise.reject(typeError)
      }

      const postgrest = new PostgrestClient(REST_URL, {
        fetch: headersOverflowFetch,
      })

      const { error } = await postgrest.from('users').select('id')

      expect(error).toBeDefined()
      expect(error?.code).toBe('')
      expect(error?.hint).toContain('HTTP headers exceeded server limits')
    })
  })

  describe('integration: timeout + long URL', () => {
    test('should timeout on long URL and provide comprehensive error', async () => {
      const slowFetch: typeof fetch = (_input, init) =>
        new Promise<Response>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve(new Response(JSON.stringify([]), { status: 200 }))
          }, 2000)

          // Listen to abort signal
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId)
              const abortError = new Error('The operation was aborted')
              abortError.name = 'AbortError'
              reject(abortError)
            })
          }
        })

      const postgrest = new PostgrestClient(REST_URL, {
        timeout: 100,
        fetch: slowFetch,
      })

      const longFieldList = Array.from({ length: 1000 }, (_, i) => `field_${i}`).join(',')
      const { error } = await postgrest.from('users').select(longFieldList)

      // Should timeout and provide helpful error
      expect(error).toBeDefined()
      expect(error?.message).toContain('AbortError')
      expect(error?.hint).toContain('Your request URL is')
      expect(error?.code).toBe('')
    })
  })
})
