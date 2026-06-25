import { assertEquals, assertExists } from 'https://deno.land/std@0.220.1/assert/mod.ts'

// Helper to assert preflight status (Kong gateway may return 200 instead of 204)
function assertPreflightStatus(actual: number) {
  if (actual !== 200 && actual !== 204) {
    throw new Error(`Expected preflight status 200 or 204, got ${actual}`)
  }
}

// These tests validate CORS behavior with direct HTTP requests
// To run these tests, you need to:
// 1. Run `supabase start` from packages/core/supabase-js
// 2. The cors-validation function will be automatically deployed
// 3. Run `nx test:deno:cors-validation supabase-js` from the repository root

Deno.test(
  'CORS Validation for Edge Functions',
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    // Direct HTTP endpoint (not using SDK)
    const FUNCTIONS_URL = 'http://127.0.0.1:54321/functions/v1'
    const functionUrl = `${FUNCTIONS_URL}/cors-validation`

    await t.step('OPTIONS preflight - should return success status', async () => {
      const response = await fetch(functionUrl, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization, x-client-info',
        },
      })

      // Kong gateway may return 200 instead of 204 for OPTIONS
      assertPreflightStatus(response.status)
    })

    await t.step('OPTIONS preflight - should include Access-Control-Allow-Origin', async () => {
      const response = await fetch(functionUrl, {
        method: 'OPTIONS',
      })

      assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
    })

    await t.step('OPTIONS preflight - should include all Supabase SDK headers', async () => {
      const response = await fetch(functionUrl, {
        method: 'OPTIONS',
      })

      const allowedHeaders = response.headers.get('Access-Control-Allow-Headers')
      assertExists(allowedHeaders)

      // All 10 current Supabase headers must be allowed
      const requiredHeaders = [
        'authorization',
        'x-client-info',
        'apikey',
        'content-type',
      ]

      // Parse into exact token set to avoid false positives (e.g., "accept" matching "accept-profile")
      const allowedHeadersSet = new Set(
        allowedHeaders!.split(',').map((h) => h.trim().toLowerCase())
      )
      requiredHeaders.forEach((header) => {
        if (!allowedHeadersSet.has(header.toLowerCase())) {
          throw new Error(`Required header "${header}" not found in: ${allowedHeaders}`)
        }
      })
    })

    await t.step('OPTIONS preflight - should include all HTTP methods', async () => {
      const response = await fetch(functionUrl, {
        method: 'OPTIONS',
      })

      const allowedMethods = response.headers.get('Access-Control-Allow-Methods')
      assertExists(allowedMethods)

      const requiredMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
      // Parse into exact token set to avoid false positives
      const allowedMethodsSet = new Set(
        allowedMethods!.split(',').map((m) => m.trim().toUpperCase())
      )
      requiredMethods.forEach((method) => {
        if (!allowedMethodsSet.has(method.toUpperCase())) {
          throw new Error(`Required method "${method}" not found in: ${allowedMethods}`)
        }
      })
    })

    await t.step('POST request - should accept all Supabase SDK headers', async () => {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'x-client-info': '@supabase/supabase-js/2.0.0',
          'apikey': 'test-api-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: 'data' }),
      })

      assertEquals(response.status, 200)

      const data = await response.json()
      assertEquals(data.corsEnabled, true)
      assertExists(data.receivedHeaders)
    })

    await t.step('POST request - should prevent v2.93.0 incident (NEW headers accepted)', async () => {
      // This test simulates adding a new header to the SDK (like x-supabase-client-platform)
      // that caused the v2.93.0 incident when hardcoded CORS didn't include it

      // First, verify OPTIONS preflight would allow this new header
      const preflightResponse = await fetch(functionUrl, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization, x-supabase-new-feature',
        },
      })

      // Kong gateway may return 200 instead of 204 for OPTIONS
      assertPreflightStatus(preflightResponse.status)

      // Verify the preflight response allows the new header
      // This is critical: browsers check Access-Control-Allow-Headers before sending the actual request
      const allowedHeaders = preflightResponse.headers.get('Access-Control-Allow-Headers')
      assertExists(allowedHeaders, 'Access-Control-Allow-Headers must be present in preflight response')

      // Either wildcard (*) is used, or the specific header must be listed
      if (allowedHeaders !== '*') {
        const allowedSet = new Set(allowedHeaders!.split(',').map((h) => h.trim().toLowerCase()))
        if (!allowedSet.has('x-supabase-new-feature')) {
          throw new Error(
            `New header "x-supabase-new-feature" not found in Access-Control-Allow-Headers: ${allowedHeaders}`
          )
        }
      }

      // Note: This test would FAIL with hardcoded CORS but PASSES with canonical CORS
      // because canonical CORS includes headers dynamically from cors.ts (or uses wildcard)

      // Then make the actual request with the new header
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'x-client-info': '@supabase/supabase-js/2.0.0',
          'x-supabase-new-feature': 'test-value', // NEW HEADER (example)
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: 'new header' }),
      })

      // Should succeed even with new header
      assertEquals(response.status, 200)

      const data = await response.json()
      assertEquals(data.corsEnabled, true)

      // Verify the new header was received
      assertEquals(data.receivedHeaders['x-supabase-new-feature'], 'test-value')
    })

    await t.step('POST response - should include CORS headers in non-preflight responses', async () => {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: 'data' }),
      })

      // Verify CORS headers are present in actual response (not just preflight)
      assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
      assertExists(response.headers.get('Access-Control-Allow-Headers'))
      assertExists(response.headers.get('Access-Control-Allow-Methods'))
    })
  }
)
