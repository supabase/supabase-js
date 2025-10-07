import { PostgrestClient } from '../src/index'
import { Database } from './types.override'
import { expectType, TypeEqual } from './types'
import { z } from 'zod'
import { RequiredDeep } from 'type-fest'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient<Database>(REST_URL)

describe('embeded functions select', () => {
  test('embeded_setof_function - function returning a setof embeded table', async () => {
    const res = await postgrest.from('channels').select('id, all_channels_messages:get_messages(*)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "all_channels_messages": Array [
              Object {
                "channel_id": 1,
                "data": null,
                "id": 1,
                "message": "Hello World 👋",
                "username": "supabot",
              },
            ],
            "id": 1,
          },
          Object {
            "all_channels_messages": Array [
              Object {
                "channel_id": 2,
                "data": null,
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
                "username": "supabot",
              },
            ],
            "id": 2,
          },
          Object {
            "all_channels_messages": Array [
              Object {
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_setof_function_fields_selection - function returning a setof embeded table with fields selection', async () => {
    const res = await postgrest
      .from('channels')
      .select('id, all_channels_messages:get_messages(id,message)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "all_channels_messages": Array [
              Object {
                "id": 1,
                "message": "Hello World 👋",
              },
            ],
            "id": 1,
          },
          Object {
            "all_channels_messages": Array [
              Object {
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
              },
            ],
            "id": 2,
          },
          Object {
            "all_channels_messages": Array [
              Object {
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_setof_function_double_definition - function double definition returning a setof embeded table', async () => {
    const res = await postgrest.from('users').select('username, all_user_messages:get_messages(*)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "all_user_messages": Array [
              Object {
                "channel_id": 1,
                "data": null,
                "id": 1,
                "message": "Hello World 👋",
                "username": "supabot",
              },
              Object {
                "channel_id": 2,
                "data": null,
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
                "username": "supabot",
              },
              Object {
                "channel_id": 3,
                "data": null,
                "id": 4,
                "message": "Some message on channel wihtout details",
                "username": "supabot",
              },
            ],
            "username": "supabot",
          },
          Object {
            "all_user_messages": Array [],
            "username": "kiwicopple",
          },
          Object {
            "all_user_messages": Array [],
            "username": "awailas",
          },
          Object {
            "all_user_messages": Array [],
            "username": "jsonuser",
          },
          Object {
            "all_user_messages": Array [],
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_setof_function_double_definition_fields_selection - function double definition returning a setof embeded table with fields selection', async () => {
    const res = await postgrest
      .from('users')
      .select('username, all_user_messages:get_messages(id,message)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "all_user_messages": Array [
              Object {
                "id": 1,
                "message": "Hello World 👋",
              },
              Object {
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
              },
              Object {
                "id": 4,
                "message": "Some message on channel wihtout details",
              },
            ],
            "username": "supabot",
          },
          Object {
            "all_user_messages": Array [],
            "username": "kiwicopple",
          },
          Object {
            "all_user_messages": Array [],
            "username": "awailas",
          },
          Object {
            "all_user_messages": Array [],
            "username": "jsonuser",
          },
          Object {
            "all_user_messages": Array [],
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_setof_function_double_definition_fields_selection - function double definition returning a setof embeded table with fields selection including computed fields', async () => {
    const res = await postgrest
      .from('users')
      .select('username, all_user_messages:get_messages(id,message, blurb_message)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "all_user_messages": Array [
              Object {
                "blurb_message": "Hel",
                "id": 1,
                "message": "Hello World 👋",
              },
              Object {
                "blurb_message": "Per",
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
              },
              Object {
                "blurb_message": "Som",
                "id": 4,
                "message": "Some message on channel wihtout details",
              },
            ],
            "username": "supabot",
          },
          Object {
            "all_user_messages": Array [],
            "username": "kiwicopple",
          },
          Object {
            "all_user_messages": Array [],
            "username": "awailas",
          },
          Object {
            "all_user_messages": Array [],
            "username": "jsonuser",
          },
          Object {
            "all_user_messages": Array [],
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_using_setof_rows_one - function returning a setof single row embeded table', async () => {
    const res = await postgrest
      .from('users')
      .select('username, setof_rows_one:function_using_setof_rows_one(*)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "setof_rows_one": Object {
              "id": 1,
              "username": "supabot",
            },
            "username": "supabot",
          },
          Object {
            "setof_rows_one": null,
            "username": "kiwicopple",
          },
          Object {
            "setof_rows_one": null,
            "username": "awailas",
          },
          Object {
            "setof_rows_one": null,
            "username": "jsonuser",
          },
          Object {
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_using_table_returns - function returns row embeded table', async () => {
    const res = await postgrest
      .from('users')
      .select('username, returns_row:function_using_table_returns(*)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "returns_row": Object {
              "id": 1,
              "username": "supabot",
            },
            "username": "supabot",
          },
          Object {
            "returns_row": Object {
              "id": null,
              "username": null,
            },
            "username": "kiwicopple",
          },
          Object {
            "returns_row": Object {
              "id": null,
              "username": null,
            },
            "username": "awailas",
          },
          Object {
            "returns_row": Object {
              "id": null,
              "username": null,
            },
            "username": "jsonuser",
          },
          Object {
            "returns_row": Object {
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_setof_row_one_function_not_nullable - function returning a single row embeded table not nullable', async () => {
    const res = await postgrest
      .from('users')
      // Inner join to ensure the join result is not nullable can also be set at relation level
      // by setting isNotNullable for the function SetofOptions definition to true
      .select('username, user_called_profile_not_null:get_user_profile_non_nullable!inner(*)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "user_called_profile_not_null": Object {
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    // Can parse the data because the !inner ensure the join result from function is not nullable
    ExpectedSchema.parse(res.data)
  })

  test('embeded_setof_row_one_function_with_fields_selection - function returning a single row embeded table with fields selection', async () => {
    const res = await postgrest
      .from('users')
      .select('username, user_called_profile:get_user_profile(username)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "user_called_profile": Object {
              "username": "supabot",
            },
            "username": "supabot",
          },
          Object {
            "user_called_profile": Object {
              "username": null,
            },
            "username": "kiwicopple",
          },
          Object {
            "user_called_profile": Object {
              "username": null,
            },
            "username": "awailas",
          },
          Object {
            "user_called_profile": Object {
              "username": null,
            },
            "username": "jsonuser",
          },
          Object {
            "user_called_profile": Object {
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_setof_function_with_fields_selection_with_sub_linking - function embedded table with fields selection and sub linking', async () => {
    const res = await postgrest
      .from('channels')
      .select('id, all_channels_messages:get_messages(id,message,channels(id,slug))')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "all_channels_messages": Array [
              Object {
                "channels": Object {
                  "id": 1,
                  "slug": "public",
                },
                "id": 1,
                "message": "Hello World 👋",
              },
            ],
            "id": 1,
          },
          Object {
            "all_channels_messages": Array [
              Object {
                "channels": Object {
                  "id": 2,
                  "slug": "random",
                },
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
              },
            ],
            "id": 2,
          },
          Object {
            "all_channels_messages": Array [
              Object {
                "channels": Object {
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_with_table_row_input - function with table row input', async () => {
    const res = await postgrest.from('users').select('username, user_messages:get_user_messages(*)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "user_messages": Array [
              Object {
                "channel_id": 1,
                "data": null,
                "id": 1,
                "message": "Hello World 👋",
                "username": "supabot",
              },
              Object {
                "channel_id": 2,
                "data": null,
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
                "username": "supabot",
              },
              Object {
                "channel_id": 3,
                "data": null,
                "id": 4,
                "message": "Some message on channel wihtout details",
                "username": "supabot",
              },
            ],
            "username": "supabot",
          },
          Object {
            "user_messages": Array [],
            "username": "kiwicopple",
          },
          Object {
            "user_messages": Array [],
            "username": "awailas",
          },
          Object {
            "user_messages": Array [],
            "username": "jsonuser",
          },
          Object {
            "user_messages": Array [],
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_with_view_row_input - function with view row input', async () => {
    const res = await postgrest
      .from('active_users')
      .select('username, active_user_messages:get_active_user_messages(*)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "active_user_messages": Array [
              Object {
                "channel_id": 1,
                "data": null,
                "id": 1,
                "message": "Hello World 👋",
                "username": "supabot",
              },
              Object {
                "channel_id": 2,
                "data": null,
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
                "username": "supabot",
              },
              Object {
                "channel_id": 3,
                "data": null,
                "id": 4,
                "message": "Some message on channel wihtout details",
                "username": "supabot",
              },
            ],
            "username": "supabot",
          },
          Object {
            "active_user_messages": Array [],
            "username": "awailas",
          },
          Object {
            "active_user_messages": Array [],
            "username": "jsonuser",
          },
          Object {
            "active_user_messages": Array [],
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_returning_view - function returning view', async () => {
    const res = await postgrest
      .from('users')
      .select('username, recent_messages:get_user_recent_messages(*)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "recent_messages": Array [
              Object {
                "channel_id": 3,
                "data": null,
                "id": 4,
                "message": "Some message on channel wihtout details",
                "username": "supabot",
              },
              Object {
                "channel_id": 2,
                "data": null,
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
                "username": "supabot",
              },
              Object {
                "channel_id": 1,
                "data": null,
                "id": 1,
                "message": "Hello World 👋",
                "username": "supabot",
              },
            ],
            "username": "supabot",
          },
          Object {
            "recent_messages": Array [],
            "username": "kiwicopple",
          },
          Object {
            "recent_messages": Array [],
            "username": "awailas",
          },
          Object {
            "recent_messages": Array [],
            "username": "jsonuser",
          },
          Object {
            "recent_messages": Array [],
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_with_view_input_returning_view - function with view input returning view', async () => {
    const res = await postgrest
      .from('active_users')
      .select('username, recent_messages:get_user_recent_messages(*)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "recent_messages": Array [
              Object {
                "channel_id": 3,
                "data": null,
                "id": 4,
                "message": "Some message on channel wihtout details",
                "username": "supabot",
              },
              Object {
                "channel_id": 2,
                "data": null,
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
                "username": "supabot",
              },
              Object {
                "channel_id": 1,
                "data": null,
                "id": 1,
                "message": "Hello World 👋",
                "username": "supabot",
              },
            ],
            "username": "supabot",
          },
          Object {
            "recent_messages": Array [],
            "username": "awailas",
          },
          Object {
            "recent_messages": Array [],
            "username": "jsonuser",
          },
          Object {
            "recent_messages": Array [],
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_with_blurb_message - function with blurb_message', async () => {
    const res = await postgrest
      .from('users')
      .select('username, user_messages:get_user_messages(id,message,blurb_message)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "user_messages": Array [
              Object {
                "blurb_message": "Hel",
                "id": 1,
                "message": "Hello World 👋",
              },
              Object {
                "blurb_message": "Per",
                "id": 2,
                "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
              },
              Object {
                "blurb_message": "Som",
                "id": 4,
                "message": "Some message on channel wihtout details",
              },
            ],
            "username": "supabot",
          },
          Object {
            "user_messages": Array [],
            "username": "kiwicopple",
          },
          Object {
            "user_messages": Array [],
            "username": "awailas",
          },
          Object {
            "user_messages": Array [],
            "username": "jsonuser",
          },
          Object {
            "user_messages": Array [],
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_returning_row - Cannot embed an function that is not a setofOptions one', async () => {
    const res = await postgrest.from('channels').select('id, user:function_returning_row(*)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": null,
        "error": Object {
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
  })

  test('embeded_function_returning_single_row - can embed single row returns function with row single param', async () => {
    const res = await postgrest
      .from('messages')
      .select('id, user:function_returning_single_row(status, username)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "id": 1,
            "user": Object {
              "status": "ONLINE",
              "username": "supabot",
            },
          },
          Object {
            "id": 2,
            "user": Object {
              "status": "ONLINE",
              "username": "supabot",
            },
          },
          Object {
            "id": 4,
            "user": Object {
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('embeded_function_returning_set_of_rows - function returning set of rows', async () => {
    const res = await postgrest
      .from('messages')
      .select('id, users:function_returning_set_of_rows(*)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": null,
        "error": Object {
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
  })

  test('function_using_setof_rows_one', async () => {
    const res = await postgrest
      .from('users')
      .select('username, profile:function_using_table_returns(*)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "profile": Object {
              "id": 1,
              "username": "supabot",
            },
            "username": "supabot",
          },
          Object {
            "profile": Object {
              "id": null,
              "username": null,
            },
            "username": "kiwicopple",
          },
          Object {
            "profile": Object {
              "id": null,
              "username": null,
            },
            "username": "awailas",
          },
          Object {
            "profile": Object {
              "id": null,
              "username": null,
            },
            "username": "jsonuser",
          },
          Object {
            "profile": Object {
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })

  test('function_using_table_returns', async () => {
    const res = await postgrest
      .from('users')
      .select('username, profile:function_using_setof_rows_one(*)')
    expect(res).toMatchInlineSnapshot(`
      Object {
        "count": null,
        "data": Array [
          Object {
            "profile": Object {
              "id": 1,
              "username": "supabot",
            },
            "username": "supabot",
          },
          Object {
            "profile": null,
            "username": "kiwicopple",
          },
          Object {
            "profile": null,
            "username": "awailas",
          },
          Object {
            "profile": null,
            "username": "jsonuser",
          },
          Object {
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
    // TODO: works with latest postgrest-meta type introspection
    // expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(res.data)
  })
})
