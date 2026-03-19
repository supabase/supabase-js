#!/usr/bin/env node
import { trace, context, propagation, SpanStatusCode } from '@opentelemetry/api'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { Resource } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node'
import { createClient } from '@supabase/supabase-js'

// Custom console exporter that shows trace headers
class DetailedConsoleExporter extends ConsoleSpanExporter {
  export(spans: any[], resultCallback: (result: any) => void): void {
    console.log('\n' + '='.repeat(80))
    console.log('📊 TRACE SPANS EXPORTED')
    console.log('='.repeat(80))

    spans.forEach((span, index) => {
      console.log(`\n[Span ${index + 1}] ${span.name}`)
      console.log(`  Trace ID: ${span.spanContext().traceId}`)
      console.log(`  Span ID: ${span.spanContext().spanId}`)
      console.log(`  Parent ID: ${span.parentSpanId || 'none'}`)
      console.log(
        `  Duration: ${(span.duration[0] * 1000 + span.duration[1] / 1000000).toFixed(2)}ms`
      )

      if (span.attributes) {
        console.log(`  Attributes:`)
        Object.entries(span.attributes).forEach(([key, value]) => {
          console.log(`    ${key}: ${value}`)
        })
      }
    })

    console.log('\n' + '='.repeat(80) + '\n')
    super.export(spans, resultCallback)
  }
}

// Initialize OpenTelemetry SDK
console.log('🚀 Initializing OpenTelemetry SDK...\n')

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'tracing-test',
  }),
  traceExporter: new DetailedConsoleExporter(),
})

sdk.start()

// Create a custom fetch that logs the headers
const originalFetch = global.fetch
const fetchWithLogging = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

  console.log(`\n📤 Outgoing HTTP Request:`)
  console.log(`   URL: ${url}`)
  console.log(`   Headers:`)

  if (init?.headers) {
    const headers = new Headers(init.headers)
    headers.forEach((value, key) => {
      // Highlight trace headers
      if (['traceparent', 'tracestate', 'baggage'].includes(key.toLowerCase())) {
        console.log(`   ✅ ${key}: ${value}`)
      } else if (['authorization', 'apikey'].includes(key.toLowerCase())) {
        console.log(`   🔑 ${key}: [REDACTED]`)
      } else {
        console.log(`   📋 ${key}: ${value}`)
      }
    })
  }

  return originalFetch(input, init)
}

// Main test function
async function testTracePropagatation() {
  console.log('\n' + '='.repeat(80))
  console.log('🧪 TESTING TRACE PROPAGATION WITH SUPABASE JS SDK')
  console.log('='.repeat(80) + '\n')

  // Get Supabase credentials from environment or use placeholders
  const supabaseUrl = process.env.SUPABASE_URL || 'https://example.supabase.co'
  const supabaseKey = process.env.SUPABASE_KEY || 'example-anon-key'

  console.log(`📍 Supabase URL: ${supabaseUrl}`)
  console.log(`🔑 Supabase Key: ${supabaseKey.substring(0, 20)}...`)

  // Test 1: Auto mode (default)
  console.log('\n' + '-'.repeat(80))
  console.log('Test 1: Auto Mode (Default)')
  console.log('-'.repeat(80))

  const supabaseAuto = createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: fetchWithLogging,
    },
    // tracePropagation defaults to { mode: 'auto' }
  })

  const tracer = trace.getTracer('test-tracer')

  await tracer.startActiveSpan('test-auto-mode', async (span) => {
    console.log(`\n🎯 Active Span Created:`)
    console.log(`   Trace ID: ${span.spanContext().traceId}`)
    console.log(`   Span ID: ${span.spanContext().spanId}`)
    console.log(`   Sampled: ${span.spanContext().traceFlags === 1}`)

    // Extract current trace context
    const carrier: Record<string, string> = {}
    propagation.inject(context.active(), carrier)
    console.log(`\n📋 Current Trace Context:`)
    console.log(`   traceparent: ${carrier.traceparent || 'none'}`)
    console.log(`   tracestate: ${carrier.tracestate || 'none'}`)

    try {
      // This should automatically include trace headers
      console.log(`\n⏳ Making request to Supabase...`)
      const { error } = await supabaseAuto.from('test_table').select('*').limit(1)

      if (error && error.message.includes('JWT')) {
        console.log(`\n⚠️  Authentication error (expected with placeholder credentials)`)
      } else if (error) {
        console.log(`\n⚠️  Request error: ${error.message}`)
      } else {
        console.log(`\n✅ Request successful`)
      }
    } catch (err: any) {
      console.log(`\n⚠️  Network error (expected if using placeholder URL): ${err.message}`)
    } finally {
      span.end()
    }
  })

  // Test 2: Off mode
  console.log('\n' + '-'.repeat(80))
  console.log('Test 2: Off Mode')
  console.log('-'.repeat(80))

  const supabaseOff = createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: fetchWithLogging,
    },
    tracePropagation: {
      mode: 'off',
    },
  })

  await tracer.startActiveSpan('test-off-mode', async (span) => {
    console.log(`\n🎯 Active Span Created (mode='off'):`)
    console.log(`   Trace ID: ${span.spanContext().traceId}`)

    try {
      console.log(`\n⏳ Making request to Supabase (trace headers should NOT be present)...`)
      const { error } = await supabaseOff.from('test_table').select('*').limit(1)

      if (error && error.message.includes('JWT')) {
        console.log(`\n⚠️  Authentication error (expected with placeholder credentials)`)
      }
    } catch (err: any) {
      console.log(`\n⚠️  Network error: ${err.message}`)
    } finally {
      span.end()
    }
  })

  // Test 3: Custom extractor
  console.log('\n' + '-'.repeat(80))
  console.log('Test 3: Custom Extractor')
  console.log('-'.repeat(80))

  const customTraceContext = {
    traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
    tracestate: 'custom-vendor=test-value',
  }

  const supabaseCustom = createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: fetchWithLogging,
    },
    tracePropagation: {
      mode: 'auto',
      customExtractor: () => {
        console.log(`\n🔧 Custom extractor called`)
        return customTraceContext
      },
    },
  })

  console.log(`\n📋 Custom Trace Context:`)
  console.log(`   traceparent: ${customTraceContext.traceparent}`)
  console.log(`   tracestate: ${customTraceContext.tracestate}`)

  try {
    console.log(`\n⏳ Making request with custom trace context...`)
    const { error } = await supabaseCustom.from('test_table').select('*').limit(1)

    if (error && error.message.includes('JWT')) {
      console.log(`\n⚠️  Authentication error (expected with placeholder credentials)`)
    }
  } catch (err: any) {
    console.log(`\n⚠️  Network error: ${err.message}`)
  }

  // Summary
  console.log('\n' + '='.repeat(80))
  console.log('📊 TEST SUMMARY')
  console.log('='.repeat(80))
  console.log(`
✅ Test 1 (Auto Mode): Trace headers should be present in request
❌ Test 2 (Off Mode): Trace headers should NOT be present in request
🔧 Test 3 (Custom): Custom trace context should be present in request

To verify:
1. Check the "Outgoing HTTP Request" logs above
2. Look for ✅ markers next to traceparent/tracestate headers
3. In Test 1, traceparent should match the active span's trace/span IDs
4. In Test 2, no trace headers should be present
5. In Test 3, custom traceparent should be present
`)

  // Flush and shutdown
  console.log('🔄 Flushing traces and shutting down SDK...\n')
  await sdk.shutdown()
  console.log('✅ Test completed!\n')
}

// Run the test
testTracePropagatation().catch((err) => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
