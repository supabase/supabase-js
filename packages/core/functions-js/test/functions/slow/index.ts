import { serve } from 'https://deno.land/std/http/server.ts'

serve(async () => {
  // Sleep for 3 seconds
  await new Promise((resolve) => setTimeout(resolve, 3000))
  return new Response('Slow Response')
})
