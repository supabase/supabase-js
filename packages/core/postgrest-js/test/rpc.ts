import { PostgrestClient } from '../src/index'
import { Database } from './types.override'
import { expectType } from 'tsd'
import { TypeEqual } from 'ts-expect'

const REST_URL = 'http://localhost:3000'
export const postgrest = new PostgrestClient<Database>(REST_URL)

export const RPC_NAME = 'get_username_and_status'

test('RPC call with no params', async () => {
  const res = await postgrest.rpc(RPC_NAME, { name_param: 'supabot' }).select()
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": null,
      "data": Array [
        Object {
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
  let expected: Database['public']['Functions'][typeof RPC_NAME]['Returns']
  expectType<TypeEqual<typeof result, typeof expected>>(true)
})

test('RPC call with star select', async () => {
  const res = await postgrest.rpc(RPC_NAME, { name_param: 'supabot' }).select('*')
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": null,
      "data": Array [
        Object {
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
  let expected: Database['public']['Functions'][typeof RPC_NAME]['Returns']
  expectType<TypeEqual<typeof result, typeof expected>>(true)
})

test('RPC call with single field select', async () => {
  const res = await postgrest.rpc(RPC_NAME, { name_param: 'supabot' }).select('username')
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": null,
      "data": Array [
        Object {
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
  let expected: { username: string }[]
  expectType<TypeEqual<typeof result, typeof expected>>(true)
})

test('RPC call with multiple fields select', async () => {
  const res = await postgrest.rpc(RPC_NAME, { name_param: 'supabot' }).select('username, status')
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": null,
      "data": Array [
        Object {
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
  let expected: Database['public']['Functions'][typeof RPC_NAME]['Returns']
  expectType<TypeEqual<typeof result, typeof expected>>(true)
})

test('RPC call with field aliasing', async () => {
  const res = await postgrest.rpc(RPC_NAME, { name_param: 'supabot' }).select('name:username')
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": null,
      "data": Array [
        Object {
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
  let expected: { name: string }[]
  expectType<TypeEqual<typeof result, typeof expected>>(true)
})

test('RPC call with field casting', async () => {
  const res = await postgrest.rpc(RPC_NAME, { name_param: 'supabot' }).select('status::text')
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": null,
      "data": Array [
        Object {
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
  let expected: { status: string }[]
  expectType<TypeEqual<typeof result, typeof expected>>(true)
})

test('RPC call with field aggregate', async () => {
  const res = await postgrest
    .rpc(RPC_NAME, { name_param: 'supabot' })
    .select('username.count(), status')
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": null,
      "data": Array [
        Object {
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
  let expected: { count: number; status: 'ONLINE' | 'OFFLINE' }[]
  expectType<TypeEqual<typeof result, typeof expected>>(true)
})
