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
})
