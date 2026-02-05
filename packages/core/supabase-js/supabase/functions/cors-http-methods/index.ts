import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '@supabase/supabase-js/cors'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('[cors-http-methods] OPTIONS request detected, returning 204')
    console.log('[cors-http-methods] corsHeaders:', Object.keys(corsHeaders))
    const response = new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
    console.log('[cors-http-methods] Response status:', response.status)
    return response
  }

  // Handle HEAD properly
  if (req.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }

  const timestamp = new Date().toISOString()

  // Classify method type
  const isSimpleMethod = ['GET', 'POST', 'HEAD'].includes(req.method)
  const methodType = isSimpleMethod
    ? 'simple - may not trigger preflight'
    : 'non-simple - REQUIRES preflight with Access-Control-Allow-Methods'

  // Handle all HTTP methods
  const responseData = {
    success: true,
    method: req.method,
    methodType,
    timestamp,
    corsNote: isSimpleMethod
      ? 'Simple methods work with basic CORS'
      : 'Non-simple methods require Access-Control-Allow-Methods header',
    corsHeaders: Object.keys(corsHeaders),
  }

  // Parse body for methods that accept it
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    try {
      const body = await req.json()
      responseData.receivedBody = body
    } catch {
      // Body is optional
    }
  }

  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
})
