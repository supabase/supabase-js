import { describe, expect, it } from '@jest/globals'
import { corsHeaders, createCorsHeaders, type CorsHeaders, type CorsOptions } from '../../src/cors'

describe('CORS Module', () => {
  describe('corsHeaders', () => {
    it('should have all required CORS properties', () => {
      expect(corsHeaders).toHaveProperty('Access-Control-Allow-Origin')
      expect(corsHeaders).toHaveProperty('Access-Control-Allow-Headers')
      expect(corsHeaders).toHaveProperty('Access-Control-Allow-Methods')
    })

    it('should use wildcard origin by default', () => {
      expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*')
    })

    it('should include all Supabase custom headers', () => {
      const allowedHeaders = corsHeaders['Access-Control-Allow-Headers']

      // All 10 Supabase headers must be present
      expect(allowedHeaders).toContain('authorization')
      expect(allowedHeaders).toContain('x-client-info')
      expect(allowedHeaders).toContain('apikey')
      expect(allowedHeaders).toContain('content-type')
      expect(allowedHeaders).toContain('x-supabase-api-version')
      expect(allowedHeaders).toContain('accept-profile')
      expect(allowedHeaders).toContain('content-profile')
      expect(allowedHeaders).toContain('prefer')
      expect(allowedHeaders).toContain('accept')
      expect(allowedHeaders).toContain('x-region')
    })

    it('should include all HTTP methods including OPTIONS', () => {
      const allowedMethods = corsHeaders['Access-Control-Allow-Methods']

      expect(allowedMethods).toContain('GET')
      expect(allowedMethods).toContain('POST')
      expect(allowedMethods).toContain('PUT')
      expect(allowedMethods).toContain('PATCH')
      expect(allowedMethods).toContain('DELETE')
      expect(allowedMethods).toContain('OPTIONS')
    })

    it('should not include Access-Control-Allow-Credentials by default', () => {
      expect(corsHeaders).not.toHaveProperty('Access-Control-Allow-Credentials')
    })
  })

  describe('createCorsHeaders', () => {
    it('should work with default options', () => {
      const headers = createCorsHeaders()

      expect(headers['Access-Control-Allow-Origin']).toBe('*')
      expect(headers).toHaveProperty('Access-Control-Allow-Headers')
      expect(headers).toHaveProperty('Access-Control-Allow-Methods')
      expect(headers).not.toHaveProperty('Access-Control-Allow-Credentials')
    })

    it('should accept a custom single origin', () => {
      const headers = createCorsHeaders({
        origin: 'https://myapp.com',
      })

      expect(headers['Access-Control-Allow-Origin']).toBe('https://myapp.com')
    })

    it('should enable credentials when specified', () => {
      const headers = createCorsHeaders({
        origin: 'https://myapp.com',
        credentials: true,
      })

      expect(headers['Access-Control-Allow-Credentials']).toBe('true')
    })

    it('should throw error when using credentials with wildcard origin', () => {
      expect(() => {
        createCorsHeaders({
          origin: '*',
          credentials: true,
        })
      }).toThrow('Cannot use credentials: true with origin: "*"')
    })

    it('should merge additional headers with Supabase headers', () => {
      const headers = createCorsHeaders({
        additionalHeaders: ['x-custom-header', 'x-another-header'],
      })

      const allowedHeaders = headers['Access-Control-Allow-Headers']

      // Should include both Supabase and custom headers
      expect(allowedHeaders).toContain('authorization')
      expect(allowedHeaders).toContain('x-custom-header')
      expect(allowedHeaders).toContain('x-another-header')
    })

    it('should merge additional methods with Supabase methods', () => {
      const headers = createCorsHeaders({
        additionalMethods: ['HEAD', 'TRACE'],
      })

      const allowedMethods = headers['Access-Control-Allow-Methods']

      // Should include both Supabase and custom methods
      expect(allowedMethods).toContain('GET')
      expect(allowedMethods).toContain('POST')
      expect(allowedMethods).toContain('HEAD')
      expect(allowedMethods).toContain('TRACE')
    })

    it('should handle all options combined', () => {
      const headers = createCorsHeaders({
        origin: 'https://myapp.com',
        credentials: true,
        additionalHeaders: ['x-custom'],
        additionalMethods: ['HEAD'],
      })

      expect(headers['Access-Control-Allow-Origin']).toBe('https://myapp.com')
      expect(headers['Access-Control-Allow-Credentials']).toBe('true')
      expect(headers['Access-Control-Allow-Headers']).toContain('x-custom')
      expect(headers['Access-Control-Allow-Methods']).toContain('HEAD')
    })

    it('should not add trailing comma when no additional headers', () => {
      const headers = createCorsHeaders()
      const allowedHeaders = headers['Access-Control-Allow-Headers']

      expect(allowedHeaders).not.toMatch(/,\s*$/)
    })

    it('should not add trailing comma when no additional methods', () => {
      const headers = createCorsHeaders()
      const allowedMethods = headers['Access-Control-Allow-Methods']

      expect(allowedMethods).not.toMatch(/,\s*$/)
    })
  })

  describe('TypeScript types', () => {
    it('should export CorsHeaders type', () => {
      const headers: CorsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'test',
      }

      expect(headers).toBeDefined()
    })

    it('should export CorsOptions type', () => {
      const options: CorsOptions = {
        origin: 'https://myapp.com',
        credentials: true,
        additionalHeaders: ['x-custom'],
        additionalMethods: ['HEAD'],
      }

      expect(options).toBeDefined()
    })
  })

  describe('Integration scenarios', () => {
    it('should work for basic Edge Function CORS setup', () => {
      // Simulate OPTIONS preflight
      const preflightResponse = new Response('ok', { headers: corsHeaders })

      expect(preflightResponse.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(preflightResponse.headers.get('Access-Control-Allow-Headers')).toContain(
        'authorization'
      )
    })

    it('should work for Edge Function with custom origin', () => {
      const customHeaders = createCorsHeaders({
        origin: 'https://myapp.com',
        credentials: true,
      })

      const response = new Response(JSON.stringify({ data: 'Hello' }), {
        headers: {
          ...customHeaders,
          'Content-Type': 'application/json',
        },
      })

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://myapp.com')
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })
  })
})
