import { assertEquals, assertExists } from 'https://deno.land/std@0.220.1/assert/mod.ts'

// Helper to assert preflight status (Kong gateway may return 200 instead of 204)
function assertPreflightStatus(actual: number) {
  if (actual !== 200 && actual !== 204) {
    throw new Error(`Expected preflight status 200 or 204, got ${actual}`)
  }
}

Deno.test(
  'CORS Error Scenarios',
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    const FUNCTIONS_URL = 'http://127.0.0.1:54321/functions/v1'
    const functionUrl = `${FUNCTIONS_URL}/cors-errors`

    const errorCases = [
      { type: 'bad-request', status: 400 },
      { type: 'unauthorized', status: 401 },
      { type: 'not-found', status: 404 },
      { type: 'server-error', status: 500 },
    ]

    for (const { type, status } of errorCases) {
      await t.step(`${status} error - should include CORS headers`, async () => {
        const response = await fetch(`${functionUrl}?error=${type}`)

        assertEquals(response.status, status)

        // Critical: CORS headers must be present even in error responses
        assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
        assertExists(response.headers.get('Access-Control-Allow-Headers'))
        assertExists(response.headers.get('Access-Control-Allow-Methods'))

        const data = await response.json()
        assertExists(data.error)
      })

      await t.step(`${status} error - preflight should still work`, async () => {
        const response = await fetch(`${functionUrl}?error=${type}`, {
          method: 'OPTIONS',
          headers: {
            'Origin': 'https://example.com',
            'Access-Control-Request-Method': 'GET',
          },
        })

        // Kong gateway may return 200 instead of 204 for OPTIONS
        assertPreflightStatus(response.status)
        assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
      })
    }
  }
)
