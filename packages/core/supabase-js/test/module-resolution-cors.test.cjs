/**
 * CommonJS module resolution test for CORS exports
 *
 * This test verifies that the /cors subpath export works correctly in CJS mode.
 * It tests that all expected exports are available and functional.
 */

const { corsHeaders } = require('@supabase/supabase-js/cors')

console.log('Testing @supabase/supabase-js/cors CommonJS exports...')

// Test 1: corsHeaders is exported and has correct structure
if (!corsHeaders) {
  throw new Error('corsHeaders is not exported')
}

if (typeof corsHeaders !== 'object') {
  throw new Error('corsHeaders is not an object')
}

if (!corsHeaders['Access-Control-Allow-Origin']) {
  throw new Error('corsHeaders missing Access-Control-Allow-Origin')
}

if (!corsHeaders['Access-Control-Allow-Headers']) {
  throw new Error('corsHeaders missing Access-Control-Allow-Headers')
}

if (!corsHeaders['Access-Control-Allow-Methods']) {
  throw new Error('corsHeaders missing Access-Control-Allow-Methods')
}

console.log('✓ corsHeaders export is valid')

// Test 2: Verify all critical Supabase headers are present
const requiredHeaders = ['authorization', 'x-client-info', 'apikey', 'content-type']

const allowedHeaders = corsHeaders['Access-Control-Allow-Headers']
const allowedHeaderList = allowedHeaders.split(',').map((h) => h.trim())
for (const header of requiredHeaders) {
  if (!allowedHeaderList.includes(header)) {
    throw new Error(`corsHeaders missing required header: ${header}`)
  }
}

console.log('✓ All required Supabase headers are present')

// Test 3: Verify CORS headers work with Response API (if available in Node.js)
if (typeof Response !== 'undefined') {
  const response = new Response('ok', { headers: corsHeaders })

  if (response.headers.get('Access-Control-Allow-Origin') !== '*') {
    throw new Error('CORS headers do not work with Response API')
  }

  console.log('✓ CORS headers work with Response API')

  // Test 4: Verify merged headers work with Response API
  const mergedResponse = new Response(JSON.stringify({ data: 'test' }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })

  if (!mergedResponse.headers.get('Access-Control-Allow-Origin')) {
    throw new Error('Merged CORS headers do not work with Response API')
  }

  if (mergedResponse.headers.get('Content-Type') !== 'application/json') {
    throw new Error('Custom headers are lost when merging with CORS headers')
  }

  console.log('✓ Merged CORS headers work with Response API')
} else {
  console.log('⊘ Response API not available in this Node.js version (skipped Response tests)')
}

console.log('\n✅ All CommonJS module resolution tests passed for @supabase/supabase-js/cors')
