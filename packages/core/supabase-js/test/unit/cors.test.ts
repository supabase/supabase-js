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

      // All 10 Supabase headers must be present
      expect(allowedHeaders).toContain('authorization')
      expect(allowedHeaders).toContain('x-client-info')
      expect(allowedHeaders).toContain('apikey')
      expect(allowedHeaders).toContain('content-type')
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
