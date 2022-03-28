import { serve } from 'https://deno.land/std/http/server.ts'

serve(async (request: Request) => {
  let body
  switch (request.headers.get('content-type')) {
    case 'application/json': {
      body = await request.json()
      break
    }
    case 'application/x-www-form-urlencoded': {
      const formBody = await request.formData()
      body = []
      for (const e of formBody.entries()) {
        body.push(e)
      }
      break
    }
    default: {
      body = await request.text()
      break
    }
  }
  const headers = []
  for (const h of request.headers.entries()) {
    headers.push(h)
  }
  const resp = {
    url: request.url ?? 'empty',
    method: request.method ?? 'empty',
    headers: headers ?? 'empty',
    body: body ?? 'empty',
  }

  return new Response(JSON.stringify(resp), {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
  })
})
