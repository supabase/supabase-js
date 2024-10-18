import { PostgrestClient } from '../src/index'
import { Database } from './types'

const REST_URL = 'http://localhost:3000'
export const postgrest = new PostgrestClient<Database>(REST_URL)

export const RPC_NAME = 'get_username_and_status'

export const selectParams = {
  noParams: undefined,
  starSelect: '*',
  fieldSelect: 'username',
  fieldsSelect: 'username, status',
  fieldAliasing: 'name:username',
  fieldCasting: 'status::text',
  fieldAggregate: 'username.count(), status',
} as const

export const selectQueries = {
  noParams: postgrest.rpc(RPC_NAME, { name_param: 'supabot' }).select(selectParams.noParams),
  starSelect: postgrest.rpc(RPC_NAME, { name_param: 'supabot' }).select(selectParams.starSelect),
  fieldSelect: postgrest.rpc(RPC_NAME, { name_param: 'supabot' }).select(selectParams.fieldSelect),
  fieldsSelect: postgrest
    .rpc(RPC_NAME, { name_param: 'supabot' })
    .select(selectParams.fieldsSelect),
  fieldAliasing: postgrest
    .rpc(RPC_NAME, { name_param: 'supabot' })
    .select(selectParams.fieldAliasing),
  fieldCasting: postgrest
    .rpc(RPC_NAME, { name_param: 'supabot' })
    .select(selectParams.fieldCasting),
  fieldAggregate: postgrest
    .rpc(RPC_NAME, { name_param: 'supabot' })
    .select(selectParams.fieldAggregate),
} as const

test('RPC call with no params', async () => {
  const res = await selectQueries.noParams
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
})

test('RPC call with star select', async () => {
  const res = await selectQueries.starSelect
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
})

test('RPC call with single field select', async () => {
  const res = await selectQueries.fieldSelect
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
})

test('RPC call with multiple fields select', async () => {
  const res = await selectQueries.fieldsSelect
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
})

test('RPC call with field aliasing', async () => {
  const res = await selectQueries.fieldAliasing
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
})

test('RPC call with field casting', async () => {
  const res = await selectQueries.fieldCasting
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
})

test('RPC call with field aggregate', async () => {
  const res = await selectQueries.fieldAggregate
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
})
