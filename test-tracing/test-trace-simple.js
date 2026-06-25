#!/usr/bin/env node
/**
 * Simple JavaScript test for trace propagation
 * This version works without TypeScript compilation
 *
 * Updated to match the current API (enabled/respectSamplingDecision only)
 */

import { trace, context, propagation } from '@opentelemetry/api'
import otelSdk from '@opentelemetry/sdk-node'
import otelResources from '@opentelemetry/resources'
import otelSemconv from '@opentelemetry/semantic-conventions'
import otelTrace from '@opentelemetry/sdk-trace-node'
import { createClient } from '@supabase/supabase-js'

const { NodeSDK } = otelSdk
const { resourceFromAttributes } = otelResources
const { ATTR_SERVICE_NAME } = otelSemconv
const { ConsoleSpanExporter } = otelTrace

console.log('Starting Trace Propagation Test\n')

// Initialize OpenTelemetry
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'trace-test',
  }),
  traceExporter: new ConsoleSpanExporter(),
})

sdk.start()
console.log('OpenTelemetry SDK initialized\n')

// Wrap fetch to log headers
const originalFetch = global.fetch
global.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.href

  console.log('HTTP Request:', url.substring(0, 80) + '...')
  console.log('Headers:')

  if (init?.headers) {
    const headers = new Headers(init.headers)
    headers.forEach((value, key) => {
      if (['traceparent', 'tracestate', 'baggage'].includes(key.toLowerCase())) {
        console.log(`   [trace] ${key}: ${value}`)
      } else if (['authorization', 'apikey'].includes(key.toLowerCase())) {
        console.log(`   [auth]  ${key}: [REDACTED]`)
      }
    })
  }
  console.log('')

  return originalFetch(input, init)
}

// Main test
async function runTest() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://example.supabase.co'
  const supabaseKey = process.env.SUPABASE_KEY || 'example-key'

  console.log('='.repeat(80))
  console.log('TEST 1: Default (enabled) - Should include trace headers')
  console.log('='.repeat(80) + '\n')

  const supabase = createClient(supabaseUrl, supabaseKey)
  const tracer = trace.getTracer('test')

  await tracer.startActiveSpan('test-operation', async (span) => {
    const carrier = {}
    propagation.inject(context.active(), carrier)

    console.log('Active Span Context:')
    console.log(`   traceparent: ${carrier.traceparent}`)
    console.log('')

    try {
      await supabase.from('test').select('*').limit(1)
    } catch (err) {
      console.log('Request failed (expected with placeholder credentials)\n')
    }

    span.end()
  })

  console.log('='.repeat(80))
  console.log('TEST 2: Disabled (enabled: false) - Should NOT include trace headers')
  console.log('='.repeat(80) + '\n')

  const supabaseOff = createClient(supabaseUrl, supabaseKey, {
    tracePropagation: { enabled: false },
  })

  await tracer.startActiveSpan('test-off', async (span) => {
    try {
      await supabaseOff.from('test').select('*').limit(1)
    } catch (err) {
      console.log('Request failed (expected)\n')
    }

    span.end()
  })

  console.log('='.repeat(80))
  console.log('TEST 3: No Active Span - Should NOT include trace headers')
  console.log('='.repeat(80) + '\n')

  const supabaseNoSpan = createClient(supabaseUrl, supabaseKey)

  try {
    await supabaseNoSpan.from('test').select('*').limit(1)
  } catch (err) {
    console.log('Request failed (expected)\n')
  }

  console.log('='.repeat(80))
  console.log('All tests completed!')
  console.log('='.repeat(80))

  await sdk.shutdown()
}

runTest().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
