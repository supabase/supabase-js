import { describe, expect, it } from '@jest/globals'
import { corsHeaders, type CorsHeaders } from '../../src/cors'

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

      // Pin the exact list: when the SDK starts sending a new header, this
      // test must fail until the header is added to SUPABASE_HEADERS —
      // otherwise browser preflights break for Edge Functions using corsHeaders.
      expect(allowedHeaders.split(', ').sort()).toEqual(
        [
          'authorization',
          'x-client-info',
          'apikey',
          'content-type',
          'x-retry-count',
          'traceparent',
          'tracestate',
          'baggage',
        ].sort()
      )
    })

    it('should include the trace context headers sent when tracePropagation is enabled', () => {
      const allowedHeaders = corsHeaders['Access-Control-Allow-Headers']

      expect(allowedHeaders).toContain('traceparent')
      expect(allowedHeaders).toContain('tracestate')
      expect(allowedHeaders).toContain('baggage')
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

  describe('TypeScript types', () => {
    it('should export CorsHeaders type', () => {
      const headers: CorsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'test',
      }

      expect(headers).toBeDefined()
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
  })
})
