import type { RequiredDeep } from 'type-fest'
import { z } from 'zod'
import { PostgrestClient } from '../src/index'
import { expectType, type TypeEqual } from './types'

const REST_URL = 'http://localhost:54321/rest/v1'
const postgrest = new PostgrestClient(REST_URL)

type MessagesRow = SupabaseDatabase['public']['Tables']['messages']['Row']
type UsersRow = SupabaseDatabase['public']['Tables']['users']['Row']
// the fields of the single row a function returns are nullable, whatever the table says
type FunctionRow<T> = { [K in keyof T]: T[K] | null }
// a set-returning function keeps the NOT NULL of the column a row is traced to
type FunctionSetOfUsersRow = {
  [K in keyof UsersRow]: K extends 'username' ? string : UsersRow[K] | null
}

const MessagesWithoutBlurbSchema = z.object({
  channel_id: z.number(),
  data: z.unknown().nullable(),
  id: z.number(),
  message: z.string().nullable(),
  username: z.string(),
})

const UserProfileSchema = z.object({
  id: z.number().nullable(),
  username: z.string().nullable(),
})

const UserProfileRowSchema = z.object({
  id: z.number(),
  username: z.string().nullable(),
})

const RecentMessagesSchema = z.object({
  channel_id: z.number(),
  data: z.unknown().nullable(),
  id: z.number(),
  message: z.string().nullable(),
  username: z.string(),
})

const SelectWithUsersSchema = z.object({
  channel_id: z.number(),
  message: z.string().nullable(),
  users: z
    .object({
      catchphrase: z.unknown(),
      username: z.string(),
    })
    .nullable(),
})

const SelectWithUsersProfileSchema = z.object({
  id: z.number().nullable(),
  username: z.string().nullable(),
  users: z
    .object({
      catchphrase: z.unknown(),
      username: z.string(),
    })
    .nullable(),
})

const FunctionReturningRowSchema = z.object({
  age_range: z.unknown(),
  catchphrase: z.unknown(),
  data: z.unknown(),
  status: z.enum(['ONLINE', 'OFFLINE'] as const).nullable(),
  username: z.string().nullable(),
})

const FunctionReturningSetOfRowsSchema = FunctionReturningRowSchema.extend({
  username: z.string(),
})

