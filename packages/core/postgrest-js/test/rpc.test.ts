import { PostgrestClient } from '../src/index'
import { Database } from './types.override'
import { expectType, TypeEqual } from './types'
import { z } from 'zod'

const REST_URL = 'http://localhost:54321/rest/v1'
export const postgrest = new PostgrestClient<Database>(REST_URL)

export const RPC_NAME = 'get_username_and_status'
const BIGINT_PARAM = 9223372036854775807n

test('RPC call serializes bigint values in the request body', async () => {
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    json: async () => null,
    text: async () => '',
  })

  const client = new PostgrestClient<Database>('https://example.com', {
    fetch: mockFetch as any,
  })

  await client.rpc(
    'my_func' as any,
    {
      bigint_param: BIGINT_PARAM,
      payload: { id: BIGINT_PARAM },
    } as any
  )

  const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
  expect(options.method).toBe('POST')
  expect(options.body).toBe(
    JSON.stringify({
      bigint_param: BIGINT_PARAM.toString(),
      payload: { id: BIGINT_PARAM.toString() },
    })
  )
})

test('RPC call with no params', async () => {
  const res = await postgrest.rpc(RPC_NAME, { name_param: 'supabot' }).select()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "status": "ONLINE",
          "username": "supabot",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
      "success": true,
    }
  `)
  // check our result types match the runtime result
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.array(
    z.object({
      status: z.enum(['ONLINE', 'OFFLINE'] as const),
      username: z.string(),
    })
  )
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('RPC call with star select', async () => {
  const res = await postgrest.rpc(RPC_NAME, { name_param: 'supabot' }).select('*')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "status": "ONLINE",
          "username": "supabot",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
      "success": true,
    }
  `)
  // check our result types match the runtime result
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.array(
    z.object({
      status: z.enum(['ONLINE', 'OFFLINE'] as const),
      username: z.string(),
    })
  )
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('RPC call with single field select', async () => {
  const res = await postgrest.rpc(RPC_NAME, { name_param: 'supabot' }).select('username')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "username": "supabot",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
      "success": true,
    }
  `)
  // check our result types match the runtime result
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.array(
    z.object({
      username: z.string(),
    })
  )
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('RPC call with multiple fields select', async () => {
  const res = await postgrest.rpc(RPC_NAME, { name_param: 'supabot' }).select('username, status')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "status": "ONLINE",
          "username": "supabot",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
      "success": true,
    }
  `)
  // check our result types match the runtime result
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.array(
    z.object({
      status: z.enum(['ONLINE', 'OFFLINE'] as const),
      username: z.string(),
    })
  )
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('RPC call with field aliasing', async () => {
  const res = await postgrest.rpc(RPC_NAME, { name_param: 'supabot' }).select('name:username')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "name": "supabot",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
      "success": true,
    }
  `)
  // check our result types match the runtime result
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.array(
    z.object({
      name: z.string(),
    })
  )
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('RPC call with field casting', async () => {
  const res = await postgrest.rpc(RPC_NAME, { name_param: 'supabot' }).select('status::text')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "status": "ONLINE",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
      "success": true,
    }
  `)
  // check our result types match the runtime result
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.array(
    z.object({
      status: z.string(),
    })
  )
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('RPC call with field aggregate', async () => {
  const res = await postgrest
    .rpc(RPC_NAME, { name_param: 'supabot' })
    .select('username.count(), status')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "count": 1,
          "status": "ONLINE",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
      "success": true,
    }
  `)
  // check our result types match the runtime result
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.array(
    z.object({
      count: z.number(),
      status: z.enum(['ONLINE', 'OFFLINE'] as const),
    })
  )
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('RPC call with bigint param is accepted by a bigint Postgres argument', async () => {
  // The args cast is deliberate: pg-meta types a Postgres bigint column as `number`, and this test
  // exercises passing a JS bigint through to it. Only the function name no longer needs casting.
  const res = await postgrest.rpc('echo_bigint_as_text', { bigint_param: BIGINT_PARAM } as any)

  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": "9223372036854775807",
      "error": null,
      "status": 200,
      "statusText": "OK",
      "success": true,
    }
  `)
})

