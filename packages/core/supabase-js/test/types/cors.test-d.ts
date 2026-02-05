/**
 * Type tests for CORS exports
 *
 * This file uses tsd to verify TypeScript types are correctly exported
 * and work as expected in various usage scenarios.
 */

import { expectType, expectAssignable, expectNotAssignable } from 'tsd'
import { corsHeaders, type CorsHeaders } from '../../src/cors'

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

// Test: Common usage patterns compile successfully

// Pattern 1: Basic Edge Function CORS
const basicResponse = new Response('ok', { headers: corsHeaders })
expectType<Response>(basicResponse)

// Pattern 2: Merged headers
const mergedHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
}
expectAssignable<Record<string, string>>(mergedHeaders)
expectType<string>(mergedHeaders['Content-Type'])

// Pattern 3: Edge Function with OPTIONS handler
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

// Pattern 4: Type-safe header access
const origin: string = corsHeaders['Access-Control-Allow-Origin']
const methods: string = corsHeaders['Access-Control-Allow-Methods']
expectType<string>(origin)
expectType<string>(methods)
