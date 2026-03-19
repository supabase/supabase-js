#!/usr/bin/env node
/**
 * Diagnostic test to understand trace propagation behavior
 */

import { trace, context, propagation } from '@opentelemetry/api'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { Resource } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node'
import { createClient } from '@supabase/supabase-js'

console.log('🔍 Diagnostic Test for Trace Propagation\n')

// Initialize OpenTelemetry
const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'diagnostic-test',
  }),
  traceExporter: new ConsoleSpanExporter(),
})

sdk.start()

// Test if OTel API is working
console.log('1️⃣ Testing OpenTelemetry API...')
const tracer = trace.getTracer('test')

await tracer.startActiveSpan('test-span', async (span) => {
  console.log('   ✅ Span created successfully')
  console.log(`   Trace ID: ${span.spanContext().traceId}`)
  console.log(`   Span ID: ${span.spanContext().spanId}`)

  // Try to extract trace context manually
  const carrier = {}
  propagation.inject(context.active(), carrier)

  console.log('   Extracted context:')
  console.log(`   traceparent: ${carrier.traceparent || 'MISSING'}`)
  console.log(`   tracestate: ${carrier.tracestate || 'none'}`)

  span.end()
})

console.log('')

// Test trace propagation with detailed logging
console.log('2️⃣ Testing tracing package directly...')

// Import the tracing utilities directly
const { extractTraceContext, shouldPropagateToTarget, getDefaultPropagationTargets } = await import(
  '../packages/shared/tracing/dist/module/index.js'
)

console.log('   Testing extractTraceContext()...')

await tracer.startActiveSpan('extraction-test', async (span) => {
  // Try to extract without custom extractor
  const extracted = extractTraceContext()
  console.log(`   Result: ${extracted ? JSON.stringify(extracted, null, 2) : 'null'}`)

  // Try with custom extractor
  const extractedCustom = extractTraceContext({
    customExtractor: () => ({
      traceparent: '00-test123-test456-01',
    }),
  })
  console.log(`   Custom extractor result: ${extractedCustom ? 'SUCCESS' : 'FAILED'}`)

  span.end()
})

console.log('')

// Test target validation
console.log('3️⃣ Testing target validation...')
const targets = getDefaultPropagationTargets('https://myproject.supabase.co')
console.log('   Default targets:', targets)

const testUrls = [
  'https://myproject.supabase.co/rest/v1/test',
  'https://example.supabase.co/rest/v1/test',
  'https://evil.com/api',
  'http://localhost:3000/api',
]

testUrls.forEach((url) => {
  const shouldPropagate = shouldPropagateToTarget(url, targets)
  console.log(`   ${shouldPropagate ? '✅' : '❌'} ${url}`)
})

console.log('')

// Test with real Supabase client
console.log('4️⃣ Testing with Supabase client...')

// Intercept fetch to see what headers are sent
const fetchCalls = []
const originalFetch = global.fetch
global.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.href
  const headers = {}

  if (init?.headers) {
    const h = new Headers(init.headers)
    h.forEach((value, key) => {
      headers[key] = value
    })
  }

  fetchCalls.push({ url, headers })

  // Return a mock response to avoid network errors
  return new Response(JSON.stringify({ error: { message: 'Mock response' } }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

const supabase = createClient('https://test.supabase.co', 'test-key', {
  tracePropagation: {
    mode: 'auto',
    customExtractor: () => {
      console.log('   🔧 Custom extractor called!')
      return {
        traceparent: '00-diagnostic-test-trace-id-1234567890123456-01',
        tracestate: 'test=value',
      }
    },
  },
})

console.log('   Making request with custom extractor...')
try {
  await supabase.from('test').select('*').limit(1)
} catch (err) {
  // Expected
}

console.log(`   Total fetch calls: ${fetchCalls.length}`)
fetchCalls.forEach((call, i) => {
  console.log(`   Call ${i + 1}:`)
  console.log(`      URL: ${call.url.substring(0, 60)}...`)
  console.log(`      Has traceparent: ${!!call.headers.traceparent}`)
  if (call.headers.traceparent) {
    console.log(`      traceparent: ${call.headers.traceparent}`)
  }
  if (call.headers.tracestate) {
    console.log(`      tracestate: ${call.headers.tracestate}`)
  }
})

console.log('')
console.log('='.repeat(80))
console.log('📊 DIAGNOSTIC SUMMARY')
console.log('='.repeat(80))
console.log(`
Expected results:
✅ OpenTelemetry spans should be created
✅ Manual extraction should return trace context
✅ Custom extractor should work
✅ Target validation should match *.supabase.co domains
✅ Supabase client with custom extractor should propagate headers

If trace headers are present in the fetch calls, the feature is working! 🎉
`)

await sdk.shutdown()