test('RPC call with bigint nested in jsonb param is serialized as a JSON string', async () => {
  const res = await postgrest.rpc('extract_jsonb_bigint_as_text', {
    payload: { id: BIGINT_PARAM },
  })

  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": "9223372036854775807",
      "error": null,
      "status": 200,
      "statusText": "OK",
      "success": true,
    }
  `)
})

describe('RPC call with get/head serializes Date args in the query string', () => {
  // `Date.prototype.toString()` (e.g. `Wed Nov 04 2026 10:00:00 GMT-0500 (Eastern Standard
  // Time)`) is rejected by every Postgres date/time input function, while the POST body path
  // sends `toISOString()` via `JSON.stringify`. The query string must use the same ISO form.
  const DATE = new Date('2026-11-04T15:00:00.000Z')
  const OTHER_DATE = new Date('2026-11-05T15:00:00.000Z')

  const createClient = () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: async () => '[]',
    })
    const client = new PostgrestClient<Database>('https://example.com', {
      fetch: mockFetch as any,
    })
    return { client, mockFetch }
  }

  test('get: true sends a Date arg as an ISO 8601 string', async () => {
    const { client, mockFetch } = createClient()

    await client.rpc('my_func' as any, { since: DATE, limit_rows: 5 } as any, { get: true })

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(options.method).toBe('GET')
    expect(new URL(url).searchParams.get('since')).toBe('2026-11-04T15:00:00.000Z')
    expect(new URL(url).searchParams.get('limit_rows')).toBe('5')
  })

  test('get: true sends a Date[] arg as an array literal of ISO 8601 strings', async () => {
    const { client, mockFetch } = createClient()

    await client.rpc('my_func' as any, { days: [DATE, OTHER_DATE] } as any, { get: true })

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(options.method).toBe('GET')
    expect(new URL(url).searchParams.get('days')).toBe(
      '{2026-11-04T15:00:00.000Z,2026-11-05T15:00:00.000Z}'
    )
  })

  test('head: true keeps HEAD for a Date arg instead of falling back to POST', async () => {
    const { client, mockFetch } = createClient()

    await client.rpc('my_func' as any, { since: DATE } as any, { head: true, count: 'exact' })

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(options.method).toBe('HEAD')
    expect(options.body).toBeUndefined()
    expect(new URL(url).searchParams.get('since')).toBe('2026-11-04T15:00:00.000Z')
    expect((options.headers as Record<string, string>)['prefer']).toBe('count=exact')
  })

  test('head: true still falls back to POST for a plain object arg', async () => {
    const { client, mockFetch } = createClient()

    await client.rpc('my_func' as any, { since: DATE, filter: { a: 1 } } as any, { head: true })

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body as string)).toEqual({
      since: '2026-11-04T15:00:00.000Z',
      filter: { a: 1 },
    })
  })

  test('get: true passes an invalid Date through for the server to reject', async () => {
    const { client, mockFetch } = createClient()

    // `toISOString()` throws a RangeError on an invalid Date; building the request must not.
    await client.rpc('my_func' as any, { since: new Date('nope') } as any, { get: true })

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(new URL(url).searchParams.get('since')).toBe('Invalid Date')
  })

  test('the POST body and the GET query string serialize a Date arg the same way', async () => {
    const { client, mockFetch } = createClient()

    await client.rpc('my_func' as any, { since: DATE } as any)
    await client.rpc('my_func' as any, { since: DATE } as any, { get: true })

    const [, postOptions] = mockFetch.mock.calls[0] as [string, RequestInit]
    const [getUrl] = mockFetch.mock.calls[1] as [string, RequestInit]
    expect(JSON.parse(postOptions.body as string).since).toBe(
      new URL(getUrl).searchParams.get('since')
    )
  })

  test('head: true converts Dates inside nested arrays', async () => {
    const { client, mockFetch } = createClient()

    await client.rpc('my_func' as any, { days: [[DATE], [OTHER_DATE]] } as any, { head: true })

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(options.method).toBe('HEAD')
    // nested arrays are flattened into the literal, as before; only the Dates change.
    expect(new URL(url).searchParams.get('days')).toBe(
      '{2026-11-04T15:00:00.000Z,2026-11-05T15:00:00.000Z}'
    )
  })

  test('get: true leaves non-Date array elements serialized as before', async () => {
    const { client, mockFetch } = createClient()

    await client.rpc('my_func' as any, { days: [DATE, null, 'x', 7] } as any, { get: true })

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    // `Array.prototype.join` renders null as an empty element; only the Date changes.
    expect(new URL(url).searchParams.get('days')).toBe('{2026-11-04T15:00:00.000Z,,x,7}')
  })
})
