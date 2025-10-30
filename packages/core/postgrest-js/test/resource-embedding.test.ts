import { PostgrestClient } from '../src/index'
import { Database } from './types.override'
import { expectType, TypeEqual } from './types'
import { z } from 'zod'
import { RequiredDeep } from 'type-fest'

const postgrest = new PostgrestClient<Database>('http://localhost:3000')

test('embedded select', async () => {
  // By default postgrest will omit computed field from "star" selector
  const res = await postgrest.from('users').select('messages(*)')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "messages": [
            {
              "channel_id": 1,
              "data": null,
              "id": 1,
              "message": "Hello World 👋",
              "username": "supabot",
            },
            {
              "channel_id": 2,
              "data": null,
              "id": 2,
              "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
              "username": "supabot",
            },
            {
              "channel_id": 3,
              "data": null,
              "id": 4,
              "message": "Some message on channel wihtout details",
              "username": "supabot",
            },
          ],
        },
        {
          "messages": [],
        },
        {
          "messages": [],
        },
        {
          "messages": [],
        },
        {
          "messages": [],
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.array(
    z.object({
      messages: z.array(
        z.object({
          channel_id: z.number(),
          data: z.unknown().nullable(),
          id: z.number(),
          message: z.string().nullable(),
          username: z.string(),
        })
      ),
    })
  )
  // TODO: older versions of zod require this trick for non optional unknown data type
  // newer version of zod don't have this issue but require an upgrade of typescript minimal version
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('embedded select with computed field explicit selection', async () => {
  // If the computed field is explicitely requested on top of the star selector, it should be present in the result
  const res = await postgrest.from('users').select('messages(*, blurb_message)')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "messages": [
            {
              "blurb_message": "Hel",
              "channel_id": 1,
              "data": null,
              "id": 1,
              "message": "Hello World 👋",
              "username": "supabot",
            },
            {
              "blurb_message": "Per",
              "channel_id": 2,
              "data": null,
              "id": 2,
              "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
              "username": "supabot",
            },
            {
              "blurb_message": "Som",
              "channel_id": 3,
              "data": null,
              "id": 4,
              "message": "Some message on channel wihtout details",
              "username": "supabot",
            },
          ],
        },
        {
          "messages": [],
        },
        {
          "messages": [],
        },
        {
          "messages": [],
        },
        {
          "messages": [],
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.array(
    z.object({
      messages: z.array(
        z.object({
          channel_id: z.number(),
          data: z.unknown().nullable(),
          id: z.number(),
          message: z.string().nullable(),
          username: z.string(),
          blurb_message: z.string().nullable(),
        })
      ),
    })
  )
  // TODO: older versions of zod require this trick for non optional unknown data type
  // newer version of zod don't have this issue but require an upgrade of typescript minimal version
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

describe('embedded filters', () => {
  // TODO: Test more filters
  test('embedded eq', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .eq('messages.channel_id' as any, 1)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "messages": [
              {
                "channel_id": 1,
                "data": null,
                "id": 1,
                "message": "Hello World 👋",
                "username": "supabot",
              },
            ],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(
      z.object({
        messages: z.array(
          z.object({
            channel_id: z.number(),
            data: z.unknown().nullable(),
            id: z.number(),
            message: z.string().nullable(),
            username: z.string(),
          })
        ),
      })
    )
    // TODO: older versions of zod require this trick for non optional unknown data type
    // newer version of zod don't have this issue but require an upgrade of typescript minimal version
    let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })
  test('embedded or', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .or('channel_id.eq.2,message.eq.Hello World 👋', { foreignTable: 'messages' })
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "messages": [
              {
                "channel_id": 1,
                "data": null,
                "id": 1,
                "message": "Hello World 👋",
                "username": "supabot",
              },
              {
                "channel_id": 2,
                "data": null,
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
                "username": "supabot",
              },
            ],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(
      z.object({
        messages: z.array(
          z.object({
            channel_id: z.number(),
            data: z.unknown().nullable(),
            id: z.number(),
            message: z.string().nullable(),
            username: z.string(),
          })
        ),
      })
    )
    // TODO: older versions of zod require this trick for non optional unknown data type
    // newer version of zod don't have this issue but require an upgrade of typescript minimal version
    let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })
  test('embedded or with and', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .or('channel_id.eq.2,and(message.eq.Hello World 👋,username.eq.supabot)', {
        foreignTable: 'messages',
      })
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "messages": [
              {
                "channel_id": 1,
                "data": null,
                "id": 1,
                "message": "Hello World 👋",
                "username": "supabot",
              },
              {
                "channel_id": 2,
                "data": null,
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
                "username": "supabot",
              },
            ],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(
      z.object({
        messages: z.array(
          z.object({
            channel_id: z.number(),
            data: z.unknown().nullable(),
            id: z.number(),
            message: z.string().nullable(),
            username: z.string(),
          })
        ),
      })
    )
    // TODO: older versions of zod require this trick for non optional unknown data type
    // newer version of zod don't have this issue but require an upgrade of typescript minimal version
    let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })
})

describe('embedded transforms', () => {
  test('embedded order', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .order('channel_id' as any, { foreignTable: 'messages', ascending: false })
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "messages": [
              {
                "channel_id": 3,
                "data": null,
                "id": 4,
                "message": "Some message on channel wihtout details",
                "username": "supabot",
              },
              {
                "channel_id": 2,
                "data": null,
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
                "username": "supabot",
              },
              {
                "channel_id": 1,
                "data": null,
                "id": 1,
                "message": "Hello World 👋",
                "username": "supabot",
              },
            ],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(
      z.object({
        messages: z.array(
          z.object({
            channel_id: z.number(),
            data: z.unknown().nullable(),
            id: z.number(),
            message: z.string().nullable(),
            username: z.string(),
          })
        ),
      })
    )
    // TODO: older versions of zod require this trick for non optional unknown data type
    // newer version of zod don't have this issue but require an upgrade of typescript minimal version
    let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embedded order on multiple columns', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .order('channel_id' as any, { foreignTable: 'messages', ascending: false })
      .order('username', { foreignTable: 'messages', ascending: false })
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "messages": [
              {
                "channel_id": 3,
                "data": null,
                "id": 4,
                "message": "Some message on channel wihtout details",
                "username": "supabot",
              },
              {
                "channel_id": 2,
                "data": null,
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
                "username": "supabot",
              },
              {
                "channel_id": 1,
                "data": null,
                "id": 1,
                "message": "Hello World 👋",
                "username": "supabot",
              },
            ],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(
      z.object({
        messages: z.array(
          z.object({
            channel_id: z.number(),
            data: z.unknown().nullable(),
            id: z.number(),
            message: z.string().nullable(),
            username: z.string(),
          })
        ),
      })
    )
    // TODO: older versions of zod require this trick for non optional unknown data type
    // newer version of zod don't have this issue but require an upgrade of typescript minimal version
    let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embedded limit', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .limit(1, { foreignTable: 'messages' })
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "messages": [
              {
                "channel_id": 1,
                "data": null,
                "id": 1,
                "message": "Hello World 👋",
                "username": "supabot",
              },
            ],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(
      z.object({
        messages: z.array(
          z.object({
            channel_id: z.number(),
            data: z.unknown().nullable(),
            id: z.number(),
            message: z.string().nullable(),
            username: z.string(),
          })
        ),
      })
    )
    // TODO: older versions of zod require this trick for non optional unknown data type
    // newer version of zod don't have this issue but require an upgrade of typescript minimal version
    let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embedded range', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .range(1, 1, { foreignTable: 'messages' })
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "messages": [
              {
                "channel_id": 2,
                "data": null,
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
                "username": "supabot",
              },
            ],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
          {
            "messages": [],
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(
      z.object({
        messages: z.array(
          z.object({
            channel_id: z.number(),
            data: z.unknown().nullable(),
            id: z.number(),
            message: z.string().nullable(),
            username: z.string(),
          })
        ),
      })
    )
    // TODO: older versions of zod require this trick for non optional unknown data type
    // newer version of zod don't have this issue but require an upgrade of typescript minimal version
    let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })
})
