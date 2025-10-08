import { PostgrestClient } from '../src/index'
import { Database } from './types.override'
import { Database as DatabaseWithOptions13 } from './types.override-with-options-postgrest13'
import { expectType, TypeEqual } from './types'
import { z } from 'zod'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient<Database>(REST_URL)
const REST_URL_13 = 'http://localhost:3001'
const postgrest13 = new PostgrestClient<Database, { PostgrestVersion: '13' }>(REST_URL_13)
const postgrest13FromDatabaseTypes = new PostgrestClient<DatabaseWithOptions13>(REST_URL_13)

test('select with aggregate count and spread', async () => {
  const res = await postgrest
    .from('users')
    .select('username, messages(channels(count(), ...channel_details(details)))')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": null,
      "data": Object {
        "messages": Array [
          Object {
            "channels": Object {
              "count": 1,
              "details": "Details for public channel",
            },
          },
          Object {
            "channels": Object {
              "count": 1,
              "details": "Details for random channel",
            },
          },
          Object {
            "channels": Object {
              "count": 1,
              "details": null,
            },
          },
        ],
        "username": "supabot",
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    username: z.string(),
    messages: z.array(
      z.object({
        channels: z.object({
          count: z.number(),
          details: z.string().nullable(),
        }),
      })
    ),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('spread resource with single column in select query', async () => {
  const res = await postgrest
    .from('users')
    .select('username, messages(channels(count(), ...channel_details(details)))')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": null,
      "data": Object {
        "messages": Array [
          Object {
            "channels": Object {
              "count": 1,
              "details": "Details for public channel",
            },
          },
          Object {
            "channels": Object {
              "count": 1,
              "details": "Details for random channel",
            },
          },
          Object {
            "channels": Object {
              "count": 1,
              "details": null,
            },
          },
        ],
        "username": "supabot",
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    username: z.string(),
    messages: z.array(
      z.object({
        channels: z.object({
          count: z.number(),
          details: z.string().nullable(),
        }),
      })
    ),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('spread resource with all columns in select query', async () => {
  const res = await postgrest
    .from('users')
    .select('username, messages(channels(count(), ...channel_details(*)))')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": null,
      "data": Object {
        "messages": Array [
          Object {
            "channels": Object {
              "count": 1,
              "details": "Details for public channel",
              "id": 1,
            },
          },
          Object {
            "channels": Object {
              "count": 1,
              "details": "Details for random channel",
              "id": 2,
            },
          },
          Object {
            "channels": Object {
              "count": 1,
              "details": null,
              "id": null,
            },
          },
        ],
        "username": "supabot",
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    username: z.string(),
    messages: z.array(
      z.object({
        channels: z.object({
          count: z.number(),
          details: z.string().nullable(),
          id: z.number().nullable(),
        }),
      })
    ),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('select with aggregate sum and spread', async () => {
  const res = await postgrest
    .from('users')
    .select('username, messages(channels(id.sum(), ...channel_details(details)))')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": null,
      "data": Object {
        "messages": Array [
          Object {
            "channels": Object {
              "details": "Details for public channel",
              "sum": 1,
            },
          },
          Object {
            "channels": Object {
              "details": "Details for random channel",
              "sum": 2,
            },
          },
          Object {
            "channels": Object {
              "details": null,
              "sum": 3,
            },
          },
        ],
        "username": "supabot",
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    username: z.string(),
    messages: z.array(
      z.object({
        channels: z.object({
          sum: z.number(),
          details: z.string().nullable(),
        }),
      })
    ),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('select with aggregate sum and spread on nested relation', async () => {
  const res = await postgrest
    .from('users')
    .select(
      'username, messages(channels(id.sum(), ...channel_details(details_sum:id.sum(), details)))'
    )
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": null,
      "data": Object {
        "messages": Array [
          Object {
            "channels": Object {
              "details": "Details for public channel",
              "details_sum": 1,
              "sum": 1,
            },
          },
          Object {
            "channels": Object {
              "details": "Details for random channel",
              "details_sum": 2,
              "sum": 2,
            },
          },
          Object {
            "channels": Object {
              "details": null,
              "details_sum": null,
              "sum": 3,
            },
          },
        ],
        "username": "supabot",
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    username: z.string(),
    messages: z.array(
      z.object({
        channels: z.object({
          sum: z.number(),
          details_sum: z.number().nullable(),
          details: z.string().nullable(),
        }),
      })
    ),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('select with spread on nested relation', async () => {
  const res = await postgrest
    .from('messages')
    .select('id, channels(id, ...channel_details(details_id:id, details))')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": null,
      "data": Object {
        "channels": Object {
          "details": "Details for public channel",
          "details_id": 1,
          "id": 1,
        },
        "id": 1,
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    id: z.number(),
    channels: z.object({
      id: z.number(),
      details_id: z.number().nullable(),
      details: z.string().nullable(),
    }),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('select spread on many relation postgrest13', async () => {
  const res = await postgrest13
    .from('channels')
    .select('channel_id:id, ...messages(id, message)')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": null,
      "data": Object {
        "channel_id": 1,
        "id": Array [
          1,
        ],
        "message": Array [
          "Hello World 👋",
        ],
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    channel_id: z.number(),
    id: z.array(z.number()),
    message: z.array(z.string().nullable()),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('select spread on many relation postgrest13FromDatabaseTypes', async () => {
  const res = await postgrest13FromDatabaseTypes
    .from('channels')
    .select('channel_id:id, ...messages(id, message)')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": null,
      "data": Object {
        "channel_id": 1,
        "id": Array [
          1,
        ],
        "message": Array [
          "Hello World 👋",
        ],
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    channel_id: z.number(),
    id: z.array(z.number()),
    message: z.array(z.string().nullable()),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})
