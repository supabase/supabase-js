import 'jest'
import { FunctionsClient } from '../../src/index'

// Unit test (custom fetch capture) — `FunctionInvokeOptions.body` documents `ReadableStream<Uint8Array>`
// as a supported type, but a ReadableStream matched none of the body-inference branches and fell through
// to `JSON.stringify(functionArgs)`, which produces `"{}"` — silently dropping the stream payload.
describe('FunctionsClient ReadableStream body', () => {
  const makeClient = () => {
    let captured: any = {}
    const customFetch = (async (_url: string, opts: any) => {
      captured = opts
      return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }) as any
    const client = new FunctionsClient('http://localhost', { customFetch })
    return { client, captured: () => captured }
  }

  const makeStream = () =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('streamed-bytes'))
        controller.close()
      },
    })

  test('forwards a ReadableStream body to fetch untouched (no caller Content-Type)', async () => {
    const { client, captured } = makeClient()
    const stream = makeStream()
    await client.invoke('fn', { body: stream })
    expect(captured().body).toBe(stream)
    const contentType = new Headers(captured().headers).get('content-type')
    expect(contentType).not.toBe('application/json')
    // a streaming body needs the half-duplex flag, otherwise native fetch throws
    expect(captured().duplex).toBe('half')
  })

  test('forwards a ReadableStream body when the caller sets a Content-Type', async () => {
    const { client, captured } = makeClient()
    const stream = makeStream()
    await client.invoke('fn', {
      body: stream,
      headers: { 'Content-Type': 'application/octet-stream' },
    })
    expect(captured().body).toBe(stream)
  })
})
