import { serve } from 'https://deno.land/std/http/server.ts'

serve((req) => {
  // Decode JWT to check if this is a health check
  const authHeader = req.headers.get('authorization')
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '')
      const payload = JSON.parse(atob(token.split('.')[1]))
      // Health check uses { name: 'check' }
      if (payload.name === 'check') {
        return new Response('OK', { status: 200 })
      }
    } catch (e) {
      // If JWT decode fails, continue to upgrade attempt
    }
  }

  // For actual test invocations, attempt WebSocket upgrade
  const p = Deno.upgradeHttp(req)

  // Run this async IIFE concurrently, first packet won't arrive
  // until we return HTTP101 response.
  ;(async () => {
    const [conn, firstPacket] = await p
    const decoder = new TextDecoder()
    const text = decoder.decode(firstPacket)
    console.log(text)
    // Hello
    const uint8Array = new Uint8Array([72, 101, 108, 108, 111])
    conn.write(uint8Array)
    conn.close()
  })()

  // HTTP101 - Switching Protocols
  return new Response(null, { status: 101 })
})
