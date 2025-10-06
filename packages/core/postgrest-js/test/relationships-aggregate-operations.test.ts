import { PostgrestClient } from '../src/index'
import { Database } from './types.override'
import { expectType, TypeEqual } from './types'
import { z } from 'zod'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient<Database>(REST_URL)

test('select with aggregate count function', async () => {
  const res = await postgrest.from('users').select('username, messages(count)').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Object {
          "messages": Array [
            Object {
              "count": 3,
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
        count: z.number(),
      })
    ),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('select with aggregate count on a column function', async () => {
  const res = await postgrest
    .from('users')
    .select('username, messages(id.count())')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Object {
          "messages": Array [
            Object {
              "count": 3,
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
        count: z.number(),
      })
    ),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('select with aggregate count function and alias', async () => {
  const res = await postgrest
    .from('users')
    .select('username, messages(message_count:count())')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Object {
          "messages": Array [
            Object {
              "message_count": 3,
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
        message_count: z.number(),
      })
    ),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('select with aggregate nested count function', async () => {
  const res = await postgrest
    .from('users')
    .select('username, messages(channels(count))')
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
              },
            },
            Object {
              "channels": Object {
                "count": 1,
              },
            },
            Object {
              "channels": Object {
                "count": 1,
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
        }),
      })
    ),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('select with aggregate nested count function and alias', async () => {
  const res = await postgrest
    .from('users')
    .select('username, messages(channels(channel_count:count()))')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Object {
          "messages": Array [
            Object {
              "channels": Object {
                "channel_count": 1,
              },
            },
            Object {
              "channels": Object {
                "channel_count": 1,
              },
            },
            Object {
              "channels": Object {
                "channel_count": 1,
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
          channel_count: z.number(),
        }),
      })
    ),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('select with aggregate sum function', async () => {
  const res = await postgrest.from('users').select('username, messages(id.sum())').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Object {
          "messages": Array [
            Object {
              "sum": 7,
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
        sum: z.number(),
      })
    ),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('select with aggregate aliased sum function', async () => {
  const res = await postgrest
    .from('users')
    .select('username, messages(sum_id:id.sum())')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Object {
          "messages": Array [
            Object {
              "sum_id": 7,
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
        sum_id: z.number(),
      })
    ),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('select with aggregate sum function on nested relation', async () => {
  const res = await postgrest
    .from('users')
    .select('username, messages(channels(id.sum()))')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Object {
          "messages": Array [
            Object {
              "channels": Object {
                "sum": 1,
              },
            },
            Object {
              "channels": Object {
                "sum": 2,
              },
            },
            Object {
              "channels": Object {
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
        }),
      })
    ),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})