describe('advanced rpc', () => {
  test('function returning a setof embeded table', async () => {
    const res = await postgrest.rpc('get_messages', {
      channel_row: { id: 1, data: null, slug: null },
    })
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(MessagesWithoutBlurbSchema)
    let expected: MessagesRow[]
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 1,
            "data": null,
            "id": 1,
            "message": "Hello World 👋",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    ExpectedSchema.parse(res.data)
  })

  test('function double definition returning a setof embeded table', async () => {
    const res = await postgrest.rpc('get_messages', {
      user_row: {
        username: 'supabot',
        data: null,
        age_range: null,
        catchphrase: null,
        status: 'ONLINE',
      },
    })
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(MessagesWithoutBlurbSchema)
    let expected: MessagesRow[]
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
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
            "id": 3,
            "message": "Some message on channel without details",
            "username": "supabot",
          },
          {
            "channel_id": 3,
            "data": null,
            "id": 4,
            "message": "Some message on channel without details",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    ExpectedSchema.parse(res.data)
  })

  test('function returning a single row embeded table', async () => {
    const res = await postgrest.rpc('get_user_profile', {
      user_row: {
        username: 'supabot',
        data: null,
        age_range: null,
        catchphrase: null,
        status: 'ONLINE',
      },
    })
    let result: Exclude<typeof res.data, null>
    let expected: z.infer<typeof UserProfileSchema>
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": {
          "id": 1,
          "username": "supabot",
        },
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    UserProfileSchema.parse(res.data)
  })

  test('function with scalar input', async () => {
    const res = await postgrest.rpc('get_messages_by_username', {
      search_username: 'supabot',
    })
    // Type assertion
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(MessagesWithoutBlurbSchema)
    let expected: MessagesRow[]
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    // Runtime result
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
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
            "id": 3,
            "message": "Some message on channel without details",
            "username": "supabot",
          },
          {
            "channel_id": 3,
            "data": null,
            "id": 4,
            "message": "Some message on channel without details",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    ExpectedSchema.parse(res.data)
  })

  test('function with table row input', async () => {
    const res = await postgrest.rpc('get_user_messages', {
      user_row: {
        username: 'supabot',
        data: null,
        age_range: null,
        catchphrase: null,
        status: 'ONLINE',
      },
    })
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(MessagesWithoutBlurbSchema)
    let expected: MessagesRow[]
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
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
            "id": 3,
            "message": "Some message on channel without details",
            "username": "supabot",
          },
          {
            "channel_id": 3,
            "data": null,
            "id": 4,
            "message": "Some message on channel without details",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    ExpectedSchema.parse(res.data)
  })

  test('function with view row input', async () => {
    const res = await postgrest.rpc('get_active_user_messages', {
      active_user_row: {
        username: 'supabot',
        data: null,
        age_range: null,
        catchphrase: null,
        status: 'ONLINE',
      },
    })
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(MessagesWithoutBlurbSchema)
    let expected: MessagesRow[]
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
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
            "id": 3,
            "message": "Some message on channel without details",
            "username": "supabot",
          },
          {
            "channel_id": 3,
            "data": null,
            "id": 4,
            "message": "Some message on channel without details",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    ExpectedSchema.parse(res.data)
  })

  test('function returning view', async () => {
    const res = await postgrest.rpc('get_user_recent_messages', {
      user_row: {
        username: 'supabot',
        data: null,
        age_range: null,
        catchphrase: null,
        status: 'ONLINE',
      },
    })
    let result: Exclude<typeof res.data, null>
    let expected: MessagesRow[]
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
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
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    RecentMessagesSchema.array().parse(res.data)
  })

  test('function with scalar input returning view', async () => {
    const res = await postgrest.rpc('get_recent_messages_by_username', {
      search_username: 'supabot',
    })
    let result: Exclude<typeof res.data, null>
    let expected: MessagesRow[]
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
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
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    RecentMessagesSchema.array().parse(res.data)
  })

  test('function with scalar input with followup select', async () => {
    const res = await postgrest
      .rpc('get_recent_messages_by_username', {
        search_username: 'supabot',
      })
      .select('channel_id, message, users(username, catchphrase)')
    let result: Exclude<typeof res.data, null>
    let expected: RequiredDeep<z.infer<typeof SelectWithUsersSchema>>[]
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 3,
            "message": "Some message on channel without details",
            "users": {
              "catchphrase": "'cat' 'fat'",
              "username": "supabot",
            },
          },
          {
            "channel_id": 3,
            "message": "Some message on channel without details",
            "users": {
              "catchphrase": "'cat' 'fat'",
              "username": "supabot",
            },
          },
          {
            "channel_id": 2,
            "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
            "users": {
              "catchphrase": "'cat' 'fat'",
              "username": "supabot",
            },
          },
          {
            "channel_id": 1,
            "message": "Hello World 👋",
            "users": {
              "catchphrase": "'cat' 'fat'",
              "username": "supabot",
            },
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    SelectWithUsersSchema.array().parse(res.data)
  })

  test('function with row input with followup select', async () => {
    const res = await postgrest
      .rpc('get_user_profile', {
        user_row: {
          username: 'supabot',
          data: null,
          age_range: null,
          catchphrase: null,
          status: 'ONLINE',
        },
      })
      .select('id, username, users(username, catchphrase)')
    let result: Exclude<typeof res.data, null>
    let expected: RequiredDeep<z.infer<typeof SelectWithUsersProfileSchema>>
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": {
          "id": 1,
          "username": "supabot",
          "users": {
            "catchphrase": "'cat' 'fat'",
            "username": "supabot",
          },
        },
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    SelectWithUsersProfileSchema.parse(res.data)
  })

  test('unresolvable function with no params', async () => {
    const res = await postgrest.rpc('postgrest_unresolvable_function')
    // a `void` function is typed `null`: a known mapper limit (PostgREST answers 204 with no body)
    expectType<TypeEqual<typeof res.data, null>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": null,
        "error": null,
        "status": 204,
        "statusText": "No Content",
        "success": true,
      }
    `)
  })

  test('unresolvable function with text param', async () => {
    // @ts-expect-error PGRST203
    const res = await postgrest.rpc('postgrest_unresolvable_function', {
      a: 'test',
    })
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": null,
        "error": {
          "code": "PGRST203",
          "details": null,
          "hint": "Try renaming the parameters or the function itself in the database so function overloading can be resolved",
          "message": "Could not choose the best candidate function between: public.postgrest_unresolvable_function(a => integer), public.postgrest_unresolvable_function(a => text)",
        },
        "status": 300,
        "statusText": "Multiple Choices",
        "success": false,
      }
    `)
  })

  test('unresolvable function with int param', async () => {
    // @ts-expect-error PGRST203
    const res = await postgrest.rpc('postgrest_unresolvable_function', {
      a: 1,
    })
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": null,
        "error": {
          "code": "PGRST203",
          "details": null,
          "hint": "Try renaming the parameters or the function itself in the database so function overloading can be resolved",
          "message": "Could not choose the best candidate function between: public.postgrest_unresolvable_function(a => integer), public.postgrest_unresolvable_function(a => text)",
        },
        "status": 300,
        "statusText": "Multiple Choices",
        "success": false,
      }
    `)
  })

  test('resolvable function with no params', async () => {
    const res = await postgrest.rpc('postgrest_resolvable_with_override_function')
    // a `void` function is typed `null`: a known mapper limit (PostgREST answers 204 with no body)
    expectType<TypeEqual<typeof res.data, null>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": null,
        "error": null,
        "status": 204,
        "statusText": "No Content",
        "success": true,
      }
    `)
  })

  test('resolvable function with text param', async () => {
    const res = await postgrest.rpc('postgrest_resolvable_with_override_function', {
      a: 'test',
    })
    let result: Exclude<typeof res.data, null>
    let expected: number
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": 1,
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
  })

  test('resolvable function with int param', async () => {
    const res = await postgrest.rpc('postgrest_resolvable_with_override_function', {
      b: 1,
    })
    let result: Exclude<typeof res.data, null>
    let expected: string
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": "foo",
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
  })

  test('resolvable function with profile_id param', async () => {
    const res = await postgrest.rpc('postgrest_resolvable_with_override_function', {
      profile_id: 1,
    })
    let result: Exclude<typeof res.data, null>
    let expected: z.infer<typeof UserProfileRowSchema>[]
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "id": 1,
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    UserProfileRowSchema.array().parse(res.data)
  })

  test('resolvable function with channel_id and search params', async () => {
    const res = await postgrest.rpc('postgrest_resolvable_with_override_function', {
      cid: 1,
      search: 'Hello World 👋',
    })
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(MessagesWithoutBlurbSchema)
    let expected: MessagesRow[]
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 1,
            "data": null,
            "id": 1,
            "message": "Hello World 👋",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    ExpectedSchema.parse(res.data)
  })

  test('resolvable function with user_row param', async () => {
    const res = await postgrest.rpc('postgrest_resolvable_with_override_function', {
      user_row: {
        username: 'supabot',
        data: null,
        age_range: null,
        catchphrase: null,
        status: 'ONLINE',
      },
    })
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(MessagesWithoutBlurbSchema)
    let expected: MessagesRow[]
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
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
            "id": 3,
            "message": "Some message on channel without details",
            "username": "supabot",
          },
          {
            "channel_id": 3,
            "data": null,
            "id": 4,
            "message": "Some message on channel without details",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    ExpectedSchema.parse(res.data)
  })

  test('polymorphic function with text param', async () => {
    const res = await postgrest.rpc('polymorphic_function_with_different_return', {
      '': 'test',
    })
    let result: Exclude<typeof res.data, null>
    let expected: string
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": "foo",
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
  })

  test('polymorphic function with bool param', async () => {
    // @ts-expect-error Type 'boolean' is not assignable to type 'string': only the text overload is callable
    const res = await postgrest.rpc('polymorphic_function_with_different_return', {
      '': true,
    })
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": "foo",
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
  })

  test('polymorphic function with unnamed int param', async () => {
    const res = await postgrest.rpc(
      // @ts-expect-error PGRST202: a single unnamed integer parameter is not callable
      'polymorphic_function_with_unnamed_integer',
      {
        '': 1,
      }
    )
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": null,
        "error": {
          "code": "PGRST202",
          "details": "Searched for the function public.polymorphic_function_with_unnamed_integer with parameter  or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.",
          "hint": "Perhaps you meant to call the function public.polymorphic_function_with_unnamed_text",
          "message": "Could not find the function public.polymorphic_function_with_unnamed_integer() in the schema cache",
        },
        "status": 404,
        "statusText": "Not Found",
        "success": false,
      }
    `)
  })

  test('polymorphic function with unnamed json param', async () => {
    const res = await postgrest.rpc('polymorphic_function_with_unnamed_json', {
      '': { test: 'value' },
    })
    let result: Exclude<typeof res.data, null>
    let expected: number
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": 1,
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
  })

  test('polymorphic function with unnamed jsonb param', async () => {
    const res = await postgrest.rpc('polymorphic_function_with_unnamed_jsonb', {
      '': { test: 'value' },
    })
    let result: Exclude<typeof res.data, null>
    let expected: number
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": 1,
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
  })

  test('polymorphic function with unnamed text param', async () => {
    const res = await postgrest.rpc('polymorphic_function_with_unnamed_text', {
      '': 'test',
    })
    let result: Exclude<typeof res.data, null>
    let expected: number
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": 1,
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
  })

  test('polymorphic function with no params and unnamed params definition call with no params', async () => {
    const res = await postgrest.rpc('polymorphic_function_with_no_params_or_unnamed')
    let result: Exclude<typeof res.data, null>
    let expected: number
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": 1,
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
  })

  test('polymorphic function with unnamed params definition call with string param', async () => {
    const res = await postgrest.rpc('polymorphic_function_with_no_params_or_unnamed', {
      '': '',
    })
    let result: Exclude<typeof res.data, null>
    let expected: string
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": "foo",
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
  })

  test('polymorphic function with unnamed params definition call with text param', async () => {
    const res = await postgrest.rpc('polymorphic_function_with_no_params_or_unnamed', {
      '': 'test',
    })
    let result: Exclude<typeof res.data, null>
    let expected: string
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": "foo",
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
  })

  test('polymorphic function with unnamed default no params', async () => {
    // @ts-expect-error PGRST203
    const res = await postgrest.rpc('polymorphic_function_with_unnamed_default')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": null,
        "error": {
          "code": "PGRST203",
          "details": null,
          "hint": "Try renaming the parameters or the function itself in the database so function overloading can be resolved",
          "message": "Could not choose the best candidate function between: public.polymorphic_function_with_unnamed_default(), public.polymorphic_function_with_unnamed_default( => text)",
        },
        "status": 300,
        "statusText": "Multiple Choices",
        "success": false,
      }
    `)
  })

  test('polymorphic function with unnamed default param undefined', async () => {
    // @ts-expect-error PGRST203
    const res = await postgrest.rpc('polymorphic_function_with_unnamed_default', {})
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": null,
        "error": {
          "code": "PGRST203",
          "details": null,
          "hint": "Try renaming the parameters or the function itself in the database so function overloading can be resolved",
          "message": "Could not choose the best candidate function between: public.polymorphic_function_with_unnamed_default(), public.polymorphic_function_with_unnamed_default( => text)",
        },
        "status": 300,
        "statusText": "Multiple Choices",
        "success": false,
      }
    `)
  })

  test('polymorphic function with unnamed default text param', async () => {
    const res = await postgrest.rpc('polymorphic_function_with_unnamed_default', {
      '': 'custom text',
    })
    let result: Exclude<typeof res.data, null>
    let expected: string
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": "foo",
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
  })

  test('polymorphic function with unnamed default overload no params', async () => {
    // @ts-expect-error PGRST203
    const res = await postgrest.rpc('polymorphic_function_with_unnamed_default_overload')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": null,
        "error": {
          "code": "PGRST203",
          "details": null,
          "hint": "Try renaming the parameters or the function itself in the database so function overloading can be resolved",
          "message": "Could not choose the best candidate function between: public.polymorphic_function_with_unnamed_default_overload(), public.polymorphic_function_with_unnamed_default_overload( => text)",
        },
        "status": 300,
        "statusText": "Multiple Choices",
        "success": false,
      }
    `)
  })

  test('polymorphic function with unnamed default overload int param', async () => {
    // @ts-expect-error PGRST203
    const res = await postgrest.rpc('polymorphic_function_with_unnamed_default_overload', undefined)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": null,
        "error": {
          "code": "PGRST203",
          "details": null,
          "hint": "Try renaming the parameters or the function itself in the database so function overloading can be resolved",
          "message": "Could not choose the best candidate function between: public.polymorphic_function_with_unnamed_default_overload(), public.polymorphic_function_with_unnamed_default_overload( => text)",
        },
        "status": 300,
        "statusText": "Multiple Choices",
        "success": false,
      }
    `)
  })

  test('polymorphic function with unnamed default overload text param', async () => {
    const res = await postgrest.rpc('polymorphic_function_with_unnamed_default_overload', {
      '': 'custom text',
    })
    let result: Exclude<typeof res.data, null>
    let expected: string
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": "foo",
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
  })

  test('polymorphic function with unnamed default overload bool param', async () => {
    // @ts-expect-error Type 'boolean' is not assignable to type 'string': the bool overload is not callable
    const res = await postgrest.rpc('polymorphic_function_with_unnamed_default_overload', {
      '': true,
    })
    let result: Exclude<typeof res.data, null>
    let expected: string
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": "foo",
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
  })

  test('function with blurb_message', async () => {
    // @ts-expect-error PGRST202
    const res = await postgrest.rpc('blurb_message')
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": null,
        "error": {
          "code": "PGRST202",
          "details": "Searched for the function public.blurb_message without parameters or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.",
          "hint": null,
          "message": "Could not find the function public.blurb_message without parameters in the schema cache",
        },
        "status": 404,
        "statusText": "Not Found",
        "success": false,
      }
    `)
  })

  test('function with blurb_message with params', async () => {
    // @ts-expect-error PGRST202
    const res = await postgrest.rpc('blurb_message', {
      '': {
        channel_id: 1,
        data: null,
        id: 1,
        message: null,
        username: 'test',
        blurb_message: null,
        function_returning_single_row: null,
      },
    })
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": null,
        "error": {
          "code": "PGRST202",
          "details": "Searched for the function public.blurb_message with parameter  or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.",
          "hint": null,
          "message": "Could not find the function public.blurb_message() in the schema cache",
        },
        "status": 404,
        "statusText": "Not Found",
        "success": false,
      }
    `)
  })

  test('function returning row', async () => {
    const res = await postgrest.rpc('function_returning_row')
    let result: Exclude<typeof res.data, null>
    let expected: FunctionRow<UsersRow>
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": {
          "age_range": "[1,2)",
          "catchphrase": "'cat' 'fat'",
          "data": null,
          "status": "ONLINE",
          "username": "supabot",
        },
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    FunctionReturningRowSchema.parse(res.data)
  })

  test('function returning set of rows', async () => {
    const res = await postgrest.rpc('function_returning_set_of_rows')
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(FunctionReturningSetOfRowsSchema)
    let expected: FunctionSetOfUsersRow[]
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "age_range": "[1,2)",
            "catchphrase": "'cat' 'fat'",
            "data": null,
            "status": "ONLINE",
            "username": "supabot",
          },
          {
            "age_range": "[25,35)",
            "catchphrase": "'bat' 'cat'",
            "data": null,
            "status": "OFFLINE",
            "username": "kiwicopple",
          },
          {
            "age_range": "[25,35)",
            "catchphrase": "'bat' 'rat'",
            "data": null,
            "status": "ONLINE",
            "username": "awailas",
          },
          {
            "age_range": "[20,30)",
            "catchphrase": "'fat' 'rat'",
            "data": null,
            "status": "ONLINE",
            "username": "dragarcia",
          },
          {
            "age_range": "[20,30)",
            "catchphrase": "'json' 'test'",
            "data": {
              "foo": {
                "bar": {
                  "nested": "value",
                },
                "baz": "string value",
              },
            },
            "status": "ONLINE",
            "username": "jsonuser",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    ExpectedSchema.parse(res.data)
  })

  test('function_using_setof_rows_one', async () => {
    const res = await postgrest.rpc('function_using_setof_rows_one', {
      user_row: {
        username: 'supabot',
        data: null,
        age_range: null,
        catchphrase: null,
        status: 'ONLINE',
      },
    })
    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.array(UserProfileRowSchema)
    let expected: z.infer<typeof ExpectedSchema>
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "id": 1,
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    ExpectedSchema.parse(res.data)
  })

  test('function_using_table_returns', async () => {
    const res = await postgrest.rpc('function_using_table_returns', {
      user_row: {
        username: 'supabot',
        data: null,
        age_range: null,
        catchphrase: null,
        status: 'ONLINE',
      },
    })
    let result: Exclude<typeof res.data, null>
    let expected: z.infer<typeof UserProfileSchema>
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": {
          "id": 1,
          "username": "supabot",
        },
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    UserProfileSchema.parse(res.data)
  })
})

test('should be able to filter before and after select rpc', async () => {
  const res = await postgrest
    // @ts-expect-error user_row is missing the other columns of a users row
    .rpc('get_user_profile', {
      user_row: { username: 'supabot' },
    })
    .select('id, username, users(username, catchphrase)')
    .eq('username', 'nope')

  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": null,
      "status": 200,
      "statusText": "OK",
      "success": true,
    }
  `)
  const res2 = await postgrest
    // @ts-expect-error user_row is missing the other columns of a users row
    .rpc('get_user_profile', {
      user_row: { username: 'supabot' },
    })
    // should also be able to fitler before the select
    .eq('username', 'nope')
    .select('id, username, users(username, catchphrase)')

  expect(res2).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": null,
      "status": 200,
      "statusText": "OK",
      "success": true,
    }
  `)
  const res3 = await postgrest
    // @ts-expect-error user_row is missing the other columns of a users row
    .rpc('get_user_profile', {
      user_row: { username: 'supabot' },
    })
    // should also be able to fitler before the select
    .eq('username', 'supabot')
    .select('username, users(username, catchphrase)')

  expect(res3).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "username": "supabot",
        "users": {
          "catchphrase": "'cat' 'fat'",
          "username": "supabot",
        },
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
      "success": true,
    }
  `)
})

test('RPC call with subselect and computed field', async () => {
  const res = await postgrest
    .rpc('get_messages_by_username', { search_username: 'supabot' })
    // should be able to select computed field
    .select('message, blurb_message')
  // .limit(1)
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "blurb_message": "Hel",
          "message": "Hello World 👋",
        },
        {
          "blurb_message": "Per",
          "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
        },
        {
          "blurb_message": "Som",
          "message": "Some message on channel without details",
        },
        {
          "blurb_message": "Som",
          "message": "Some message on channel without details",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
      "success": true,
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.array(
    z.object({
      message: z.string().nullable(),
      blurb_message: z.string().nullable(),
    })
  )
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})
