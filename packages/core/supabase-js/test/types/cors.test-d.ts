/**
 * Type tests for CORS exports
 *
 * This file uses tsd to verify TypeScript types are correctly exported
 * and work as expected in various usage scenarios.
 */

import { expectType, expectAssignable, expectNotAssignable } from 'tsd'
import { corsHeaders, createCorsHeaders, type CorsHeaders, type CorsOptions } from '../../src/cors'

// Test: corsHeaders has correct type
expectType<CorsHeaders>(corsHeaders)
expectType<Record<string, string>>(corsHeaders)

// Test: corsHeaders has required properties
expectType<string>(corsHeaders['Access-Control-Allow-Origin'])
expectType<string>(corsHeaders['Access-Control-Allow-Headers'])
expectType<string>(corsHeaders['Access-Control-Allow-Methods'])

// Test: CorsHeaders type accepts valid header objects
expectAssignable<CorsHeaders>({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization',
  'Access-Control-Allow-Methods': 'GET, POST',
})

// Test: CorsHeaders requires string values
expectNotAssignable<CorsHeaders>({
  'Access-Control-Allow-Origin': 123,
})

// Test: createCorsHeaders function signature
expectType<(options?: CorsOptions) => CorsHeaders>(createCorsHeaders)

// Test: createCorsHeaders with no arguments
expectType<CorsHeaders>(createCorsHeaders())

// Test: createCorsHeaders with empty object
expectType<CorsHeaders>(createCorsHeaders({}))

// Test: createCorsHeaders with single origin
expectType<CorsHeaders>(createCorsHeaders({ origin: 'https://myapp.com' }))

// Test: createCorsHeaders with credentials
expectType<CorsHeaders>(createCorsHeaders({ credentials: true }))

// Test: createCorsHeaders with additional headers
expectType<CorsHeaders>(createCorsHeaders({ additionalHeaders: ['x-custom'] }))

// Test: createCorsHeaders with additional methods
expectType<CorsHeaders>(createCorsHeaders({ additionalMethods: ['HEAD'] }))

// Test: createCorsHeaders with all options
expectType<CorsHeaders>(
  createCorsHeaders({
    origin: 'https://myapp.com',
    credentials: true,
    additionalHeaders: ['x-custom'],
    additionalMethods: ['HEAD'],
  })
)

// Test: CorsOptions type structure
expectAssignable<CorsOptions>({})
expectAssignable<CorsOptions>({ origin: '*' })
expectAssignable<CorsOptions>({ origin: 'https://myapp.com' })
expectAssignable<CorsOptions>({ credentials: false })
expectAssignable<CorsOptions>({ additionalHeaders: [] })
expectAssignable<CorsOptions>({ additionalMethods: [] })

// Test: CorsOptions validates property types
expectNotAssignable<CorsOptions>({ origin: 123 })
expectNotAssignable<CorsOptions>({ origin: ['https://app1.com'] })
expectNotAssignable<CorsOptions>({ credentials: 'true' })
expectNotAssignable<CorsOptions>({ additionalHeaders: 'x-custom' })
expectNotAssignable<CorsOptions>({ additionalMethods: 'GET' })

// Test: Common usage patterns compile successfully

// Pattern 1: Basic Edge Function CORS
const basicResponse = new Response('ok', { headers: corsHeaders })
expectType<Response>(basicResponse)

// Pattern 2: Custom origin with credentials
const customHeaders = createCorsHeaders({
  origin: 'https://myapp.com',
  credentials: true,
})
const customResponse = new Response('ok', { headers: customHeaders })
expectType<Response>(customResponse)

// Pattern 3: Merged headers
const mergedHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
}
expectAssignable<Record<string, string>>(mergedHeaders)
expectType<string>(mergedHeaders['Content-Type'])

// Pattern 4: Edge Function with OPTIONS handler
function handleRequest(req: Request): Response {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return new Response(JSON.stringify({ data: 'Hello' }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
expectType<(req: Request) => Response>(handleRequest)

// Pattern 5: Custom CORS configuration with additional headers and methods
const advancedHeaders = createCorsHeaders({
  origin: 'https://app1.com',
  credentials: true,
  additionalHeaders: ['x-custom-header', 'x-api-key'],
  additionalMethods: ['HEAD', 'TRACE'],
})
expectType<CorsHeaders>(advancedHeaders)

// Pattern 6: Type-safe header access
const origin: string = corsHeaders['Access-Control-Allow-Origin']
const methods: string = corsHeaders['Access-Control-Allow-Methods']
expectType<string>(origin)
expectType<string>(methods)
