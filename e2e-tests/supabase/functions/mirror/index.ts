import { serve } from 'https://deno.land/std/http/server.ts'

serve(async (request: Request) => {
  let body
  let contentType = 'application/json'
  switch (request.headers.get('response-type')) {
    case 'json': {
      body = await request.json()
      break
    }
    case 'form': {
      const formBody = await request.formData()
      body = []
      for (const e of formBody.entries()) {
        body.push(e)
      }
      break
    }
    case 'blob': {
      const data = await request.blob()
      body = await data.text()
      contentType = 'application/octet-stream'
      break
    }
    case 'arrayBuffer': {
      const data = await request.arrayBuffer()
      body = new TextDecoder().decode(data || new Uint8Array())
      contentType = 'application/octet-stream'
      break
    }
    default: {
      body = await request.text()
      contentType = 'text/plain'
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

  let responseData
  if (request.headers.get('response-type') === 'blob') {
    responseData = new Blob([JSON.stringify(resp)], { type: 'application/json' })
  } else {
    responseData = JSON.stringify(resp)
  }
  return new Response(responseData, {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
  })
})
