import { PostgrestClient, PostgrestError } from '../src/index'

const REST_URL = 'http://localhost:3000'

const SPEC = {
  swagger: '2.0',
  info: { title: 'PostgREST API', version: '12.0.0' },
  host: '0.0.0.0:3000',
  basePath: '/',
  paths: { '/todos': { get: {} } },
  definitions: { todos: { properties: { id: { type: 'integer' } } } },
  parameters: {},
}

type Call = { input: Parameters<typeof fetch>[0]; init?: Parameters<typeof fetch>[1] }

/** A fetch stub that records each call and replies with the given response. */
function fetchReplying(response: () => Response | Promise<never>) {
  const calls: Call[] = []
  const fetchImpl: typeof fetch = (input, init) => {
    calls.push({ input, init })
    return Promise.resolve().then(response)
  }
  return { calls, fetchImpl }
}

const jsonResponse = (body: unknown, status = 200, statusText = 'OK') =>
  new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/openapi+json' },
  })

describe('getOpenApiSpec', () => {
  test('requests the REST root with a trailing slash and returns the parsed document', async () => {
    const { calls, fetchImpl } = fetchReplying(() => jsonResponse(SPEC))
    const postgrest = new PostgrestClient(REST_URL, { schema: 'public', fetch: fetchImpl })

    const res = await postgrest.getOpenApiSpec()

    expect(calls).toHaveLength(1)
    expect(String(calls[0].input)).toBe(`${REST_URL}/`)
    expect(calls[0].init?.method).toBe('GET')
    const headers = new Headers(calls[0].init?.headers)
    expect(headers.get('Accept')).toBe('application/openapi+json')
    expect(headers.get('Accept-Profile')).toBe('public')

    expect(res).toEqual({
      success: true,
      error: null,
      data: SPEC,
      count: null,
      status: 200,
      statusText: 'OK',
    })
  })

  test('omits Accept-Profile when the client has no schema', async () => {
    const { calls, fetchImpl } = fetchReplying(() => jsonResponse(SPEC))
    const postgrest = new PostgrestClient(REST_URL, { fetch: fetchImpl })

    await postgrest.getOpenApiSpec()

    const headers = new Headers(calls[0].init?.headers)
    expect(headers.has('Accept-Profile')).toBe(false)
  })

  test('describes the schema selected with .schema()', async () => {
    const { calls, fetchImpl } = fetchReplying(() => jsonResponse(SPEC))
    const postgrest = new PostgrestClient(REST_URL, { schema: 'public', fetch: fetchImpl })

    await postgrest.schema('billing').getOpenApiSpec()

    const headers = new Headers(calls[0].init?.headers)
    expect(headers.get('Accept-Profile')).toBe('billing')
  })

  test('hands headers to fetch as a plain object', async () => {
    const { calls, fetchImpl } = fetchReplying(() => jsonResponse(SPEC))
    const postgrest = new PostgrestClient(REST_URL, { schema: 'public', fetch: fetchImpl })

    await postgrest.getOpenApiSpec()

    const headers = calls[0].init?.headers as Record<string, string>
    expect(headers).not.toBeInstanceOf(Headers)
    expect(headers['accept']).toBe('application/openapi+json')
    expect(headers['accept-profile']).toBe('public')
  })

  test('returns a PostgrestError built from the PostgREST error body', async () => {
    const pgrstError = {
      code: 'PGRST301',
      details: null,
      hint: null,
      message: 'JWT expired',
    }
    const { fetchImpl } = fetchReplying(() => jsonResponse(pgrstError, 401, 'Unauthorized'))
    const postgrest = new PostgrestClient(REST_URL, { fetch: fetchImpl })

    const res = await postgrest.getOpenApiSpec()

    expect(res.success).toBe(false)
    expect(res.data).toBeNull()
    expect(res.status).toBe(401)
    expect(res.statusText).toBe('Unauthorized')
    expect(res.error).toBeInstanceOf(PostgrestError)
    expect(res.error).toMatchObject({
      name: 'PostgrestError',
      message: 'JWT expired',
      code: 'PGRST301',
      details: '',
      hint: '',
    })
  })

  test('falls back to the status text when a failed response has no body', async () => {
    const { fetchImpl } = fetchReplying(
      () => new Response(null, { status: 404, statusText: 'Not Found' })
    )
    const postgrest = new PostgrestClient(REST_URL, { fetch: fetchImpl })

    const res = await postgrest.getOpenApiSpec()

    expect(res.success).toBe(false)
    expect(res.status).toBe(404)
    expect(res.error).toBeInstanceOf(PostgrestError)
    expect(res.error).toMatchObject({ message: 'Not Found', code: '', details: '', hint: '' })
  })

  test('uses a non-JSON failure body as the error message', async () => {
    const { fetchImpl } = fetchReplying(
      () =>
        new Response('OpenAPI output is disabled', { status: 406, statusText: 'Not Acceptable' })
    )
    const postgrest = new PostgrestClient(REST_URL, { fetch: fetchImpl })

    const res = await postgrest.getOpenApiSpec()

    expect(res.success).toBe(false)
    expect(res.status).toBe(406)
    expect(res.error).toMatchObject({ message: 'OpenAPI output is disabled', code: '' })
  })

  test('reports a successful response whose body is not JSON as an error', async () => {
    const { fetchImpl } = fetchReplying(
      () => new Response('<html>not a spec</html>', { status: 200, statusText: 'OK' })
    )
    const postgrest = new PostgrestClient(REST_URL, { fetch: fetchImpl })

    const res = await postgrest.getOpenApiSpec()

    expect(res.success).toBe(false)
    expect(res.data).toBeNull()
    expect(res.status).toBe(200)
    expect(res.error).toBeInstanceOf(PostgrestError)
    expect(res.error).toMatchObject({ message: '<html>not a spec</html>', code: '' })
  })

  test('maps a rejected fetch to status 0 without throwing', async () => {
    const failure = new TypeError('fetch failed')
    const { fetchImpl } = fetchReplying(() => Promise.reject(failure))
    const postgrest = new PostgrestClient(REST_URL, { fetch: fetchImpl })

    const res = await postgrest.getOpenApiSpec()

    expect(res.success).toBe(false)
    expect(res.data).toBeNull()
    expect(res.status).toBe(0)
    expect(res.statusText).toBe('')
    expect(res.error).toBeInstanceOf(PostgrestError)
    expect(res.error).toMatchObject({ message: 'TypeError: fetch failed', code: '' })
  })

  test('reports a body that cannot be read as an error without throwing', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.error(new TypeError('terminated'))
      },
    })
    const { fetchImpl } = fetchReplying(() => new Response(body, { status: 200, statusText: 'OK' }))
    const postgrest = new PostgrestClient(REST_URL, { fetch: fetchImpl })

    const res = await postgrest.getOpenApiSpec()

    expect(res.success).toBe(false)
    expect(res.data).toBeNull()
    expect(res.status).toBe(200)
    expect(res.statusText).toBe('OK')
    expect(res.error).toBeInstanceOf(PostgrestError)
    expect(res.error).toMatchObject({ message: 'TypeError: terminated', code: '' })
  })

  describe('retries', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    /** Minimal response stand-in; the client reads only these members. */
    const replyWith = (
      status: number,
      statusText: string,
      body: string,
      headers: Record<string, string> = {}
    ) =>
      ({
        ok: status >= 200 && status < 300,
        status,
        statusText,
        headers: new Headers(headers),
        text: () => Promise.resolve(body),
      }) as unknown as Response

    /** Advance the fake clock until the request settles. */
    async function settle<T>(pending: Promise<T>): Promise<T> {
      let settled = false
      const tracked = pending.finally(() => {
        settled = true
      })
      while (!settled) {
        await jest.advanceTimersByTimeAsync(1000)
      }
      return tracked
    }

    test('retries a 503 after the Retry-After delay and marks the retry attempt', async () => {
      const replies: Array<() => Response> = [
        () =>
          replyWith(503, 'Service Unavailable', '{"code":"PGRST002","message":"schema cache"}', {
            'Retry-After': '1',
          }),
        () => replyWith(200, 'OK', JSON.stringify(SPEC)),
      ]
      const { calls, fetchImpl } = fetchReplying(() => replies.shift()!())
      const postgrest = new PostgrestClient(REST_URL, { fetch: fetchImpl })

      const res = await settle(postgrest.getOpenApiSpec())

      expect(calls).toHaveLength(2)
      expect((calls[1].init?.headers as Record<string, string>)['X-Retry-Count']).toBe('1')
      expect(res).toMatchObject({ success: true, data: SPEC, status: 200 })
    })

    test('retries a rejected fetch and succeeds on the next attempt', async () => {
      const replies: Array<() => Response | Promise<never>> = [
        () => Promise.reject(new TypeError('fetch failed')),
        () => replyWith(200, 'OK', JSON.stringify(SPEC)),
      ]
      const { calls, fetchImpl } = fetchReplying(() => replies.shift()!())
      const postgrest = new PostgrestClient(REST_URL, { fetch: fetchImpl })

      const res = await settle(postgrest.getOpenApiSpec())

      expect(calls).toHaveLength(2)
      expect(res).toMatchObject({ success: true, data: SPEC })
    })

    test('does not retry when the client disables retries', async () => {
      const { calls, fetchImpl } = fetchReplying(() => replyWith(520, '', 'origin error'))
      const postgrest = new PostgrestClient(REST_URL, { fetch: fetchImpl, retry: false })

      const res = await settle(postgrest.getOpenApiSpec())

      expect(calls).toHaveLength(1)
      expect(res).toMatchObject({ success: false, status: 520 })
      expect(res.error).toMatchObject({ message: 'origin error' })
    })

    test('gives up after the maximum number of retries', async () => {
      const { calls, fetchImpl } = fetchReplying(() => replyWith(520, '', 'origin error'))
      const postgrest = new PostgrestClient(REST_URL, { fetch: fetchImpl })

      const res = await settle(postgrest.getOpenApiSpec())

      expect(calls).toHaveLength(4)
      expect(res).toMatchObject({ success: false, status: 520 })
    })
  })
})
