import 'jest'

import { FunctionsClient } from '../../src/index'

/**
 * Unit tests (no relay) for response body parsing based on the response
 * Content-Type header. HTTP media types are case-insensitive (RFC 9110), so the
 * client must match them regardless of casing.
 */
describe('response Content-Type parsing', () => {
  const makeClient = (contentType: string, body: string) => {
    const customFetch = jest.fn(
      async () =>
        new Response(body, {
          status: 200,
          headers: { 'Content-Type': contentType },
        })
    ) as any
    return new FunctionsClient('http://localhost', { customFetch })
  }

  test('parses JSON when Content-Type is lowercase', async () => {
    const client = makeClient('application/json', JSON.stringify({ foo: 'bar' }))
    const { data, error } = await client.invoke('fn', {})
    expect(error).toBeNull()
    expect(data).toEqual({ foo: 'bar' })
  })

  test('parses JSON when Content-Type has mixed casing', async () => {
    const client = makeClient('Application/JSON; charset=utf-8', JSON.stringify({ foo: 'bar' }))
    const { data, error } = await client.invoke('fn', {})
    expect(error).toBeNull()
    expect(data).toEqual({ foo: 'bar' })
  })

  test('parses JSON when Content-Type is uppercase', async () => {
    const client = makeClient('APPLICATION/JSON', JSON.stringify({ foo: 'bar' }))
    const { data, error } = await client.invoke('fn', {})
    expect(error).toBeNull()
    expect(data).toEqual({ foo: 'bar' })
  })

  // PNG signature followed by bytes that are not valid UTF-8
  const binaryBody = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xfe,
  ])

  test.each([
    'image/png',
    'image/jpeg',
    'image/webp',
    'audio/mpeg',
    'audio/wav',
    'video/mp4',
    'video/webm',
    'font/woff2',
    'application/pdf',
    'application/octet-stream',
    'Image/PNG; name="og.png"',
  ])('returns the exact bytes of a %s response as a Blob', async (contentType) => {
    const customFetch = jest.fn(
      async () =>
        new Response(binaryBody, { status: 200, headers: { 'Content-Type': contentType } })
    ) as any
    const client = new FunctionsClient('http://localhost', { customFetch })
    const { data, error } = await client.invoke('fn', {})
    expect(error).toBeNull()
    expect(data).toBeInstanceOf(Blob)
    expect(new Uint8Array(await data.arrayBuffer())).toEqual(binaryBody)
  })

  test.each([
    ['image/svg+xml; charset=utf-8', '<svg xmlns="http://www.w3.org/2000/svg"/>'],
    ['audio/mpegurl', '#EXTM3U\n#EXTINF:10,Intro\nintro.mp3\n'],
    ['audio/x-mpegurl', '#EXTM3U\nhttps://example.com/stream.aac\n'],
    [
      'image/x-xbitmap',
      '#define dot_width 1\n#define dot_height 1\nstatic char dot_bits[] = { 0x01 };\n',
    ],
    ['image/x-unknown', 'not a known binary format'],
  ])('keeps parsing a %s response as text', async (contentType, body) => {
    const client = makeClient(contentType, body)
    const { data, error } = await client.invoke('fn', {})
    expect(error).toBeNull()
    expect(data).toBe(body)
  })
})
