import { assertEquals, assertExists } from 'https://deno.land/std@0.220.1/assert/mod.ts'

// Helper to assert preflight status (Kong gateway may return 200 instead of 204)
function assertPreflightStatus(actual: number) {
  if (actual !== 200 && actual !== 204) {
    throw new Error(`Expected preflight status 200 or 204, got ${actual}`)
  }
}

Deno.test(
  'CORS HTTP Methods Validation',
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    const FUNCTIONS_URL = 'http://127.0.0.1:54321/functions/v1'
    const functionUrl = `${FUNCTIONS_URL}/cors-http-methods`

    // Test simple methods (should work without explicit Access-Control-Allow-Methods)
    // Note: For POST to be CORS-simple, we use text/plain content type
    const simpleMethods = ['GET', 'POST']
    for (const method of simpleMethods) {
      await t.step(`${method} request - simple method should work`, async () => {
        const response = await fetch(functionUrl, {
          method,
          headers: method === 'POST' ? { 'Content-Type': 'text/plain' } : {},
          body: method === 'POST' ? 'test data' : undefined,
        })

        assertEquals(response.status, 200)
        const data = await response.json()
        assertEquals(data.method, method)
        assertEquals(data.success, true)
      })
    }

    // Test non-simple methods (REQUIRE Access-Control-Allow-Methods)
    const nonSimpleMethods = ['PUT', 'PATCH', 'DELETE']
    for (const method of nonSimpleMethods) {
      await t.step(`${method} preflight - should return success with allowed methods`, async () => {
        const response = await fetch(functionUrl, {
          method: 'OPTIONS',
          headers: {
            'Origin': 'https://example.com',
            'Access-Control-Request-Method': method,
            'Access-Control-Request-Headers': 'content-type',
          },
        })

        // Kong gateway may return 200 instead of 204 for OPTIONS
        assertPreflightStatus(response.status)

        const allowedMethods = response.headers.get('Access-Control-Allow-Methods')
        assertExists(allowedMethods)

        // Verify the method is explicitly allowed
        if (!allowedMethods?.toUpperCase().includes(method)) {
          throw new Error(`Method ${method} not found in Access-Control-Allow-Methods: ${allowedMethods}`)
        }
      })

      await t.step(`${method} request - non-simple method should work with CORS`, async () => {
        const response = await fetch(functionUrl, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: ['PUT', 'PATCH'].includes(method) ? JSON.stringify({ test: 'data' }) : undefined,
        })

        assertEquals(response.status, 200)
        const data = await response.json()
        assertEquals(data.method, method)
        assertEquals(data.success, true)

        // Verify CORS headers in response
        assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
      })
    }
  }
)
