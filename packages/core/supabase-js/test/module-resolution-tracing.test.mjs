/**
 * ESM module resolution test for the /tracing subpath export.
 *
 * Deliberately mixes module formats: the tracing subpath loads as ESM
 * (dist/tracing.mjs) while the main entry loads via require()
 * (dist/index.cjs). The two are separate module instances, so this proves
 * the extractor registration crosses build formats through the
 * globalThis-keyed registry — the exact setup a bundled app can end up with
 * when export conditions resolve differently per import site.
 */

import '@supabase/supabase-js/tracing'
import { propagation } from '@opentelemetry/api'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

console.log('Testing @supabase/supabase-js/tracing ESM resolution (mixed with CJS main entry)...')

const TRACEPARENT = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'

// Test 1: the side-effect import registered the extractor in the global slot
const extractor = globalThis[Symbol.for('@supabase/supabase-js.traceContextExtractor')]
if (typeof extractor !== 'function') {
  throw new Error('tracing subpath did not register an extractor on globalThis')
}

console.log('✓ Side-effect import registered the trace context extractor')

// Test 2: a client from the CJS main entry attaches trace headers extracted
// through the ESM-registered runtime. A hand-rolled propagator keeps the
// test on @opentelemetry/api alone (no SDK packages needed).
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

const { createClient } = require('@supabase/supabase-js')

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
    `traceparent header not attached by the CJS main entry — got ${JSON.stringify(
      capturedHeaders.get('traceparent')
    )}. The ESM-registered extractor is not visible across build formats.`
  )
}

console.log('✓ CJS main entry attached trace headers registered by the ESM subpath')

console.log('\n✅ All ESM module resolution tests passed for @supabase/supabase-js/tracing')
