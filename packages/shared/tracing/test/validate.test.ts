import { shouldPropagateToTarget } from '../src/validate'
import type { TracePropagationTarget } from '../src/types'

describe('shouldPropagateToTarget', () => {
  describe('string matchers', () => {
    it('should match exact hostname', () => {
      const targets: TracePropagationTarget[] = ['myproject.supabase.co']
      const result = shouldPropagateToTarget('https://myproject.supabase.co/rest/v1/table', targets)
      expect(result).toBe(true)
    })

    it('should not match different hostname', () => {
      const targets: TracePropagationTarget[] = ['myproject.supabase.co']
      const result = shouldPropagateToTarget('https://evil.com/api', targets)
      expect(result).toBe(false)
    })

    it('should match wildcard domain', () => {
      const targets: TracePropagationTarget[] = ['*.supabase.co']
      const result = shouldPropagateToTarget('https://myproject.supabase.co/rest/v1/table', targets)
      expect(result).toBe(true)
    })

    it('should match wildcard domain with subdomain', () => {
      const targets: TracePropagationTarget[] = ['*.example.com']
      const result = shouldPropagateToTarget('https://api.example.com/v1/endpoint', targets)
      expect(result).toBe(true)
    })

    it('should match wildcard domain with multiple subdomains', () => {
      const targets: TracePropagationTarget[] = ['*.example.com']
      const result = shouldPropagateToTarget('https://api.staging.example.com/v1', targets)
      expect(result).toBe(true)
    })

    it('should not match partial domain with wildcard', () => {
      const targets: TracePropagationTarget[] = ['*.supabase.co']
      const result = shouldPropagateToTarget('https://notsupabase.co/api', targets)
      expect(result).toBe(false)
    })

    it('should match base domain with wildcard', () => {
      const targets: TracePropagationTarget[] = ['*.example.com']
      const result = shouldPropagateToTarget('https://example.com/api', targets)
      expect(result).toBe(true)
    })

    it('should match localhost', () => {
      const targets: TracePropagationTarget[] = ['localhost']
      const result = shouldPropagateToTarget('http://localhost:3000/api', targets)
      expect(result).toBe(true)
    })

    it('should match IPv4 loopback', () => {
      const targets: TracePropagationTarget[] = ['127.0.0.1']
      const result = shouldPropagateToTarget('http://127.0.0.1:3000/api', targets)
      expect(result).toBe(true)
    })

    it('should match IPv6 loopback', () => {
      // Note: URL parsing includes brackets in hostname for IPv6
      const targets: TracePropagationTarget[] = ['[::1]']
      const result = shouldPropagateToTarget('http://[::1]:3000/api', targets)
      expect(result).toBe(true)
    })
  })

  describe('RegExp matchers', () => {
    it('should match hostname with RegExp', () => {
      const targets: TracePropagationTarget[] = [/.*\.supabase\.co$/]
      const result = shouldPropagateToTarget('https://myproject.supabase.co/rest/v1/table', targets)
      expect(result).toBe(true)
    })

    it('should not match different hostname with RegExp', () => {
      const targets: TracePropagationTarget[] = [/.*\.supabase\.co$/]
      const result = shouldPropagateToTarget('https://evil.com/api', targets)
      expect(result).toBe(false)
    })

    it('should match with complex RegExp', () => {
      const targets: TracePropagationTarget[] = [/^(api|staging)\.example\.com$/]
      expect(shouldPropagateToTarget('https://api.example.com/v1', targets)).toBe(true)
      expect(shouldPropagateToTarget('https://staging.example.com/v1', targets)).toBe(true)
      expect(shouldPropagateToTarget('https://prod.example.com/v1', targets)).toBe(false)
    })
  })

  describe('function matchers', () => {
    it('should match with custom function', () => {
      const targets: TracePropagationTarget[] = [(url) => url.hostname === 'myproject.supabase.co']
      const result = shouldPropagateToTarget('https://myproject.supabase.co/rest/v1/table', targets)
      expect(result).toBe(true)
    })

    it('should not match with custom function returning false', () => {
      const targets: TracePropagationTarget[] = [(url) => url.hostname === 'myproject.supabase.co']
      const result = shouldPropagateToTarget('https://evil.com/api', targets)
      expect(result).toBe(false)
    })

    it('should match with custom function checking protocol', () => {
      const targets: TracePropagationTarget[] = [(url) => url.protocol === 'https:']
      expect(shouldPropagateToTarget('https://example.com/api', targets)).toBe(true)
      expect(shouldPropagateToTarget('http://example.com/api', targets)).toBe(false)
    })

    it('should match with custom function checking port', () => {
      const targets: TracePropagationTarget[] = [(url) => url.port === '3000']
      expect(shouldPropagateToTarget('http://localhost:3000/api', targets)).toBe(true)
      expect(shouldPropagateToTarget('http://localhost:8080/api', targets)).toBe(false)
    })

    it('should handle function matcher throwing error', () => {
      const targets: TracePropagationTarget[] = [
        () => {
          throw new Error('Matcher error')
        },
      ]
      const result = shouldPropagateToTarget('https://example.com/api', targets)
      expect(result).toBe(false)
    })
  })

  describe('multiple matchers', () => {
    it('should match any of multiple targets', () => {
      const targets: TracePropagationTarget[] = [
        'myproject.supabase.co',
        '*.internal.company.com',
        /.*\.trusted\.com$/,
        (url) => url.hostname === 'localhost',
      ]

      expect(shouldPropagateToTarget('https://myproject.supabase.co/api', targets)).toBe(true)
      expect(shouldPropagateToTarget('https://api.internal.company.com/v1', targets)).toBe(true)
      expect(shouldPropagateToTarget('https://service.trusted.com/endpoint', targets)).toBe(true)
      expect(shouldPropagateToTarget('http://localhost:3000/api', targets)).toBe(true)
      expect(shouldPropagateToTarget('https://evil.com/api', targets)).toBe(false)
    })

    it('should stop at first match', () => {
      const mockFn = jest.fn(() => false)
      const targets: TracePropagationTarget[] = ['example.com', mockFn]

      shouldPropagateToTarget('https://example.com/api', targets)

      // Should not call second matcher if first matches
      expect(mockFn).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should return false for empty targets array', () => {
      const result = shouldPropagateToTarget('https://example.com/api', [])
      expect(result).toBe(false)
    })

    it('should return false for null URL', () => {
      const result = shouldPropagateToTarget(null as any, ['example.com'])
      expect(result).toBe(false)
    })

    it('should return false for undefined URL', () => {
      const result = shouldPropagateToTarget(undefined as any, ['example.com'])
      expect(result).toBe(false)
    })

    it('should return false for empty string URL', () => {
      const result = shouldPropagateToTarget('', ['example.com'])
      expect(result).toBe(false)
    })

    it('should return false for invalid URL', () => {
      const result = shouldPropagateToTarget('not-a-url', ['example.com'])
      expect(result).toBe(false)
    })

    it('should return false for null targets', () => {
      const result = shouldPropagateToTarget('https://example.com/api', null as any)
      expect(result).toBe(false)
    })

    it('should handle URL with query parameters', () => {
      const targets: TracePropagationTarget[] = ['example.com']
      const result = shouldPropagateToTarget('https://example.com/api?foo=bar', targets)
      expect(result).toBe(true)
    })

    it('should handle URL with hash', () => {
      const targets: TracePropagationTarget[] = ['example.com']
      const result = shouldPropagateToTarget('https://example.com/api#section', targets)
      expect(result).toBe(true)
    })

    it('should handle URL with auth', () => {
      const targets: TracePropagationTarget[] = ['example.com']
      const result = shouldPropagateToTarget('https://user:pass@example.com/api', targets)
      expect(result).toBe(true)
    })
  })
})
