import { describe, expect, it } from '@jest/globals'
import { corsHeaders, type CorsHeaders } from '../../src/cors'
import { createClient, FunctionRegion, type SupabaseClient } from '../../src/index'

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

      // Pin the exact list. This catches an accidental edit to SUPABASE_HEADERS;
      // the "headers the SDK actually sends" describe block below is what catches
      // a new header being sent without being added here.
      expect(allowedHeaders.split(', ').sort()).toEqual(
        [
          'authorization',
          'x-client-info',
          'apikey',
          'content-type',
          'accept-profile',
          'content-profile',
          'cache-control',
          'x-supabase-api-version',
          'x-region',
          'x-upsert',
          'x-metadata',
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

  describe('headers the SDK actually sends', () => {
    // The pinned list above only compares SUPABASE_HEADERS against a copy of
    // itself, so it cannot notice a sub-client starting to send a new header.
    // These cases drive the sub-clients through a recording fetch and assert
    // every request header they emit is covered by the allow-list — which is
    // the property Edge Functions using `corsHeaders` actually depend on.
    const allowed = new Set(
      corsHeaders['Access-Control-Allow-Headers'].split(',').map((h) => h.trim().toLowerCase())
    )

    const headerNamesFrom = (init: RequestInit | undefined): string[] => {
      const headers = init?.headers
      if (!headers) return []
      if (headers instanceof Headers) return [...headers.keys()].map((k) => k.toLowerCase())
      if (Array.isArray(headers)) return headers.map(([name]) => name.toLowerCase())
      return Object.keys(headers).map((name) => name.toLowerCase())
    }

    /** Runs `exercise` against a client whose fetch records request header names. */
    const observeHeaders = async (
      exercise: (client: SupabaseClient) => PromiseLike<unknown>
    ): Promise<string[]> => {
      const seen: string[] = []
      const recordingFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        seen.push(...headerNamesFrom(init))
        return new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const client = createClient('http://localhost:3000', 'some.fake.key', {
        global: { fetch: recordingFetch as typeof fetch },
      })
      await exercise(client)
      return [...new Set(seen)]
    }

    const expectAllAllowed = (observed: string[]) => {
      expect(observed.length).toBeGreaterThan(0)
      expect(observed.filter((name) => !allowed.has(name))).toEqual([])
    }

    it('covers the headers functions.invoke sends for a region', async () => {
      const observed = await observeHeaders((client) =>
        client.functions.invoke('hello', {
          region: FunctionRegion.UsEast1,
          body: { hello: 'world' },
        })
      )
      expect(observed).toContain('x-region')
      expectAllAllowed(observed)
    })

    it('covers the headers a storage upload sends', async () => {
      const observed = await observeHeaders((client) =>
        client.storage.from('bucket').upload('note.txt', 'hello', {
          upsert: true,
          contentType: 'text/plain',
          metadata: { owner: 'tests' },
        })
      )
      expect(observed).toEqual(expect.arrayContaining(['x-upsert', 'x-metadata', 'cache-control']))
      expectAllAllowed(observed)
    })

    it('covers the headers an auth request sends', async () => {
      const observed = await observeHeaders((client) => client.auth.getUser('some.jwt.token'))
      expect(observed).toContain('x-supabase-api-version')
      expectAllAllowed(observed)
    })

    it('covers the headers a postgrest read sends', async () => {
      const observed = await observeHeaders((client) => client.from('users').select('id'))
      expect(observed).toContain('accept-profile')
      expectAllAllowed(observed)
    })

    it('covers the headers a postgrest write sends', async () => {
      const observed = await observeHeaders((client) => client.from('users').insert({ id: 1 }))
      expect(observed).toContain('content-profile')
      expectAllAllowed(observed)
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
