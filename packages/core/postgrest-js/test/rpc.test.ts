import { PostgrestClient } from '../src/index'
import { Database } from './types.override'
import { expectType, TypeEqual } from './types'
import { z } from 'zod'

const REST_URL = 'http://localhost:3000'
export const postgrest = new PostgrestClient<Database>(REST_URL)

export const RPC_NAME = 'get_username_and_status'

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
