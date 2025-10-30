import { PostgrestClient } from '../src/index'
import { Database, CustomUserDataTypeSchema } from './types.override'
import { expectType, TypeEqual } from './types'
import { z } from 'zod'
import { RequiredDeep } from 'type-fest'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient<Database>(REST_URL)
const userColumn: 'catchphrase' | 'username' = 'username'

// Zod schemas for common types
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

const ChannelsRowSchema = z.object({
  data: z.unknown().nullable(),
  id: z.number(),
  slug: z.string().nullable(),
})

const MessagesRowSchema = z.object({
  channel_id: z.number(),
  data: z.unknown().nullable(),
  id: z.number(),
  message: z.string().nullable(),
  username: z.string(),
})

const BestFriendsRowSchema = z.object({
  first_user: z.string(),
  id: z.number(),
  second_user: z.string(),
  third_wheel: z.string().nullable(),
})

test('!inner relationship', async () => {
  const res = await postgrest
    .from('messages')
    .select('channels!inner(*, channel_details!inner(*))')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "channels": {
          "channel_details": {
            "details": "Details for public channel",
            "id": 1,
          },
          "data": null,
          "id": 1,
          "slug": "public",
        },
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)

  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    channels: ChannelsRowSchema.extend({
      channel_details: ChannelDetailsRowSchema,
    }),
  })
  // TODO: older versions of zod require this trick for non optional unknown data type
  // newer version of zod don't have this issue but require an upgrade of typescript minimal version
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('!inner relationship on nullable relation', async () => {
  const res = await postgrest.from('booking').select('id, hotel!inner(id, name)')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "hotel": {
            "id": 1,
            "name": "Sunset Resort",
          },
          "id": 1,
        },
        {
          "hotel": {
            "id": 1,
            "name": "Sunset Resort",
          },
          "id": 2,
        },
        {
          "hotel": {
            "id": 2,
            "name": "Mountain View Hotel",
          },
          "id": 3,
        },
        {
          "hotel": {
            "id": 3,
            "name": "Beachfront Inn",
          },
          "id": 5,
        },
        {
          "hotel": {
            "id": 1,
            "name": "Sunset Resort",
          },
          "id": 6,
        },
        {
          "hotel": {
            "id": 4,
            "name": null,
          },
          "id": 8,
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
      hotel: z.object({
        id: z.number(),
        name: z.string().nullable(),
      }),
    })
  )
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('!left oneToOne', async () => {
  const res = await postgrest.from('channel_details').select('channels!left(*)').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "channels": {
          "data": null,
          "id": 1,
          "slug": "public",
        },
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    channels: ChannelsRowSchema,
  })

  // TODO: older versions of zod require this trick for non optional unknown data type
  // newer version of zod don't have this issue but require an upgrade of typescript minimal version
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('!left oneToMany', async () => {
  const res = await postgrest.from('users').select('messages!left(*)').limit(1).single()
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
    messages: z.array(MessagesRowSchema),
  })
  // TODO: older versions of zod require this trick for non optional unknown data type
  // newer version of zod don't have this issue but require an upgrade of typescript minimal version
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('!left zeroToOne', async () => {
  const res = await postgrest.from('user_profiles').select('users!left(*)').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "users": {
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

  const ExpectedSchema = z.object({
    users: UsersRowSchema.nullable(),
  })

  let result: Exclude<typeof res.data, null>
  // TODO: older versions of zod require this trick for non optional unknown data type
  // newer version of zod don't have this issue but require an upgrade of typescript minimal version
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('join over a 1-1 relation with both nullables and non-nullables fields using foreign key name for hinting', async () => {
  const res = await postgrest
    .from('best_friends')
    .select(
      'first_user:users!best_friends_first_user_fkey(*), second_user:users!best_friends_second_user_fkey(*), third_wheel:users!best_friends_third_wheel_fkey(*)'
    )
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "first_user": {
          "age_range": "[1,2)",
          "catchphrase": "'cat' 'fat'",
          "data": null,
          "status": "ONLINE",
          "username": "supabot",
        },
        "second_user": {
          "age_range": "[25,35)",
          "catchphrase": "'bat' 'cat'",
          "data": null,
          "status": "OFFLINE",
          "username": "kiwicopple",
        },
        "third_wheel": {
          "age_range": "[25,35)",
          "catchphrase": "'bat' 'rat'",
          "data": null,
          "status": "ONLINE",
          "username": "awailas",
        },
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)

  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    first_user: UsersRowSchema,
    second_user: UsersRowSchema,
    third_wheel: UsersRowSchema.nullable(),
  })
  // TODO: older versions of zod require this trick for non optional unknown data type
  // newer version of zod don't have this issue but require an upgrade of typescript minimal version
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('join over a 1-M relation with both nullables and non-nullables fields using foreign key name for hinting', async () => {
  const res = await postgrest
    .from('users')
    .select(
      `first_friend_of:best_friends!best_friends_first_user_fkey(*),
        second_friend_of:best_friends!best_friends_second_user_fkey(*),
        third_wheel_of:best_friends!best_friends_third_wheel_fkey(*)`
    )
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "first_friend_of": [
          {
            "first_user": "supabot",
            "id": 1,
            "second_user": "kiwicopple",
            "third_wheel": "awailas",
          },
          {
            "first_user": "supabot",
            "id": 2,
            "second_user": "awailas",
            "third_wheel": null,
          },
        ],
        "second_friend_of": [],
        "third_wheel_of": [],
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)

  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    first_friend_of: z.array(BestFriendsRowSchema),
    second_friend_of: z.array(BestFriendsRowSchema),
    third_wheel_of: z.array(BestFriendsRowSchema),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('join on 1-M relation', async () => {
  const res = await postgrest
    .from('users')
    .select(
      `first_friend_of:best_friends_first_user_fkey(*),
        second_friend_of:best_friends_second_user_fkey(*),
        third_wheel_of:best_friends_third_wheel_fkey(*)`
    )
    .eq('username', 'supabot')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "first_friend_of": [
          {
            "first_user": "supabot",
            "id": 1,
            "second_user": "kiwicopple",
            "third_wheel": "awailas",
          },
          {
            "first_user": "supabot",
            "id": 2,
            "second_user": "awailas",
            "third_wheel": null,
          },
        ],
        "second_friend_of": [],
        "third_wheel_of": [],
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)

  let result: Exclude<typeof res.data, null>
  let expected: z.infer<typeof ExpectedSchema>
  const ExpectedSchema = z.object({
    first_friend_of: z.array(BestFriendsRowSchema),
    second_friend_of: z.array(BestFriendsRowSchema),
    third_wheel_of: z.array(BestFriendsRowSchema),
  })
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('join on 1-1 relation with nullables', async () => {
  const res = await postgrest
    .from('best_friends')
    .select(
      'first_user:users!best_friends_first_user_fkey(*), second_user:users!best_friends_second_user_fkey(*), third_wheel:users!best_friends_third_wheel_fkey(*)'
    )
    .order('id')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "first_user": {
          "age_range": "[1,2)",
          "catchphrase": "'cat' 'fat'",
          "data": null,
          "status": "ONLINE",
          "username": "supabot",
        },
        "second_user": {
          "age_range": "[25,35)",
          "catchphrase": "'bat' 'cat'",
          "data": null,
          "status": "OFFLINE",
          "username": "kiwicopple",
        },
        "third_wheel": {
          "age_range": "[25,35)",
          "catchphrase": "'bat' 'rat'",
          "data": null,
          "status": "ONLINE",
          "username": "awailas",
        },
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)

  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    first_user: UsersRowSchema,
    second_user: UsersRowSchema,
    third_wheel: UsersRowSchema.nullable(),
  })
  // TODO: older versions of zod require this trick for non optional unknown data type
  // newer version of zod don't have this issue but require an upgrade of typescript minimal version
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('join over a 1-1 relation with both nullablesand non-nullables fields with column name hinting', async () => {
  const res = await postgrest
    .from('best_friends')
    .select(
      'first_user:users!first_user(*), second_user:users!second_user(*), third_wheel:users!third_wheel(*)'
    )
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "first_user": {
          "age_range": "[1,2)",
          "catchphrase": "'cat' 'fat'",
          "data": null,
          "status": "ONLINE",
          "username": "supabot",
        },
        "second_user": {
          "age_range": "[25,35)",
          "catchphrase": "'bat' 'cat'",
          "data": null,
          "status": "OFFLINE",
          "username": "kiwicopple",
        },
        "third_wheel": {
          "age_range": "[25,35)",
          "catchphrase": "'bat' 'rat'",
          "data": null,
          "status": "ONLINE",
          "username": "awailas",
        },
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)

  const ExpectedSchema = z.object({
    first_user: UsersRowSchema,
    second_user: UsersRowSchema,
    third_wheel: UsersRowSchema.nullable(),
  })

  let result: Exclude<typeof res.data, null>
  // TODO: older versions of zod require this trick for non optional unknown data type
  // newer version of zod don't have this issue but require an upgrade of typescript minimal version
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('join over a 1-M relation with both nullables and non-nullables fields using column name for hinting', async () => {
  const res = await postgrest
    .from('users')
    .select(
      'first_friend_of:best_friends!first_user(*), second_friend_of:best_friends!second_user(*), third_wheel_of:best_friends!third_wheel(*)'
    )
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "first_friend_of": [
          {
            "first_user": "supabot",
            "id": 1,
            "second_user": "kiwicopple",
            "third_wheel": "awailas",
          },
          {
            "first_user": "supabot",
            "id": 2,
            "second_user": "awailas",
            "third_wheel": null,
          },
        ],
        "second_friend_of": [],
        "third_wheel_of": [],
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)

  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    first_friend_of: z.array(BestFriendsRowSchema),
    second_friend_of: z.array(BestFriendsRowSchema),
    third_wheel_of: z.array(BestFriendsRowSchema),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('join over a 1-M relation with both nullables and non-nullables fields using column name hinting on nested relation', async () => {
  const res = await postgrest
    .from('users')
    .select(
      'first_friend_of:best_friends!first_user(*, first_user:users!first_user(*)), second_friend_of:best_friends!second_user(*), third_wheel_of:best_friends!third_wheel(*)'
    )
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "first_friend_of": [
          {
            "first_user": {
              "age_range": "[1,2)",
              "catchphrase": "'cat' 'fat'",
              "data": null,
              "status": "ONLINE",
              "username": "supabot",
            },
            "id": 1,
            "second_user": "kiwicopple",
            "third_wheel": "awailas",
          },
          {
            "first_user": {
              "age_range": "[1,2)",
              "catchphrase": "'cat' 'fat'",
              "data": null,
              "status": "ONLINE",
              "username": "supabot",
            },
            "id": 2,
            "second_user": "awailas",
            "third_wheel": null,
          },
        ],
        "second_friend_of": [],
        "third_wheel_of": [],
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)

  const ExpectedSchema = z.object({
    first_friend_of: z.array(
      BestFriendsRowSchema.extend({
        first_user: UsersRowSchema,
      })
    ),
    second_friend_of: z.array(BestFriendsRowSchema),
    third_wheel_of: z.array(BestFriendsRowSchema),
  })

  let result: Exclude<typeof res.data, null>
  // TODO: older versions of zod require this trick for non optional unknown data type
  // newer version of zod don't have this issue but require an upgrade of typescript minimal version
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  // TODO: fix this type, property merging override give invalid intersection types
  // See: result.ts#ProcessNodes comment for more details
  let crippledExpected: {
    first_friend_of: {
      id: (typeof expected)['first_friend_of'][number]['id']
      second_user: (typeof expected)['first_friend_of'][number]['second_user']
      third_wheel: (typeof expected)['first_friend_of'][number]['third_wheel']
      // This intersection shouldn't exist
      first_user: string & (typeof expected)['first_friend_of'][number]['first_user']
    }[]
    second_friend_of: (typeof expected)['second_friend_of']
    third_wheel_of: (typeof expected)['third_wheel_of']
  }
  expectType<TypeEqual<typeof result, typeof crippledExpected>>(true)
  ExpectedSchema.parse(res.data)
})

test('!left join on one to 0-1 non-empty relation', async () => {
  const res = await postgrest
    .from('users')
    .select('user_profiles!left(username)')
    .eq('username', 'supabot')
    .limit(1)
    .single()
  expect(Array.isArray(res.data?.user_profiles)).toBe(true)
  expect(res.data?.user_profiles[0].username).not.toBeNull()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "user_profiles": [
          {
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
    user_profiles: z.array(z.object({ username: z.string().nullable() })),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('join on one to 0-1 non-empty relation via column name', async () => {
  const res = await postgrest
    .from('users')
    .select('user_profiles(username)')
    .eq('username', 'supabot')
    .limit(1)
    .single()
  expect(res.error).toBeNull()
  expect(Array.isArray(res.data?.user_profiles)).toBe(true)
  expect(res.data?.user_profiles[0].username).not.toBeNull()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "user_profiles": [
          {
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
    user_profiles: z.array(z.object({ username: z.string().nullable() })),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('!left join on zero to one with null relation', async () => {
  const res = await postgrest
    .from('user_profiles')
    .select('*,users!left(*)')
    .eq('id', 2)
    .limit(1)
    .single()
  expect(Array.isArray(res.data?.users)).toBe(false)
  expect(res.data?.users).toBeNull()

  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "id": 2,
        "username": null,
        "users": null,
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)

  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    id: z.number(),
    username: z.string().nullable(),
    users: UsersRowSchema.nullable(),
  })
  // TODO: older versions of zod require this trick for non optional unknown data type
  // newer version of zod don't have this issue but require an upgrade of typescript minimal version
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('!left join on zero to one with valid relation', async () => {
  const res = await postgrest
    .from('user_profiles')
    .select('*,users!left(status)')
    .eq('id', 1)
    .limit(1)
    .single()
  expect(Array.isArray(res.data?.users)).toBe(false)
  // TODO: This should be nullable indeed
  expect(res.data?.users?.status).not.toBeNull()

  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "id": 1,
        "username": "supabot",
        "users": {
          "status": "ONLINE",
        },
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)

  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    id: z.number(),
    username: z.string().nullable(),
    users: z.object({ status: z.enum(['ONLINE', 'OFFLINE'] as const).nullable() }).nullable(),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('!left join on zero to one empty relation', async () => {
  const res = await postgrest
    .from('users')
    .select('user_profiles!left(username)')
    .eq('username', 'dragarcia')
    .limit(1)
    .single()
  expect(res.data).toMatchInlineSnapshot(`
    {
      "user_profiles": [],
    }
  `)

  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    user_profiles: z.array(z.object({ username: z.string().nullable() })),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('join on 1-M relation with selective fk hinting', async () => {
  const res = await postgrest
    .from('users')
    .select(
      `first_friend_of:best_friends_first_user_fkey(id),
        second_friend_of:best_friends_second_user_fkey(*),
        third_wheel_of:best_friends_third_wheel_fkey(*)`
    )
    .limit(1)
    .single()
  expect(Array.isArray(res.data?.first_friend_of)).toBe(true)
  expect(Array.isArray(res.data?.second_friend_of)).toBe(true)
  expect(Array.isArray(res.data?.third_wheel_of)).toBe(true)
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "first_friend_of": [
          {
            "id": 1,
          },
          {
            "id": 2,
          },
        ],
        "second_friend_of": [],
        "third_wheel_of": [],
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)

  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    first_friend_of: z.array(z.object({ id: z.number() })),
    second_friend_of: z.array(BestFriendsRowSchema),
    third_wheel_of: z.array(BestFriendsRowSchema),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('join select via column', async () => {
  const res = await postgrest.from('user_profiles').select('username(*)').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "username": {
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
    username: UsersRowSchema.nullable(),
  })
  // TODO: older versions of zod require this trick for non optional unknown data type
  // newer version of zod don't have this issue but require an upgrade of typescript minimal version
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('join select via column selective', async () => {
  const res = await postgrest.from('user_profiles').select('username(status)').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "username": {
          "status": "ONLINE",
        },
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)

  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    username: z.object({ status: z.enum(['ONLINE', 'OFFLINE'] as const).nullable() }).nullable(),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('join select via column and alias', async () => {
  const res = await postgrest.from('user_profiles').select('user:username(*)').limit(1).single()
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
    user: UsersRowSchema.nullable(),
  })
  // TODO: older versions of zod require this trick for non optional unknown data type
  // newer version of zod don't have this issue but require an upgrade of typescript minimal version
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('join select via unique table relationship', async () => {
  const res = await postgrest.from('user_profiles').select('users(*)').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "users": {
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
    users: UsersRowSchema.nullable(),
  })
  // TODO: older versions of zod require this trick for non optional unknown data type
  // newer version of zod don't have this issue but require an upgrade of typescript minimal version
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('join select via view name relationship', async () => {
  const res = await postgrest.from('user_profiles').select('updatable_view(*)').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "updatable_view": {
          "non_updatable_column": 1,
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
    updatable_view: z
      .object({
        non_updatable_column: z.number().nullable(),
        username: z.string().nullable(),
      })
      .nullable(),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('join select via column with string templating', async () => {
  const res = await postgrest.from('users').select(`status, ${userColumn}`).limit(1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "status": "ONLINE",
        "username": "supabot",
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)

  let result: Exclude<typeof res.data, null>
  const ExpectedSchema = z.object({
    status: z.enum(['ONLINE', 'OFFLINE'] as const).nullable(),
    username: z.string(),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('join with column hinting', async () => {
  const res = await postgrest.from('best_friends').select('users!first_user(*)').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "users": {
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
    users: UsersRowSchema,
  })
  // TODO: older versions of zod require this trick for non optional unknown data type
  // newer version of zod don't have this issue but require an upgrade of typescript minimal version
  let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})

test('inner join on many relation', async () => {
  const res = await postgrest
    .from('channels')
    .select('id, messages!channel_id!inner(id, username)')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "id": 1,
        "messages": [
          {
            "id": 1,
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
    id: z.number(),
    messages: z.array(z.object({ id: z.number(), username: z.string() })),
  })
  let expected: z.infer<typeof ExpectedSchema>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
  ExpectedSchema.parse(res.data)
})
