import { createClient } from '../../src/index'

describe('multipart storage uploads through createClient', () => {
  test('sends fields before the file and forwards authentication', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ Id: 'object-id', Key: 'bucket/sample.bin' }), {
        headers: { 'content-type': 'application/json' },
      })
    )
    const client = createClient('https://project.supabase.co', 'test-key', {
      accessToken: async () => 'test-token',
      global: { fetch: fetchMock },
    })
    const bytes = Buffer.from('upload payload')
    const form = new FormData()
    form.append('file', new Blob([bytes]), 'sample.bin')
    form.append('contentType', 'text/plain')
    const { error } = await client.storage.from('bucket').upload('sample.bin', form, {
      cacheControl: '7200',
      metadata: { source: 'client' },
    })

    expect(error).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    const request = new Request(url, init)
    expect(request.url).toBe('https://project.supabase.co/storage/v1/object/bucket/sample.bin')
    expect(request.headers.get('authorization')).toBe('Bearer test-token')
    expect(request.headers.get('apikey')).toBe('test-key')
    const wire = await request.clone().text()
    for (const name of ['contentType', 'cacheControl', 'metadata']) {
      const position = wire.indexOf(`name="${name}"`)
      expect(position).toBeGreaterThanOrEqual(0)
      expect(position).toBeLessThan(wire.indexOf('filename='))
    }
    const body = await request.formData()
    expect(body.get('contentType')).toBe('text/plain')
    expect(body.get('cacheControl')).toBe('7200')
    expect(body.get('metadata')).toBe('{"source":"client"}')
    const file = body.get('file') as File
    expect(file.name).toBe('sample.bin')
    expect(Buffer.from(await file.arrayBuffer())).toEqual(bytes)
  })
})
