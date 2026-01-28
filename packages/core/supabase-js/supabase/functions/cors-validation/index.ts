import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../../../src/cors.ts'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 204,
      headers: corsHeaders,
    })
  }

  // Handle POST request
  if (req.method === 'POST') {
    try {
      const body = await req.json()

      // Extract all headers from the request
      const requestHeaders: Record<string, string> = {}
      req.headers.forEach((value, key) => {
        requestHeaders[key] = value
      })

      // Return headers that were received
      const data = {
        receivedHeaders: requestHeaders,
        corsEnabled: true,
        message: 'CORS validation successful',
        body: body,
        timestamp: new Date().toISOString(),
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }
  }

  // Method not allowed
  return new Response('Method not allowed', {
    status: 405,
    headers: corsHeaders,
  })
})
