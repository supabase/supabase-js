import { serve } from 'https://deno.land/std@0.130.0/http/server.ts'

serve((req) => {
  const p = Deno.upgradeHttp(req);
  
  (
    // Run this async IIFE concurrently, first packet won't arrive
    // until we return HTTP101 response.
    async () => {
      const [conn, firstPacket] = await p
      const decoder = new TextDecoder()
      const text = decoder.decode(firstPacket)
      console.log(text)
      // Hello
      const uint8Array = new Uint8Array([72, 101, 108, 108, 111])
      conn.write(uint8Array)
      conn.close()
    }
  )()

  // HTTP101 - Switching Protocols
  return new Response(null, { status: 101 })
})
