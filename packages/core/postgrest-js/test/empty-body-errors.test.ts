import { PostgrestClient } from '../src/index'
import PostgrestError from '../src/PostgrestError'
import { Database } from './types.override'

const mockFailure = (
  status: number,
  statusText: string,
  body: string,
  headers: Record<string, string> = {}
) =>
  jest.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
    headers: new Headers(headers),
    text: async () => body,
  })

const clientWith = (fetch: jest.Mock) =>
  new PostgrestClient<Database>('https://example.com', { fetch: fetch as any })

const headCount = (postgrest: PostgrestClient<Database>) =>
  postgrest.from('users').select('id', { count: 'exact', head: true })

// HTTP forbids a body on a HEAD response, so every failed HEAD request lands in
// the non-JSON fallback with nothing but the status and the response headers.
describe('Failed HEAD requests', () => {
  test('describes a bodiless gateway failure by its status', async () => {
    const res = await headCount(clientWith(mockFailure(504, 'Gateway Timeout', '')))

    expect(res).toEqual({
      success: false,
      status: 504,
      statusText: 'Gateway Timeout',
      data: null,
      count: null,
      error: { message: 'HTTP 504' },
    })
  })

  test('takes the error code from Proxy-Status when PostgREST sets one', async () => {
    const res = await headCount(
      clientWith(
        mockFailure(400, 'Bad Request', '', { 'Proxy-Status': 'PostgREST; error=PGRST100' })
      )
    )

    expect(res.success).toBe(false)
    expect(res.status).toBe(400)
    expect(res.error).toEqual({ message: 'HTTP 400', code: 'PGRST100' })
  })

  // https://github.com/supabase/supabase-js/issues/1661
  test('surfaces the statement timeout code on a bodiless 500', async () => {
    const res = await headCount(
      clientWith(
        mockFailure(500, 'Internal Server Error', '', {
          'Proxy-Status': 'PostgREST; error=57014',
        })
      )
    )

    expect(res.error).toEqual({ message: 'HTTP 500', code: '57014' })
  })

  test('reports a bodiless 404 as a failure rather than 204 No Content', async () => {
    const res = await headCount(
      clientWith(mockFailure(404, 'Not Found', '', { 'Proxy-Status': 'PostgREST; error=PGRST205' }))
    )

    expect(res.success).toBe(false)
    expect(res.status).toBe(404)
    expect(res.statusText).toBe('Not Found')
    expect(res.error).toEqual({ message: 'HTTP 404', code: 'PGRST205' })
  })

  test('ignores an error code set by a proxy other than PostgREST', async () => {
    const res = await headCount(
      clientWith(
        mockFailure(504, 'Gateway Timeout', '', { 'Proxy-Status': 'cdn; error=http_protocol' })
      )
    )

    expect(res.error).toEqual({ message: 'HTTP 504' })
  })

  test('reads the PostgREST entry when another proxy prepends its own', async () => {
    const res = await headCount(
      clientWith(
        mockFailure(500, 'Internal Server Error', '', {
          'Proxy-Status': 'cdn; error=http_protocol, PostgREST; error=XX000',
        })
      )
    )

    expect(res.error).toEqual({ message: 'HTTP 500', code: 'XX000' })
  })

  test('rejects with a PostgrestError carrying the code when throwOnError is set', async () => {
    const postgrest = clientWith(
      mockFailure(400, 'Bad Request', '', { 'Proxy-Status': 'PostgREST; error=PGRST100' })
    )

    await expect(headCount(postgrest).throwOnError()).rejects.toBeInstanceOf(PostgrestError)
    await expect(headCount(postgrest).throwOnError()).rejects.toMatchObject({
      message: 'HTTP 400',
      code: 'PGRST100',
    })
  })
})

describe('Failed responses with an unparseable body', () => {
  test('keeps the body as the message when the response has one', async () => {
    const htmlBody = '<html><body>504 Gateway Timeout</body></html>'
    const postgrest = clientWith(mockFailure(504, 'Gateway Timeout', htmlBody))

    const res = await postgrest.from('users').select('id')

    expect(res.error).toEqual({ message: htmlBody })
  })
})

// An update matching no rows used to answer 404 with an empty body, which the
// client reports as 204 No Content. PostgREST has since changed that response,
// but the conversion stays for callers on older versions. It is gated on the
// request being able to carry a body at all, which a HEAD request cannot.
// https://github.com/supabase/postgrest-js/issues/295
describe('Empty-bodied 404 on a method that can carry a body', () => {
  test('still reports 204 No Content', async () => {
    const postgrest = clientWith(mockFailure(404, 'Not Found', ''))

    const res = await postgrest.from('messages').update({ channel_id: 2 }).eq('id', 999)

    expect(res.error).toBeNull()
    expect(res.success).toBe(true)
    expect(res.status).toBe(204)
    expect(res.statusText).toBe('No Content')
  })
})
