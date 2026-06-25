#!/usr/bin/env node
/**
 * TypeScript test for trace propagation
 *
 * Updated to match the current API (enabled/respectSamplingDecision only)
 */

import { trace, context, propagation, SpanStatusCode } from '@opentelemetry/api'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { Resource } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node'
import { createClient } from '@supabase/supabase-js'

// Initialize OpenTelemetry SDK
console.log('Initializing OpenTelemetry SDK...\n')

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'tracing-test',
  }),
  traceExporter: new ConsoleSpanExporter(),
})

sdk.start()

// Create a custom fetch that logs the headers
const originalFetch = global.fetch
const fetchWithLogging = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

  console.log(`\nOutgoing HTTP Request:`)
  console.log(`   URL: ${url}`)
  console.log(`   Headers:`)

  if (init?.headers) {
    const headers = new Headers(init.headers)
    headers.forEach((value, key) => {
      // Highlight trace headers
      if (['traceparent', 'tracestate', 'baggage'].includes(key.toLowerCase())) {
        console.log(`   [trace] ${key}: ${value}`)
      } else if (['authorization', 'apikey'].includes(key.toLowerCase())) {
        console.log(`   [auth]  ${key}: [REDACTED]`)
      } else {
        console.log(`          ${key}: ${value}`)
      }
    })
  }

  return originalFetch(input, init)
}

// Main test function
async function testTracePropagation() {
  console.log('\n' + '='.repeat(80))
  console.log('TESTING TRACE PROPAGATION WITH SUPABASE JS SDK')
  console.log('='.repeat(80) + '\n')

  // Get Supabase credentials from environment or use placeholders
  const supabaseUrl = process.env.SUPABASE_URL || 'https://example.supabase.co'
  const supabaseKey = process.env.SUPABASE_KEY || 'example-anon-key'

  console.log(`Supabase URL: ${supabaseUrl}`)
  console.log(`Supabase Key: ${supabaseKey.substring(0, 20)}...`)

  // Test 1: Default (enabled)
  console.log('\n' + '-'.repeat(80))
  console.log('Test 1: Default (enabled)')
  console.log('-'.repeat(80))

  const supabaseAuto = createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: fetchWithLogging,
    },
  })

  const tracer = trace.getTracer('test-tracer')

  await tracer.startActiveSpan('test-auto-mode', async (span) => {
    console.log(`\nActive Span Created:`)
    console.log(`   Trace ID: ${span.spanContext().traceId}`)
    console.log(`   Span ID: ${span.spanContext().spanId}`)
    console.log(`   Sampled: ${span.spanContext().traceFlags === 1}`)

    // Extract current trace context
    const carrier: Record<string, string> = {}
    propagation.inject(context.active(), carrier)
    console.log(`\nCurrent Trace Context:`)
    console.log(`   traceparent: ${carrier.traceparent || 'none'}`)
    console.log(`   tracestate: ${carrier.tracestate || 'none'}`)

    try {
      console.log(`\nMaking request to Supabase...`)
      const { error } = await supabaseAuto.from('test_table').select('*').limit(1)

      if (error && error.message.includes('JWT')) {
        console.log(`\nAuthentication error (expected with placeholder credentials)`)
      } else if (error) {
        console.log(`\nRequest error: ${error.message}`)
      } else {
        console.log(`\nRequest successful`)
      }
    } catch (err: any) {
      console.log(`\nNetwork error (expected if using placeholder URL): ${err.message}`)
    } finally {
      span.end()
    }
  })

  // Test 2: Disabled
  console.log('\n' + '-'.repeat(80))
  console.log('Test 2: Disabled (enabled: false)')
  console.log('-'.repeat(80))

  const supabaseOff = createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: fetchWithLogging,
    },
    tracePropagation: {
      enabled: false,
    },
  })

  await tracer.startActiveSpan('test-disabled', async (span) => {
    console.log(`\nActive Span Created (enabled: false):`)
    console.log(`   Trace ID: ${span.spanContext().traceId}`)

    try {
      console.log(`\nMaking request to Supabase (trace headers should NOT be present)...`)
      const { error } = await supabaseOff.from('test_table').select('*').limit(1)

      if (error && error.message.includes('JWT')) {
        console.log(`\nAuthentication error (expected with placeholder credentials)`)
      }
    } catch (err: any) {
      console.log(`\nNetwork error: ${err.message}`)
    } finally {
      span.end()
    }
  })

  // Test 3: No active span
  console.log('\n' + '-'.repeat(80))
  console.log('Test 3: No Active Span')
  console.log('-'.repeat(80))

  const supabaseNoSpan = createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: fetchWithLogging,
    },
  })

  try {
    console.log(`\nMaking request without active span (trace headers should NOT be present)...`)
    const { error } = await supabaseNoSpan.from('test_table').select('*').limit(1)

    if (error && error.message.includes('JWT')) {
      console.log(`\nAuthentication error (expected with placeholder credentials)`)
    }
  } catch (err: any) {
    console.log(`\nNetwork error: ${err.message}`)
  }

  // Summary
  console.log('\n' + '='.repeat(80))
  console.log('TEST SUMMARY')
  console.log('='.repeat(80))
  console.log(`
Test 1 (Default):  Trace headers should be present in request
Test 2 (Disabled): Trace headers should NOT be present in request
Test 3 (No Span):  Trace headers should NOT be present in request

To verify:
1. Check the "Outgoing HTTP Request" logs above
2. Look for [trace] markers next to traceparent/tracestate headers
3. In Test 1, traceparent should match the active span's trace/span IDs
4. In Tests 2 and 3, no trace headers should be present
`)

  // Flush and shutdown
  console.log('Flushing traces and shutting down SDK...\n')
  await sdk.shutdown()
  console.log('Test completed!\n')
}

// Run the test
testTracePropagation().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
