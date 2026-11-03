/**
 * CJS module resolution test for the /tracing subpath export.
 *
 * All-CJS flow: both the tracing subpath (dist/tracing.cjs) and the main
 * entry (dist/index.cjs) load via require(), verifying the subpath resolves
 * under the `require` condition and the registration reaches the client.
 */

require('@supabase/supabase-js/tracing')
const { propagation } = require('@opentelemetry/api')
const { createClient } = require('@supabase/supabase-js')

console.log('Testing @supabase/supabase-js/tracing CJS resolution...')

const TRACEPARENT = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'

// Test 1: the side-effect require registered the extractor in the global slot
const extractor = globalThis[Symbol.for('@supabase/supabase-js.traceContextExtractor')]
if (typeof extractor !== 'function') {
  throw new Error('tracing subpath did not register an extractor on globalThis')
}

console.log('✓ Side-effect require registered the trace context extractor')

// Test 2: a client attaches trace headers through the registered runtime.
// A hand-rolled propagator keeps the test on @opentelemetry/api alone.
propagation.setGlobalPropagator({
  inject(_context, carrier, setter) {
    setter.set(carrier, 'traceparent', TRACEPARENT)
  },
  extract(context) {
    return context
  },
  fields() {
    return ['traceparent']
  },
})

async function main() {
  let capturedHeaders = null
  const capturingFetch = async (_input, init) => {
    capturedHeaders = new Headers(init?.headers)
    return new Response('[]', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  const supabase = createClient('https://project.supabase.co', 'test-key', {
    tracePropagation: true,
    global: { fetch: capturingFetch },
  })

  await supabase.from('users').select('*')

  if (!capturedHeaders) {
    throw new Error('custom fetch was not called')
  }

  if (capturedHeaders.get('traceparent') !== TRACEPARENT) {
    throw new Error(
      `traceparent header not attached — got ${JSON.stringify(capturedHeaders.get('traceparent'))}`
    )
  }

  console.log('✓ Client attached trace headers from the registered runtime')

  console.log('\n✅ All CJS module resolution tests passed for @supabase/supabase-js/tracing')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
