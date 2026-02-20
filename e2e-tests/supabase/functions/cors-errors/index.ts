import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '@supabase/supabase-js/cors'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('[cors-errors] OPTIONS request detected, returning 204')
    const response = new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
    console.log('[cors-errors] Response status:', response.status)
    return response
  }

  try {
    const url = new URL(req.url)
    const errorType = url.searchParams.get('error')

    // Simulate different error scenarios
    switch (errorType) {
      case 'bad-request':
        return new Response(JSON.stringify({ error: 'Bad request', code: 400 }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'unauthorized':
        return new Response(JSON.stringify({ error: 'Unauthorized', code: 401 }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'not-found':
        return new Response(JSON.stringify({ error: 'Not found', code: 404 }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'server-error':
        return new Response(JSON.stringify({ error: 'Internal server error', code: 500 }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      default:
        return new Response(JSON.stringify({ success: true, message: 'No error requested' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
