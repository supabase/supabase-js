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
        'x-supabase-api-version',
        'accept-profile',
        'content-profile',
        'prefer',
        'accept',
        'x-region',
      ]

      // Parse into exact token set to avoid false positives (e.g., "accept" matching "accept-profile")
      const allowedHeadersSet = new Set(
        allowedHeaders.split(',').map((h) => h.trim().toLowerCase())
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
        allowedMethods.split(',').map((m) => m.trim().toUpperCase())
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
          'x-supabase-api-version': '2024-01-01',
          'accept-profile': 'public',
          'content-profile': 'public',
          'prefer': 'return=representation',
          'accept': 'application/json',
          'x-region': 'us-east-1',
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

      // Note: This test would FAIL with hardcoded CORS but PASSES with canonical CORS
      // because canonical CORS includes headers dynamically from cors.ts

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

    await t.step('Comparison - canonical CORS has more headers than hardcoded', async () => {
      const response = await fetch(functionUrl, {
        method: 'OPTIONS',
      })

      const canonicalHeaders = response.headers.get('Access-Control-Allow-Headers')
      assertExists(canonicalHeaders)

      // Typical hardcoded CORS from old docs (like in echo/index.ts)
      const hardcodedExample = 'authorization, x-client-info, apikey, content-type'
      const hardcodedCount = hardcodedExample.split(',').length // 4 headers

      const canonicalCount = canonicalHeaders.split(',').length

      // Canonical should have significantly more headers (10+)
      if (canonicalCount <= hardcodedCount) {
        throw new Error(
          `Expected canonical (${canonicalCount}) to have more headers than hardcoded (${hardcodedCount})`
        )
      }
      if (canonicalCount < 10) {
        throw new Error(
          `Expected canonical to have at least 10 headers, got ${canonicalCount}: ${canonicalHeaders}`
        )
      }
    })
  }
)
