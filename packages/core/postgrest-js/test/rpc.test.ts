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
  const res = await postgrest.rpc('echo_bigint_as_text' as any, { bigint_param: BIGINT_PARAM } as any)

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
  const res = await postgrest.rpc(
    'extract_jsonb_bigint_as_text' as any,
    { payload: { id: BIGINT_PARAM } } as any
  )

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
