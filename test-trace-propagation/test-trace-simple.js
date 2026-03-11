#!/usr/bin/env node
/**
 * Simple JavaScript test for trace propagation
 * This version works without TypeScript compilation
 */

import { trace, context, propagation } from '@opentelemetry/api'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { Resource } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node'
import { createClient } from '@supabase/supabase-js'

console.log('🚀 Starting Trace Propagation Test\n')

// Initialize OpenTelemetry
const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'trace-test',
  }),
  traceExporter: new ConsoleSpanExporter(),
})

sdk.start()
console.log('✅ OpenTelemetry SDK initialized\n')

// Wrap fetch to log headers
const originalFetch = global.fetch
global.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.href

  console.log('📤 HTTP Request:', url.substring(0, 80) + '...')
  console.log('📋 Headers:')

  if (init?.headers) {
    const headers = new Headers(init.headers)
    headers.forEach((value, key) => {
      if (['traceparent', 'tracestate', 'baggage'].includes(key.toLowerCase())) {
        console.log(`   ✅ ${key}: ${value}`)
      } else if (['authorization', 'apikey'].includes(key.toLowerCase())) {
        console.log(`   🔑 ${key}: [REDACTED]`)
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
  console.log('TEST 1: Auto Mode (Default) - Should include trace headers')
  console.log('='.repeat(80) + '\n')

  const supabase = createClient(supabaseUrl, supabaseKey)
  const tracer = trace.getTracer('test')

  await tracer.startActiveSpan('test-operation', async (span) => {
    const carrier = {}
    propagation.inject(context.active(), carrier)

    console.log('🎯 Active Span Context:')
    console.log(`   traceparent: ${carrier.traceparent}`)
    console.log('')

    try {
      await supabase.from('test').select('*').limit(1)
    } catch (err) {
      console.log('⚠️  Request failed (expected with placeholder credentials)\n')
    }

    span.end()
  })

  console.log('='.repeat(80))
  console.log('TEST 2: Off Mode - Should NOT include trace headers')
  console.log('='.repeat(80) + '\n')

  const supabaseOff = createClient(supabaseUrl, supabaseKey, {
    tracePropagation: { mode: 'off' },
  })

  await tracer.startActiveSpan('test-off', async (span) => {
    try {
      await supabaseOff.from('test').select('*').limit(1)
    } catch (err) {
      console.log('⚠️  Request failed (expected)\n')
    }

    span.end()
  })

  console.log('='.repeat(80))
  console.log('TEST 3: Custom Extractor - Should include custom trace context')
  console.log('='.repeat(80) + '\n')

  const customContext = {
    traceparent: '00-12345678901234567890123456789012-1234567890123456-01',
    tracestate: 'vendor=custom',
  }

  const supabaseCustom = createClient(supabaseUrl, supabaseKey, {
    tracePropagation: {
      mode: 'auto',
      customExtractor: () => {
        console.log('🔧 Custom extractor called\n')
        return customContext
      },
    },
  })

  try {
    await supabaseCustom.from('test').select('*').limit(1)
  } catch (err) {
    console.log('⚠️  Request failed (expected)\n')
  }

  console.log('='.repeat(80))
  console.log('✅ All tests completed!')
  console.log('='.repeat(80))

  await sdk.shutdown()
}

runTest().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
