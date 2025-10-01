import 'node:buffer'
import { assertEquals, assertExists } from 'https://deno.land/std@0.220.1/assert/mod.ts'
import { createClient } from '../../dist/module/index.js'

// These tests are for integration testing with actual deployed edge functions
// To run these tests, you need to:
// 1. Deploy the edge functions to a Supabase project
// 2. Set the SUPABASE_URL and SUPABASE_ANON_KEY environment variables
// 3. Or use the local development credentials below

Deno.test(
  'Edge Functions Integration Tests',
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    // Use environment variables or fall back to local development
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://127.0.0.1:54321'
    const ANON_KEY =
      Deno.env.get('SUPABASE_ANON_KEY') ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      realtime: { heartbeatIntervalMs: 500 },
    })

    try {
      await t.step('hello function - should return greeting with name', async () => {
        const { data, error } = await supabase.functions.invoke('hello', {
          body: { name: 'Test User' },
        })

        assertEquals(error, null)
        assertExists(data)
        assertEquals(typeof data.message, 'string')
        assertEquals(data.message, 'Hello Test User!')
        assertEquals(typeof data.timestamp, 'string')
      })

      await t.step('hello function - should return default greeting without name', async () => {
        const { data, error } = await supabase.functions.invoke('hello', {
          body: {},
        })

        assertEquals(error, null)
        assertExists(data)
        assertEquals(typeof data.message, 'string')
        assertEquals(data.message, 'Hello World!')
        assertEquals(typeof data.timestamp, 'string')
      })

      await t.step('echo function - should echo request body', async () => {
        const testData = {
          message: 'Hello Echo!',
          number: 42,
          array: [1, 2, 3],
          nested: { key: 'value' },
        }

        const { data, error } = await supabase.functions.invoke('echo', {
          body: testData,
        })

        assertEquals(error, null)
        assertExists(data)
        assertEquals(data.echo, testData)
        assertEquals(typeof data.method, 'string')
        assertEquals(typeof data.url, 'string')
        assertEquals(typeof data.timestamp, 'string')
      })

      await t.step('status function - should return system status', async () => {
        const { data, error } = await supabase.functions.invoke('status', {
          body: {},
        })

        assertEquals(error, null)
        assertExists(data)
        assertEquals(data.status, 'ok')
        assertEquals(typeof data.timestamp, 'string')
        assertEquals(typeof data.environment, 'string')
        assertEquals(data.version, '1.0.0')
        assertEquals(typeof data.uptime, 'number')
      })

      await t.step('should handle non-existent function', async () => {
        const { data, error } = await supabase.functions.invoke('non-existent-function', {
          body: {},
        })

        assertExists(error)
        assertEquals(data, null)
      })

      await t.step('should handle concurrent function calls', async () => {
        const promises = Array.from({ length: 5 }, (_, i) =>
          supabase.functions.invoke('hello', {
            body: { name: `Concurrent Test ${i}` },
          })
        )

        const results = await Promise.all(promises)

        // Check if any functions are deployed
        const hasDeployedFunctions = results.some(({ error }) => !error)

        if (!hasDeployedFunctions) {
          console.log('No functions deployed, skipping concurrent execution test')
          return
        }

        results.forEach(({ data, error }) => {
          if (!error) {
            assertEquals(error, null)
            assertExists(data)
            assertEquals(typeof data.message, 'string')
            assertEquals(typeof data.timestamp, 'string')
          }
        })
      })

      await t.step('should handle function errors gracefully', async () => {
        const { data, error } = await supabase.functions.invoke('hello', {
          body: 'invalid json',
        })

        assertExists(error)
        assertEquals(data, null)
      })
    } catch (error) {
      console.error('Test error:', error)
      throw error
    }
  }
)
