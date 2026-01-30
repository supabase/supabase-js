/**
 * Canonical CORS configuration for Supabase Edge Functions
 *
 * This module exports CORS headers that stay synchronized with the Supabase SDK.
 * When new headers are added to the SDK, they are automatically included here,
 * preventing CORS errors in Edge Functions.
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
 * @example Custom origin
 * ```typescript
 * import { createCorsHeaders } from '@supabase/supabase-js/cors'
 *
 * const corsHeaders = createCorsHeaders({
 *   origin: 'https://myapp.com',
 *   credentials: true
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
 * - x-supabase-api-version: API versioning header
 * - accept-profile: Schema selection for GET/HEAD requests (PostgREST)
 * - content-profile: Schema selection for POST/PATCH/DELETE requests (PostgREST)
 * - prefer: Query options like count, return mode (PostgREST)
 * - accept: Content negotiation (PostgREST)
 * - x-region: Regional routing (Functions)
 */
const SUPABASE_HEADERS = [
  'authorization',
  'x-client-info',
  'apikey',
  'content-type',
  'x-supabase-api-version',
  'accept-profile',
  'content-profile',
  'prefer',
  'accept',
  'x-region',
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
 * Options for creating custom CORS headers
 */
export interface CorsOptions {
  /**
   * Allowed origin. Must be:
   * - '*' for any origin (default)
   * - A single specific origin like 'https://myapp.com'
   *
   * Note: Cannot use credentials: true with origin: '*'
   *
   * For multiple origins, validate the request origin against your
   * allowlist and pass the specific origin to this function:
   *
   * @example
   * ```typescript
   * const allowedOrigins = ['https://app1.com', 'https://app2.com']
   * const requestOrigin = req.headers.get('Origin')
   *
   * if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
   *   return new Response('Forbidden', { status: 403 })
   * }
   *
   * const corsHeaders = createCorsHeaders({ origin: requestOrigin })
   * ```
   */
  origin?: string

  /**
   * Whether to allow credentials (cookies, authorization headers)
   * Default: false
   *
   * Note: Cannot be true when origin is '*'
   */
  credentials?: boolean

  /**
   * Additional headers to allow beyond the Supabase defaults
   */
  additionalHeaders?: string[]

  /**
   * Additional HTTP methods to allow beyond the Supabase defaults
   */
  additionalMethods?: string[]
}

/**
 * Default CORS headers for Supabase Edge Functions.
 *
 * Includes all headers sent by Supabase client libraries and allows all standard HTTP methods.
 * Use this for simple CORS configurations with wildcard origin.
 *
 * @example
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
 */
export const corsHeaders: CorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': SUPABASE_HEADERS,
  'Access-Control-Allow-Methods': SUPABASE_METHODS,
}

/**
 * Creates custom CORS headers with the specified options.
 *
 * Use this when you need to customize the CORS configuration beyond the defaults,
 * such as specifying allowed origins, enabling credentials, or adding custom headers.
 *
 * @param options - Configuration options for CORS headers
 * @returns CORS headers object
 * @throws Error if credentials is true with wildcard origin
 *
 * @example Allow specific origin with credentials
 * ```typescript
 * const corsHeaders = createCorsHeaders({
 *   origin: 'https://myapp.com',
 *   credentials: true
 * })
 * ```
 *
 * @example Add custom headers
 * ```typescript
 * const corsHeaders = createCorsHeaders({
 *   additionalHeaders: ['x-custom-header', 'x-another-header']
 * })
 * ```
 */
export function createCorsHeaders(options: CorsOptions = {}): CorsHeaders {
  const {
    origin = '*',
    credentials = false,
    additionalHeaders = [],
    additionalMethods = [],
  } = options

  // Validate credentials + wildcard combination
  if (credentials && origin === '*') {
    throw new Error(
      'Cannot use credentials: true with origin: "*". ' +
        'Specify an explicit origin when using credentials.'
    )
  }

  // Build allowed headers list
  const allHeaders =
    SUPABASE_HEADERS + (additionalHeaders.length > 0 ? ', ' + additionalHeaders.join(', ') : '')

  // Build allowed methods list
  const allMethods =
    SUPABASE_METHODS + (additionalMethods.length > 0 ? ', ' + additionalMethods.join(', ') : '')

  const headers: CorsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': allHeaders,
    'Access-Control-Allow-Methods': allMethods,
  }

  if (credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true'
  }

  return headers
}
