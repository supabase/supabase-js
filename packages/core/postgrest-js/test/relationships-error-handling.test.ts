import { PostgrestClient } from '../src/index'
import { Database } from './types.override'
import { expectType, TypeEqual } from './types'
import { SelectQueryError } from '../src/select-query-parser/utils'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient<Database>(REST_URL)

test('join over a 1-1 relation with both nullables and non-nullables fields with no hinting', async () => {
  const res = await postgrest
    .from('best_friends')
    .select('first_user:users(*), second_user:users(*), third_wheel:users(*)')
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": {
        "code": "PGRST201",
        "details": [
          {
            "cardinality": "many-to-one",
            "embedding": "best_friends with users",
            "relationship": "best_friends_first_user_fkey using best_friends(first_user) and users(username)",
          },
          {
            "cardinality": "many-to-one",
            "embedding": "best_friends with users",
            "relationship": "best_friends_second_user_fkey using best_friends(second_user) and users(username)",
          },
          {
            "cardinality": "many-to-one",
            "embedding": "best_friends with users",
            "relationship": "best_friends_third_wheel_fkey using best_friends(third_wheel) and users(username)",
          },
        ],
        "hint": "Try changing 'users' to one of the following: 'users!best_friends_first_user_fkey', 'users!best_friends_second_user_fkey', 'users!best_friends_third_wheel_fkey'. Find the desired relationship in the 'details' key.",
        "message": "Could not embed because more than one relationship was found for 'best_friends' and 'users'",
      },
      "status": 300,
      "statusText": "Multiple Choices",
    }
  `)
  let result: Exclude<typeof res.data, null>
  let expected: {
    first_user: SelectQueryError<"Could not embed because more than one relationship was found for 'users' and 'best_friends' you need to hint the column with users!<columnName> ?">
    second_user: SelectQueryError<"Could not embed because more than one relationship was found for 'users' and 'best_friends' you need to hint the column with users!<columnName> ?">
    third_wheel: SelectQueryError<"Could not embed because more than one relationship was found for 'users' and 'best_friends' you need to hint the column with users!<columnName> ?">
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
})

test('join over a 1-M relation with both nullables and non-nullables fields with no hinting', async () => {
  const res = await postgrest
    .from('users')
    .select(
      'first_friend_of:best_friends(*), second_friend_of:best_friends(*), third_wheel_of:best_friends(*)'
    )
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": {
        "code": "PGRST201",
        "details": [
          {
            "cardinality": "one-to-many",
            "embedding": "users with best_friends",
            "relationship": "best_friends_first_user_fkey using users(username) and best_friends(first_user)",
          },
          {
            "cardinality": "one-to-many",
            "embedding": "users with best_friends",
            "relationship": "best_friends_second_user_fkey using users(username) and best_friends(second_user)",
          },
          {
            "cardinality": "one-to-many",
            "embedding": "users with best_friends",
            "relationship": "best_friends_third_wheel_fkey using users(username) and best_friends(third_wheel)",
          },
        ],
        "hint": "Try changing 'best_friends' to one of the following: 'best_friends!best_friends_first_user_fkey', 'best_friends!best_friends_second_user_fkey', 'best_friends!best_friends_third_wheel_fkey'. Find the desired relationship in the 'details' key.",
        "message": "Could not embed because more than one relationship was found for 'users' and 'best_friends'",
      },
      "status": 300,
      "statusText": "Multiple Choices",
    }
  `)
  let result: Exclude<typeof res.data, null>
  let expected: {
    first_friend_of: SelectQueryError<"Could not embed because more than one relationship was found for 'best_friends' and 'users' you need to hint the column with best_friends!<columnName> ?">
    second_friend_of: SelectQueryError<"Could not embed because more than one relationship was found for 'best_friends' and 'users' you need to hint the column with best_friends!<columnName> ?">
    third_wheel_of: SelectQueryError<"Could not embed because more than one relationship was found for 'best_friends' and 'users' you need to hint the column with best_friends!<columnName> ?">
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
})

