import { PostgrestClient } from '../src/index'
import { CustomUserDataTypeSchema, Database } from './types.override'
import { expectType, TypeEqual } from './types'
import { z } from 'zod'
import { Json } from '../src/select-query-parser/types'
import { RequiredDeep } from 'type-fest'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient<Database>(REST_URL)

const UsersRowSchema = z.object({
  age_range: z.unknown().nullable(),
  catchphrase: z.unknown().nullable(),
  data: CustomUserDataTypeSchema.nullable(),
  status: z.enum(['ONLINE', 'OFFLINE'] as const).nullable(),
  username: z.string(),
})

const ChannelDetailsRowSchema = z.object({
  details: z.string().nullable(),
  id: z.number(),
})

test('nested query with selective fields', async () => {
  const res = await postgrest
    .from('users')
    .select('username, messages(id, message)')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "messages": [
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
        id: z.number(),
        message: z.string().nullable(),
      })
    ),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('nested query with multiple levels and selective fields', async () => {
  const res = await postgrest
    .from('users')
    .select('username, messages(id, message, channels(id, slug))')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "messages": [
          {
            "channels": {
              "id": 1,
              "slug": "public",
            },
            "id": 1,
            "message": "Hello World 👋",
          },
          {
            "channels": {
              "id": 2,
              "slug": "random",
            },
            "id": 2,
            "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
          },
          {
            "channels": {
              "id": 3,
              "slug": "other",
            },
            "id": 4,
            "message": "Some message on channel wihtout details",
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
        id: z.number(),
        message: z.string().nullable(),
        channels: z.object({
          id: z.number(),
          slug: z.string().nullable(),
        }),
      })
    ),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('query with multiple one-to-many relationships', async () => {
  const res = await postgrest
    .from('users')
    .select('username, messages(id), user_profiles(id)')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "messages": [
          {
            "id": 1,
          },
          {
            "id": 2,
          },
          {
            "id": 4,
          },
        ],
        "user_profiles": [
          {
            "id": 1,
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
    messages: z.array(z.object({ id: z.number() })),
    user_profiles: z.array(z.object({ id: z.number() })),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('many-to-one relationship', async () => {
  const res = await postgrest.from('messages').select('user:users(*)').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "user": {
          "age_range": "[1,2)",
          "catchphrase": "'cat' 'fat'",
          "data": null,
          "status": "ONLINE",
          "username": "supabot",
        },
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    user: UsersRowSchema,
  })
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('one-to-many relationship', async () => {
  const res = await postgrest.from('users').select('messages(*)').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
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
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
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
  // TODO: older versions of zod require this trick for non optional unknown data type
  // newer version of zod don't have this issue but require an upgrade of typescript minimal version
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('one-to-many relationship with selective columns', async () => {
  const res = await postgrest.from('users').select('messages(data)').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "messages": [
          {
            "data": null,
          },
          {
            "data": null,
          },
          {
            "data": null,
          },
        ],
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    messages: z.array(z.object({ data: z.unknown().nullable() })),
  })
  // TODO: older versions of zod require this trick for non optional unknown data type
  // newer version of zod don't have this issue but require an upgrade of typescript minimal version
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('one-to-one relationship', async () => {
  const res = await postgrest.from('channels').select('channel_details(*)').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "channel_details": {
          "details": "Details for public channel",
          "id": 1,
        },
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    channel_details: ChannelDetailsRowSchema.nullable(),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('select with type casting query', async () => {
  const res = await postgrest.from('best_friends').select('id::text').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "id": "1",
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({ id: z.string() })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('multiple times the same column in selection', async () => {
  const res = await postgrest.from('channels').select('id, id, id').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "id": 1,
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({ id: z.number() })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('embed resource with no fields', async () => {
  const res = await postgrest.from('messages').select('message, users()').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "message": "Hello World 👋",
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({ message: z.string().nullable() })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('select JSON accessor', async () => {
  const res = await postgrest
    .from('users')
    .select('data->foo->bar, data->foo->>baz')
    .limit(1)
    .filter('username', 'eq', 'jsonuser')
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "bar": {
          "nested": "value",
        },
        "baz": "string value",
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    bar: z.unknown(),
    baz: z.string(),
  })
  // Cannot have a zod schema that match the Json type
  // TODO: refactor the Json type to be unknown
  let expected: {
    bar: Json
    baz: string
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('self reference relation', async () => {
  const res = await postgrest.from('collections').select('*, collections(*)').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "collections": [
          {
            "description": "Child of Root",
            "id": 2,
            "parent_id": 1,
          },
          {
            "description": "Another Child of Root",
            "id": 3,
            "parent_id": 1,
          },
        ],
        "description": "Root Collection",
        "id": 1,
        "parent_id": null,
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    id: z.number(),
    description: z.string().nullable(),
    parent_id: z.number().nullable(),
    collections: z.array(
      z.object({
        description: z.string().nullable(),
        id: z.number(),
        parent_id: z.number().nullable(),
      })
    ),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('self reference relation via column', async () => {
  const res = await postgrest
    .from('collections')
    .select('*, parent_id(*)')
    .eq('id', 2)
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "description": "Child of Root",
        "id": 2,
        "parent_id": {
          "description": "Root Collection",
          "id": 1,
          "parent_id": null,
        },
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    description: z.string().nullable(),
    id: z.number(),
    parent_id: z
      .object({
        description: z.string().nullable(),
        id: z.number(),
        parent_id: z.number().nullable(),
      })
      .nullable(),
  })
  let expected: z.infer<typeof ExpectedSchema>
  // TODO: fix this type, property merging override give invalid intersection types
  // See: result.ts#ProcessNodes comment for more details
  let crippledExpected: {
    description: (typeof expected)['description']
    id: (typeof expected)['id']
    parent_id: (number & (typeof expected)['parent_id']) | null
  }
  expectType<TypeEqual<typeof result, typeof crippledExpected>>(true)
  ExpectedSchema.parse(res.data)
})

test('many-to-many with join table', async () => {
  const res = await postgrest.from('products').select('*, categories(*)').eq('id', 1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "categories": [
          {
            "description": "Electronic devices and gadgets",
            "id": 1,
            "name": "Electronics",
          },
          {
            "description": "Computer and computer accessories",
            "id": 2,
            "name": "Computers",
          },
        ],
        "description": "High-performance laptop",
        "id": 1,
        "name": "Laptop",
        "price": 999.99,
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable(),
    price: z.number(),
    categories: z.array(
      z.object({
        description: z.string().nullable(),
        id: z.number(),
        name: z.string(),
      })
    ),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})
