import { PostgrestClient } from '../src/index'
import { expectType, TypeEqual } from './types'
import { z } from 'zod'
import type { Json } from './postgrest.generated'

const postgrest = new PostgrestClient('http://localhost:54321/rest/v1')

type MessageRow = SupabaseDatabase['public']['Tables']['messages']['Row']

test('embedded select', async () => {
  // By default postgrest will omit computed field from "star" selector
  const res = await postgrest.from('users').select('messages(*)').order('username')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
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
              "message": "Some message on channel without details",
              "username": "supabot",
            },
            {
              "channel_id": 3,
              "data": null,
              "id": 3,
              "message": "Some message on channel without details",
              "username": "supabot",
            },
          ],
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
      "success": true,
    }
  `)
  type Result = Exclude<typeof res.data, null>
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
  type Expected = { messages: MessageRow[] }[]
  expectType<TypeEqual<Result, Expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('embedded select with computed field explicit selection', async () => {
  // If the computed field is explicitely requested on top of the star selector, it should be present in the result
  const res = await postgrest.from('users').select('messages(*, blurb_message)').order('username')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
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
              "message": "Some message on channel without details",
              "username": "supabot",
            },
            {
              "blurb_message": "Som",
              "channel_id": 3,
              "data": null,
              "id": 3,
              "message": "Some message on channel without details",
              "username": "supabot",
            },
          ],
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
      "success": true,
    }
  `)
  type Result = Exclude<typeof res.data, null>
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
  type Expected = {
    messages: {
      id: number
      data: Json
      message: string | null
      username: string
      channel_id: number
      blurb_message: string | null
    }[]
  }[]
  expectType<TypeEqual<Result, Expected>>(true)
  ExpectedSchema.parse(res.data)
})

describe('embedded filters', () => {
  // TODO: Test more filters
  test('embedded eq', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .order('username')
      .eq('messages.channel_id' as any, 1)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
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
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    type Result = Exclude<typeof res.data, null>
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
    type Expected = { messages: MessageRow[] }[]
    expectType<TypeEqual<Result, Expected>>(true)
    ExpectedSchema.parse(res.data)
  })
  test('embedded or', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .order('username')
      .or('channel_id.eq.2,message.eq.Hello World 👋', { referencedTable: 'messages' })
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
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
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    type Result = Exclude<typeof res.data, null>
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
    type Expected = { messages: MessageRow[] }[]
    expectType<TypeEqual<Result, Expected>>(true)
    ExpectedSchema.parse(res.data)
  })
  test('embedded or with and', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .order('username')
      .or('channel_id.eq.2,and(message.eq.Hello World 👋,username.eq.supabot)', {
        referencedTable: 'messages',
      })
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
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
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    type Result = Exclude<typeof res.data, null>
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
    type Expected = { messages: MessageRow[] }[]
    expectType<TypeEqual<Result, Expected>>(true)
    ExpectedSchema.parse(res.data)
  })
})

describe('embedded transforms', () => {
  test('embedded order', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .order('username')
      .order('channel_id' as any, { referencedTable: 'messages', ascending: false })
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
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
          {
            "messages": [
              {
                "channel_id": 3,
                "data": null,
                "id": 4,
                "message": "Some message on channel without details",
                "username": "supabot",
              },
              {
                "channel_id": 3,
                "data": null,
                "id": 3,
                "message": "Some message on channel without details",
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
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    type Result = Exclude<typeof res.data, null>
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
    type Expected = { messages: MessageRow[] }[]
    expectType<TypeEqual<Result, Expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embedded order on multiple columns', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .order('username')
      .order('channel_id' as any, { referencedTable: 'messages', ascending: false })
      .order('username', { referencedTable: 'messages', ascending: false })
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
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
          {
            "messages": [
              {
                "channel_id": 3,
                "data": null,
                "id": 4,
                "message": "Some message on channel without details",
                "username": "supabot",
              },
              {
                "channel_id": 3,
                "data": null,
                "id": 3,
                "message": "Some message on channel without details",
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
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    type Result = Exclude<typeof res.data, null>
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
    type Expected = { messages: MessageRow[] }[]
    expectType<TypeEqual<Result, Expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embedded limit', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .order('username')
      .limit(1, { referencedTable: 'messages' })
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
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
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    type Result = Exclude<typeof res.data, null>
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
    type Expected = { messages: MessageRow[] }[]
    expectType<TypeEqual<Result, Expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embedded range', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .order('username')
      .range(1, 1, { referencedTable: 'messages' })
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
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
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    type Result = Exclude<typeof res.data, null>
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
    type Expected = { messages: MessageRow[] }[]
    expectType<TypeEqual<Result, Expected>>(true)
    ExpectedSchema.parse(res.data)
  })
})