test('join over a 1-M relation with both nullables and non-nullables fields using no hinting on nested relation', async () => {
  const res = await postgrest
    .from('users')
    .select(
      'first_friend_of:best_friends!first_user(*, first_user:users(*)), second_friend_of:best_friends!second_user(*), third_wheel_of:best_friends!third_wheel(*)'
    )
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": {
        "code": "PGRST201",
        "details": [
          {
            "cardinality": "many-to-one",
            "embedding": "best_friends with users",
            "relationship": "best_friends_first_user_fkey using best_friends(first_user) and users(username)",
          },
          {
            "cardinality": "many-to-one",
            "embedding": "best_friends with users",
            "relationship": "best_friends_second_user_fkey using best_friends(second_user) and users(username)",
          },
          {
            "cardinality": "many-to-one",
            "embedding": "best_friends with users",
            "relationship": "best_friends_third_wheel_fkey using best_friends(third_wheel) and users(username)",
          },
        ],
        "hint": "Try changing 'users' to one of the following: 'users!best_friends_first_user_fkey', 'users!best_friends_second_user_fkey', 'users!best_friends_third_wheel_fkey'. Find the desired relationship in the 'details' key.",
        "message": "Could not embed because more than one relationship was found for 'best_friends' and 'users'",
      },
      "status": 300,
      "statusText": "Multiple Choices",
    }
  `)
  let result: Exclude<typeof res.data, null>
  let expected: {
    first_friend_of: Array<{
      id: number
      second_user: string
      third_wheel: string | null
      first_user: SelectQueryError<"Could not embed because more than one relationship was found for 'users' and 'best_friends' you need to hint the column with users!<columnName> ?">
    }>
    second_friend_of: Array<Database['public']['Tables']['best_friends']['Row']>
    third_wheel_of: Array<Database['public']['Tables']['best_friends']['Row']>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
})

test('join with same dest twice column hinting', async () => {
  const res = await postgrest
    .from('best_friends')
    .select('users!first_user(*), users!second_user(*)')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": {
        "code": "42712",
        "details": null,
        "hint": null,
        "message": "table name "best_friends_users_1" specified more than once",
      },
      "status": 400,
      "statusText": "Bad Request",
    }
  `)
  let result: Exclude<typeof res.data, null>
  let expected: {
    users: SelectQueryError<'table "best_friends" specified more than once use hinting for desambiguation'>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
})

test('nested query with selective fields and inner join should error on non existing relation', async () => {
  const res = await postgrest
    .from('users')
    .select(
      'msgs:messages(id, ...message_details(created_at, channel!inner(id, slug, owner:users(*))))'
    )
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": {
        "code": "PGRST200",
        "details": "Searched for a foreign key relationship between 'messages' and 'message_details' in the schema 'public', but no matches were found.",
        "hint": null,
        "message": "Could not find a relationship between 'messages' and 'message_details' in the schema cache",
      },
      "status": 400,
      "statusText": "Bad Request",
    }
  `)
  let result: Exclude<typeof res.data, null>
  let expected: {
    msgs: {
      id: number
      message_details: SelectQueryError<'could not find the relation between messages and message_details'>
    }[]
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
})

test('aggregate on missing column with alias', async () => {
  const res = await postgrest
    .from('users')
    .select('alias:missing_column.count()')
    .eq('id', 2)
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": {
        "code": "42703",
        "details": null,
        "hint": null,
        "message": "column users.missing_column does not exist",
      },
      "status": 400,
      "statusText": "Bad Request",
    }
  `)
  let result: Exclude<typeof res.data, null>
  let expected: SelectQueryError<`column 'missing_column' does not exist on 'users'.`>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
})

test('typecasting and aggregate', async () => {
  const res = await postgrest
    .from('messages')
    .select(
      'message, users.count(), casted_message:message::int4, casted_count:users.count()::text'
    )
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": {
        "code": "42703",
        "details": null,
        "hint": null,
        "message": "column messages.users does not exist",
      },
      "status": 400,
      "statusText": "Bad Request",
    }
  `)
  let result: Exclude<typeof res.data, null>
  let expected: SelectQueryError<`column 'users' does not exist on 'messages'.`>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
})

test('select spread on many relation', async () => {
  const res = await postgrest
    .from('channels')
    .select('channel_id:id, ...messages(id, message)')
    .limit(1)
    .single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": {
        "code": "PGRST119",
        "details": "'channels' and 'messages' do not form a many-to-one or one-to-one relationship",
        "hint": null,
        "message": "A spread operation on 'messages' is not possible",
      },
      "status": 400,
      "statusText": "Bad Request",
    }
  `)
  let result: Exclude<typeof res.data, null>
  let expected: {
    channel_id: number
    messages: SelectQueryError<'"channels" and "messages" do not form a many-to-one or one-to-one relationship spread not possible'>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
})
test('select with aggregate sum function without column should error', async () => {
  const res = await postgrest.from('users').select('username, messages(sum)').limit(1).single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": {
        "code": "42703",
        "details": null,
        "hint": null,
        "message": "column messages_1.sum does not exist",
      },
      "status": 400,
      "statusText": "Bad Request",
    }
  `)
  let result: Exclude<typeof res.data, null>
  let expected: {
    username: string
    messages: SelectQueryError<"column 'sum' does not exist on 'messages'.">[]
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
})
