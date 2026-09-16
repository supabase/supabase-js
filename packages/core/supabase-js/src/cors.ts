/**
 * Canonical CORS configuration for Supabase Edge Functions
 *
 * This module exports CORS headers kept in sync with the headers the Supabase
 * SDK sends. Using it in Edge Functions prevents CORS preflight errors when the
 * SDK adds new headers — update SUPABASE_HEADERS whenever the SDK starts
 * sending one (enforced by the unit tests).
 *
 * @example Basic usage
 * ```typescript
 * import { corsHeaders } from '@supabase/supabase-js/cors'
 *
 * Deno.serve(async (req) => {
 *   if (req.method === 'OPTIONS') {
 *     return new Response('ok', { headers: corsHeaders })
 *   }
 *
 *   return new Response(
 *     JSON.stringify({ data: 'Hello' }),
 *     { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
 *   )
 * })
 * ```
 *
 * @module cors
 */

/**
 * All custom headers sent by the Supabase SDK.
 * These headers need to be included in CORS configuration to prevent preflight failures.
 *
 * Headers:
 * - authorization: Bearer token for authentication
 * - x-client-info: Library version information
 * - apikey: Project API key
 * - content-type: Standard HTTP content type
 * - x-retry-count: Retry attempt number sent by postgrest-js on retried requests
 * - traceparent: W3C trace context sent when `tracePropagation` is enabled
 * - tracestate: Vendor-specific trace data sent alongside traceparent
 * - baggage: W3C baggage sent alongside traceparent
 */
const SUPABASE_HEADERS = [
  'authorization',
  'x-client-info',
  'apikey',
  'content-type',
  'x-retry-count',
  'traceparent',
  'tracestate',
  'baggage',
].join(', ')

/**
 * All HTTP methods used by the Supabase SDK
 */
const SUPABASE_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].join(', ')

/**
 * Type representing CORS headers as a record of header names to values
 */
export type CorsHeaders = Record<string, string>

/**
 * Default CORS headers for Supabase Edge Functions.
 *
 * Includes all headers sent by Supabase client libraries and allows all standard HTTP methods.
 * Use this for simple CORS configurations with wildcard origin.
 *
 * @example Basic usage
 * ```typescript
 * import { corsHeaders } from '@supabase/supabase-js/cors'
 *
 * Deno.serve(async (req) => {
 *   if (req.method === 'OPTIONS') {
 *     return new Response('ok', { headers: corsHeaders })
 *   }
 *
 *   return new Response(
 *     JSON.stringify({ data: 'Hello' }),
 *     { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
 *   )
 * })
 * ```
 *
 * @category Edge Functions
 */
export const corsHeaders: CorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': SUPABASE_HEADERS,
  'Access-Control-Allow-Methods': SUPABASE_METHODS,
}
