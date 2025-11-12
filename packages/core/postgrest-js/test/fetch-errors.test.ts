import { PostgrestClient } from '../src/index'
import { Database } from './types.override'

describe('Fetch error handling', () => {
  test('should bubble up DNS error cause in details', async () => {
    // Create a client with an invalid domain that will trigger DNS resolution error
    const postgrest = new PostgrestClient<Database>(
      'https://invalid-domain-that-does-not-exist.local'
    )

    const res = await postgrest.from('users').select()

    expect(res.error).toBeTruthy()
    expect(res.data).toBeNull()
    expect(res.status).toBe(0)
    expect(res.statusText).toBe('')

    // Client-side network errors don't populate code/hint (those are for upstream service errors)
    expect(res.error!.code).toBe('')
    expect(res.error!.hint).toBe('')

    // The message should contain the fetch error
    expect(res.error!.message).toContain('fetch failed')

    // The details should contain cause information with error code
    // Different environments return different DNS error codes:
    // - ENOTFOUND: Domain doesn't exist (most common)
    // - EAI_AGAIN: Temporary DNS failure (common in CI)
    expect(res.error!.details).toContain('Caused by:')
    expect(res.error!.details).toContain('getaddrinfo')
    expect(res.error!.details).toMatch(/\(ENOTFOUND\)|\(EAI_AGAIN\)/)
  })

  test('should handle network errors with custom fetch implementation', async () => {
    // Simulate a network error with a cause
    const mockFetch = jest.fn().mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error('getaddrinfo ENOTFOUND example.com'), {
          code: 'ENOTFOUND',
          errno: -3008,
          syscall: 'getaddrinfo',
          hostname: 'example.com',
        }),
      })
    )

    const postgrest = new PostgrestClient<Database>('https://example.com', {
      fetch: mockFetch as any,
    })

    const res = await postgrest.from('users').select()

    expect(res.error).toBeTruthy()
    expect(res.error!.code).toBe('')
    expect(res.error!.hint).toBe('')
    expect(res.error!.message).toBe('TypeError: fetch failed')
    expect(res.error!.details).toContain('Caused by:')
    expect(res.error!.details).toContain('getaddrinfo ENOTFOUND example.com')
    expect(res.error!.details).toContain('(ENOTFOUND)')
  })

  test('should handle connection refused errors', async () => {
    // Simulate a connection refused error
    const mockFetch = jest.fn().mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:9999'), {
          code: 'ECONNREFUSED',
          errno: -61,
          syscall: 'connect',
          address: '127.0.0.1',
          port: 9999,
        }),
      })
    )

    const postgrest = new PostgrestClient<Database>('http://localhost:9999', {
      fetch: mockFetch as any,
    })

    const res = await postgrest.from('users').select()

    expect(res.error).toBeTruthy()
    expect(res.error!.code).toBe('')
    expect(res.error!.hint).toBe('')
    expect(res.error!.details).toContain('connect ECONNREFUSED')
    expect(res.error!.details).toContain('(ECONNREFUSED)')
  })

  test('should handle timeout errors', async () => {
    // Simulate a timeout error
    const mockFetch = jest.fn().mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error('request timeout'), {
          code: 'ETIMEDOUT',
          errno: -60,
          syscall: 'connect',
        }),
      })
    )

    const postgrest = new PostgrestClient<Database>('https://example.com', {
      fetch: mockFetch as any,
    })

    const res = await postgrest.from('users').select()

    expect(res.error).toBeTruthy()
    expect(res.error!.code).toBe('')
    expect(res.error!.hint).toBe('')
    expect(res.error!.details).toContain('request timeout')
    expect(res.error!.details).toContain('(ETIMEDOUT)')
  })

  test('should handle fetch errors without cause gracefully', async () => {
    // Simulate a fetch error without cause
    const mockFetch = jest.fn().mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), {
        code: 'FETCH_ERROR',
      })
    )

    const postgrest = new PostgrestClient<Database>('https://example.com', {
      fetch: mockFetch as any,
    })

    const res = await postgrest.from('users').select()

    expect(res.error).toBeTruthy()
    expect(res.error!.code).toBe('')
    expect(res.error!.hint).toBe('')
    expect(res.error!.message).toBe('TypeError: fetch failed')
    // When no cause, details should still have the stack trace
    expect(res.error!.details).toBeTruthy()
  })

  test('should handle generic errors without code', async () => {
    // Simulate a generic error
    const mockFetch = jest.fn().mockRejectedValue(new Error('Something went wrong'))

    const postgrest = new PostgrestClient<Database>('https://example.com', {
      fetch: mockFetch as any,
    })

    const res = await postgrest.from('users').select()

    expect(res.error).toBeTruthy()
    expect(res.error!.code).toBe('')
    expect(res.error!.hint).toBe('')
    expect(res.error!.message).toBe('Error: Something went wrong')
  })

  test('should throw error when using throwOnError with fetch failure', async () => {
    const mockFetch = jest.fn().mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error('getaddrinfo ENOTFOUND example.com'), {
          code: 'ENOTFOUND',
        }),
      })
    )

    const postgrest = new PostgrestClient<Database>('https://example.com', {
      fetch: mockFetch as any,
    })

    // When throwOnError is used, the error should be thrown instead of returned
    await expect(postgrest.from('users').select().throwOnError()).rejects.toThrow('fetch failed')
  })
})
