import type { RequiredDeep } from 'type-fest'
import { z } from 'zod'
import { PostgrestClient } from '../src/index'
import { expectType, type TypeEqual } from './types'
import type { Database } from './types.override'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient<Database>(REST_URL)

describe('embeded functions select', () => {
  test('embeded_setof_function - function returning a setof embeded table', async () => {
    const res = await postgrest.from('channels').select('id, all_channels_messages:get_messages(*)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "all_channels_messages": [
              {
                "channel_id": 1,
                "data": null,
                "id": 1,
                "message": "Hello World 👋",
                "username": "supabot",
              },
            ],
            "id": 1,
          },
          {
            "all_channels_messages": [
              {
                "channel_id": 2,
                "data": null,
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
                "username": "supabot",
              },
            ],
            "id": 2,
          },
          {
            "all_channels_messages": [
              {
                "channel_id": 3,
                "data": null,
                "id": 4,
                "message": "Some message on channel wihtout details",
                "username": "supabot",
              },
            ],
            "id": 3,
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
        id: z.number(),
        all_channels_messages: z.array(
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
    let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
    // Assert over the keys of the expected and result objects to ensure consistency between versions of types
    // should always fallback to a SelectQueryError if the relation cannot be found
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_setof_function_fields_selection - function returning a setof embeded table with fields selection', async () => {
    const res = await postgrest
      .from('channels')
      .select('id, all_channels_messages:get_messages(id,message)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "all_channels_messages": [
              {
                "id": 1,
                "message": "Hello World 👋",
              },
            ],
            "id": 1,
          },
          {
            "all_channels_messages": [
              {
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
              },
            ],
            "id": 2,
          },
          {
            "all_channels_messages": [
              {
                "id": 4,
                "message": "Some message on channel wihtout details",
              },
            ],
            "id": 3,
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
        id: z.number(),
        all_channels_messages: z.array(
          z.object({
            id: z.number(),
            message: z.string().nullable(),
          })
        ),
      })
    )
    let expected: z.infer<typeof ExpectedSchema>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_setof_function_double_definition - function double definition returning a setof embeded table', async () => {
    const res = await postgrest.from('users').select('username, all_user_messages:get_messages(*)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "all_user_messages": [
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
            "username": "supabot",
          },
          {
            "all_user_messages": [],
            "username": "kiwicopple",
          },
          {
            "all_user_messages": [],
            "username": "awailas",
          },
          {
            "all_user_messages": [],
            "username": "jsonuser",
          },
          {
            "all_user_messages": [],
            "username": "dragarcia",
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
        username: z.string(),
        all_user_messages: z.array(
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
    let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_setof_function_double_definition_fields_selection - function double definition returning a setof embeded table with fields selection', async () => {
    const res = await postgrest
      .from('users')
      .select('username, all_user_messages:get_messages(id,message)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "all_user_messages": [
              {
                "id": 1,
                "message": "Hello World 👋",
              },
              {
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
              },
              {
                "id": 4,
                "message": "Some message on channel wihtout details",
              },
            ],
            "username": "supabot",
          },
          {
            "all_user_messages": [],
            "username": "kiwicopple",
          },
          {
            "all_user_messages": [],
            "username": "awailas",
          },
          {
            "all_user_messages": [],
            "username": "jsonuser",
          },
          {
            "all_user_messages": [],
            "username": "dragarcia",
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
        username: z.string(),
        all_user_messages: z.array(
          z.object({
            id: z.number(),
            message: z.string().nullable(),
          })
        ),
      })
    )
    let expected: z.infer<typeof ExpectedSchema>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_setof_function_double_definition_fields_selection - function double definition returning a setof embeded table with fields selection including computed fields', async () => {
    const res = await postgrest
      .from('users')
      .select('username, all_user_messages:get_messages(id,message, blurb_message)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "all_user_messages": [
              {
                "blurb_message": "Hel",
                "id": 1,
                "message": "Hello World 👋",
              },
              {
                "blurb_message": "Per",
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
              },
              {
                "blurb_message": "Som",
                "id": 4,
                "message": "Some message on channel wihtout details",
              },
            ],
            "username": "supabot",
          },
          {
            "all_user_messages": [],
            "username": "kiwicopple",
          },
          {
            "all_user_messages": [],
            "username": "awailas",
          },
          {
            "all_user_messages": [],
            "username": "jsonuser",
          },
          {
            "all_user_messages": [],
            "username": "dragarcia",
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
        username: z.string(),
        all_user_messages: z.array(
          z.object({
            id: z.number(),
            message: z.string().nullable(),
            blurb_message: z.string().nullable(),
          })
        ),
      })
    )
    let expected: z.infer<typeof ExpectedSchema>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_using_setof_rows_one - function returning a setof single row embeded table', async () => {
    const res = await postgrest
      .from('users')
      .select('username, setof_rows_one:function_using_setof_rows_one(*)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "setof_rows_one": {
              "id": 1,
              "username": "supabot",
            },
            "username": "supabot",
          },
          {
            "setof_rows_one": null,
            "username": "kiwicopple",
          },
          {
            "setof_rows_one": null,
            "username": "awailas",
          },
          {
            "setof_rows_one": null,
            "username": "jsonuser",
          },
          {
            "setof_rows_one": null,
            "username": "dragarcia",
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
        username: z.string(),
        setof_rows_one: z
          .object({
            id: z.number(),
            username: z.string().nullable(),
          })
          .nullable(),
      })
    )
    let expected: z.infer<typeof ExpectedSchema>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_using_table_returns - function returns row embeded table', async () => {
    const res = await postgrest
      .from('users')
      .select('username, returns_row:function_using_table_returns(*)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "returns_row": {
              "id": 1,
              "username": "supabot",
            },
            "username": "supabot",
          },
          {
            "returns_row": {
              "id": null,
              "username": null,
            },
            "username": "kiwicopple",
          },
          {
            "returns_row": {
              "id": null,
              "username": null,
            },
            "username": "awailas",
          },
          {
            "returns_row": {
              "id": null,
              "username": null,
            },
            "username": "jsonuser",
          },
          {
            "returns_row": {
              "id": null,
              "username": null,
            },
            "username": "dragarcia",
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
        username: z.string(),
        returns_row: z.object({
          id: z.number().nullable(),
          username: z.string().nullable(),
        }),
      })
    )
    let expected: z.infer<typeof ExpectedSchema>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_setof_row_one_function_not_nullable - function returning a single row embeded table not nullable', async () => {
    const res = await postgrest
      .from('users')
      // Inner join to ensure the join result is not nullable can also be set at relation level
      // by setting isNotNullable for the function SetofOptions definition to true
      .select('username, user_called_profile_not_null:get_user_profile_non_nullable!inner(*)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "user_called_profile_not_null": {
              "id": 1,
              "username": "supabot",
            },
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
    let result: Exclude<typeof res.data, null>
    // The override marks this as not nullable, but the data can be null at runtime.
    // So the correct runtime schema is nullable, but the type is not.
    // We check that the type is as expected (not nullable), but parsing will fail.
    const ExpectedSchema = z.array(
      z.object({
        username: z.string(),
        user_called_profile_not_null: z.object({
          id: z.number(),
          username: z.string().nullable(),
        }),
      })
    )
    let expected: z.infer<typeof ExpectedSchema>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    // Can parse the data because the !inner ensure the join result from function is not nullable
    ExpectedSchema.parse(res.data)
  })

  test('embeded_setof_row_one_function_with_fields_selection - function returning a single row embeded table with fields selection', async () => {
    const res = await postgrest
      .from('users')
      .select('username, user_called_profile:get_user_profile(username)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "user_called_profile": {
              "username": "supabot",
            },
            "username": "supabot",
          },
          {
            "user_called_profile": {
              "username": null,
            },
            "username": "kiwicopple",
          },
          {
            "user_called_profile": {
              "username": null,
            },
            "username": "awailas",
          },
          {
            "user_called_profile": {
              "username": null,
            },
            "username": "jsonuser",
          },
          {
            "user_called_profile": {
              "username": null,
            },
            "username": "dragarcia",
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
        username: z.string(),
        user_called_profile: z.object({
          username: z.string().nullable(),
        }),
      })
    )
    let expected: z.infer<typeof ExpectedSchema>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_setof_function_with_fields_selection_with_sub_linking - function embedded table with fields selection and sub linking', async () => {
    const res = await postgrest
      .from('channels')
      .select('id, all_channels_messages:get_messages(id,message,channels(id,slug))')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "all_channels_messages": [
              {
                "channels": {
                  "id": 1,
                  "slug": "public",
                },
                "id": 1,
                "message": "Hello World 👋",
              },
            ],
            "id": 1,
          },
          {
            "all_channels_messages": [
              {
                "channels": {
                  "id": 2,
                  "slug": "random",
                },
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
              },
            ],
            "id": 2,
          },
          {
            "all_channels_messages": [
              {
                "channels": {
                  "id": 3,
                  "slug": "other",
                },
                "id": 4,
                "message": "Some message on channel wihtout details",
              },
            ],
            "id": 3,
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
        id: z.number(),
        all_channels_messages: z.array(
          z.object({
            id: z.number(),
            message: z.string().nullable(),
            channels: z.object({
              id: z.number(),
              slug: z.string().nullable(),
            }),
          })
        ),
      })
    )
    let expected: z.infer<typeof ExpectedSchema>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_with_table_row_input - function with table row input', async () => {
    const res = await postgrest.from('users').select('username, user_messages:get_user_messages(*)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "user_messages": [
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
            "username": "supabot",
          },
          {
            "user_messages": [],
            "username": "kiwicopple",
          },
          {
            "user_messages": [],
            "username": "awailas",
          },
          {
            "user_messages": [],
            "username": "jsonuser",
          },
          {
            "user_messages": [],
            "username": "dragarcia",
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
        username: z.string(),
        user_messages: z.array(
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
    let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_with_view_row_input - function with view row input', async () => {
    const res = await postgrest
      .from('active_users')
      .select('username, active_user_messages:get_active_user_messages(*)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "active_user_messages": [
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
            "username": "supabot",
          },
          {
            "active_user_messages": [],
            "username": "awailas",
          },
          {
            "active_user_messages": [],
            "username": "jsonuser",
          },
          {
            "active_user_messages": [],
            "username": "dragarcia",
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
        username: z.string().nullable(),
        active_user_messages: z.array(
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
    let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_returning_view - function returning view', async () => {
    const res = await postgrest
      .from('users')
      .select('username, recent_messages:get_user_recent_messages(*)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "recent_messages": [
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
            "username": "supabot",
          },
          {
            "recent_messages": [],
            "username": "kiwicopple",
          },
          {
            "recent_messages": [],
            "username": "awailas",
          },
          {
            "recent_messages": [],
            "username": "jsonuser",
          },
          {
            "recent_messages": [],
            "username": "dragarcia",
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
        username: z.string(),
        recent_messages: z.array(
          z.object({
            channel_id: z.number().nullable(),
            data: z.unknown().nullable(),
            id: z.number().nullable(),
            message: z.string().nullable(),
            username: z.string().nullable(),
          })
        ),
      })
    )
    let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_with_view_input_returning_view - function with view input returning view', async () => {
    const res = await postgrest
      .from('active_users')
      .select('username, recent_messages:get_user_recent_messages(*)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "recent_messages": [
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
            "username": "supabot",
          },
          {
            "recent_messages": [],
            "username": "awailas",
          },
          {
            "recent_messages": [],
            "username": "jsonuser",
          },
          {
            "recent_messages": [],
            "username": "dragarcia",
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
        username: z.string().nullable(),
        recent_messages: z.array(
          z.object({
            channel_id: z.number().nullable(),
            data: z.unknown().nullable(),
            id: z.number().nullable(),
            message: z.string().nullable(),
            username: z.string().nullable(),
          })
        ),
      })
    )
    let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_with_blurb_message - function with blurb_message', async () => {
    const res = await postgrest
      .from('users')
      .select('username, user_messages:get_user_messages(id,message,blurb_message)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "user_messages": [
              {
                "blurb_message": "Hel",
                "id": 1,
                "message": "Hello World 👋",
              },
              {
                "blurb_message": "Per",
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
              },
              {
                "blurb_message": "Som",
                "id": 4,
                "message": "Some message on channel wihtout details",
              },
            ],
            "username": "supabot",
          },
          {
            "user_messages": [],
            "username": "kiwicopple",
          },
          {
            "user_messages": [],
            "username": "awailas",
          },
          {
            "user_messages": [],
            "username": "jsonuser",
          },
          {
            "user_messages": [],
            "username": "dragarcia",
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
        username: z.string(),
        user_messages: z.array(
          z.object({
            id: z.number(),
            message: z.string().nullable(),
            blurb_message: z.string().nullable(),
          })
        ),
      })
    )
    let expected: z.infer<typeof ExpectedSchema>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_returning_row - Cannot embed an function that is not a setofOptions one', async () => {
    const res = await postgrest.from('channels').select('id, user:function_returning_row(*)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": null,
        "error": {
          "code": "PGRST200",
          "details": "Searched for a foreign key relationship between 'channels' and 'function_returning_row' in the schema 'public', but no matches were found.",
          "hint": null,
          "message": "Could not find a relationship between 'channels' and 'function_returning_row' in the schema cache",
        },
        "status": 400,
        "statusText": "Bad Request",
      }
    `)
    let result: Exclude<typeof res.data, null>
    let expected: never[]
    expectType<TypeEqual<typeof result, typeof expected>>(true)
  })

  test('embeded_function_returning_single_row - can embed single row returns function with row single param', async () => {
    const res = await postgrest
      .from('messages')
      .select('id, user:function_returning_single_row(status, username)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "id": 1,
            "user": {
              "status": "ONLINE",
              "username": "supabot",
            },
          },
          {
            "id": 2,
            "user": {
              "status": "ONLINE",
              "username": "supabot",
            },
          },
          {
            "id": 4,
            "user": {
              "status": "ONLINE",
              "username": "supabot",
            },
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
        id: z.number(),
        user: z.object({
          status: z.enum(['ONLINE', 'OFFLINE'] as const).nullable(),
          username: z.string().nullable(),
        }),
      })
    )
    let expected: z.infer<typeof ExpectedSchema>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_returning_set_of_rows - function returning set of rows', async () => {
    const res = await postgrest
      .from('messages')
      .select('id, users:function_returning_set_of_rows(*)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": null,
        "error": {
          "code": "PGRST200",
          "details": "Searched for a foreign key relationship between 'messages' and 'function_returning_set_of_rows' in the schema 'public', but no matches were found.",
          "hint": null,
          "message": "Could not find a relationship between 'messages' and 'function_returning_set_of_rows' in the schema cache",
        },
        "status": 400,
        "statusText": "Bad Request",
      }
    `)
    let result: Exclude<typeof res.data, null>
    let expected: never[]
    expectType<TypeEqual<typeof result, typeof expected>>(true)
  })

  test('function_using_setof_rows_one', async () => {
    const res = await postgrest
      .from('users')
      .select('username, profile:function_using_table_returns(*)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "profile": {
              "id": 1,
              "username": "supabot",
            },
            "username": "supabot",
          },
          {
            "profile": {
              "id": null,
              "username": null,
            },
            "username": "kiwicopple",
          },
          {
            "profile": {
              "id": null,
              "username": null,
            },
            "username": "awailas",
          },
          {
            "profile": {
              "id": null,
              "username": null,
            },
            "username": "jsonuser",
          },
          {
            "profile": {
              "id": null,
              "username": null,
            },
            "username": "dragarcia",
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
        username: z.string(),
        profile: z.object({
          id: z.number().nullable(),
          username: z.string().nullable(),
        }),
      })
    )
    let expected: z.infer<typeof ExpectedSchema>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('function_using_table_returns', async () => {
    const res = await postgrest
      .from('users')
      .select('username, profile:function_using_setof_rows_one(*)')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "profile": {
              "id": 1,
              "username": "supabot",
            },
            "username": "supabot",
          },
          {
            "profile": null,
            "username": "kiwicopple",
          },
          {
            "profile": null,
            "username": "awailas",
          },
          {
            "profile": null,
            "username": "jsonuser",
          },
          {
            "profile": null,
            "username": "dragarcia",
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
        username: z.string(),
        profile: z
          .object({
            id: z.number(),
            username: z.string().nullable(),
          })
          .nullable(),
      })
    )
    let expected: z.infer<typeof ExpectedSchema>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  // test select the created_ago embeded function
  test('select the created_ago embeded function', async () => {
    const res = await postgrest.from('users_audit').select('id, created_ago')
    // Don't snapshot time-based values - they change daily and cause flaky tests
    expect(res.error).toBeNull()
    expect(res.status).toBe(200)
    expect(res.statusText).toBe('OK')
    expect(res.count).toBeNull()
    expect(res.data).toHaveLength(5)
    // Verify structure of each record
    expect(res.data?.[0]).toMatchObject({
      id: expect.any(Number),
      created_ago: expect.any(Number),
    })
    // Verify time-based value is reasonable
    expect(res.data?.[0].created_ago).toBeGreaterThanOrEqual(0)
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(
      z.object({
        id: z.number(),
        created_ago: z.number().nullable(),
      })
    )
    let expected: z.infer<typeof ExpectedSchema>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
    const use_rpc_call = await postgrest.rpc('created_ago', {
      // @ts-expect-error Object literal may only specify known properties
      id: 1,
    })
    expect(use_rpc_call).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": null,
        "error": {
          "code": "PGRST202",
          "details": "Searched for the function public.created_ago with parameter id or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.",
          "hint": null,
          "message": "Could not find the function public.created_ago(id) in the schema cache",
        },
        "status": 404,
        "statusText": "Not Found",
      }
    `)
    let result_rpc: Exclude<typeof use_rpc_call.data, null>
    expectType<
      TypeEqual<
        typeof result_rpc,
        {
          error: true
        } & 'the function public.created_ago with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache'
      >
    >(true)
  })
  // Test the days_since_event embeded function over partitioned table
  test('select the days_since_event embeded function over partitioned table', async () => {
    const res = await postgrest.from('events').select('id, days_since_event')
    // Don't snapshot time-based values - they change daily and cause flaky tests
    expect(res.error).toBeNull()
    expect(res.status).toBe(200)
    expect(res.statusText).toBe('OK')
    expect(res.count).toBeNull()
    expect(res.data).toHaveLength(2)
    // Verify structure of each record
    expect(res.data?.[0]).toMatchObject({
      id: expect.any(Number),
      days_since_event: expect.any(Number),
    })
    // Verify time-based value is reasonable
    expect(res.data?.[0].days_since_event).toBeGreaterThanOrEqual(0)
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(
      z.object({
        id: z.number(),
        days_since_event: z.number().nullable(),
      })
    )
    let expected: z.infer<typeof ExpectedSchema>
    expectType<TypeEqual<keyof (typeof expected)[number], keyof (typeof result)[number]>>(true)
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
    const use_rpc_call = await postgrest.rpc('days_since_event', {
      // @ts-expect-error Object literal may only specify known properties
      id: 1,
    })
    expect(use_rpc_call).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": null,
        "error": {
          "code": "PGRST202",
          "details": "Searched for the function public.days_since_event with parameter id or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.",
          "hint": null,
          "message": "Could not find the function public.days_since_event(id) in the schema cache",
        },
        "status": 404,
        "statusText": "Not Found",
      }
    `)
    let result_rpc: Exclude<typeof use_rpc_call.data, null>
    expectType<
      TypeEqual<
        typeof result_rpc,
        {
          error: true
        } & 'the function public.days_since_event with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache'
      >
    >(true)
  })
})
