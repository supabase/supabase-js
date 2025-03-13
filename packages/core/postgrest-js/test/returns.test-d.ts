import { expectType } from 'tsd'
import { PostgrestBuilder, PostgrestClient } from '../src/index'
import { Database } from './types'
import { TypeEqual } from 'ts-expect'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient<Database>(REST_URL)

// Test returns() with different end methods
{
  // Test with single()
  const singleResult = await postgrest
    .from('users')
    .select()
    .single()
    .returns<{ username: string }>()
  if (singleResult.error) {
    throw new Error(singleResult.error.message)
  }
  let result: typeof singleResult.data
  let expected: { username: string }
  expectType<TypeEqual<typeof result, typeof expected>>(true)

  // Test with maybeSingle()
  const maybeSingleResult = await postgrest
    .from('users')
    .select()
    .maybeSingle()
    .returns<{ username: string }>()
  if (maybeSingleResult.error) {
    throw new Error(maybeSingleResult.error.message)
  }
  let maybeSingleResultType: typeof maybeSingleResult.data
  let maybeSingleExpected: { username: string } | null
  expectType<TypeEqual<typeof maybeSingleResultType, typeof maybeSingleExpected>>(true)

  // Test array to non-array type casting error
  const invalidCastArray = await postgrest.from('users').select().returns<{ username: string }>()
  if (invalidCastArray.error) {
    throw new Error(invalidCastArray.error.message)
  }
  let resultType: typeof invalidCastArray.data
  let resultExpected: {
    Error: 'Type mismatch: Cannot cast array result to a single object. Use .overrideTypes<Array<YourType>> or .returns<Array<YourType>> (deprecated) for array results or .single() to convert the result to a single object'
  }
  expectType<TypeEqual<typeof resultType, typeof resultExpected>>(true)

  // Test non-array to array type casting error
  const invalidCastSingle = postgrest
    .from('users')
    .select()
    .single()
    .returns<{ username: string }[]>()
  expectType<
    PostgrestBuilder<
      {
        Error: 'Type mismatch: Cannot cast single object to array type. Remove Array wrapper from return type or make sure you are not using .single() up in the calling chain'
      },
      false
    >
  >(invalidCastSingle)

  // Test with csv()
  const csvResult = await postgrest.from('users').select().csv().returns<string>()
  if (csvResult.error) {
    throw new Error(csvResult.error.message)
  }
  let csvResultType: typeof csvResult.data
  let csvExpected: string
  expectType<TypeEqual<typeof csvResultType, typeof csvExpected>>(true)

  // Test with throwOnError()
  const throwResult = await postgrest
    .from('users')
    .select()
    .returns<{ username: string }[]>()
    .throwOnError()
  let throwResultType: typeof throwResult.data
  let throwExpected: { username: string }[]
  expectType<TypeEqual<typeof throwResultType, typeof throwExpected>>(true)
  let throwErrorType: typeof throwResult.error
  let throwErrorExpected: null
  expectType<TypeEqual<typeof throwErrorType, typeof throwErrorExpected>>(true)
}

// Test returns() with nested selects and relationships
{
  const result = await postgrest
    .from('users')
    .select('username, messages(id, content)')
    .single()
    .returns<{
      username: string
      messages: { id: number; content: string }[]
    }>()
  if (result.error) {
    throw new Error(result.error.message)
  }
  let resultType: typeof result.data
  let expected: {
    username: string
    messages: { id: number; content: string }[]
  }
  expectType<TypeEqual<typeof resultType, typeof expected>>(true)
}

// Test returns() with JSON operations
{
  const result = await postgrest
    .from('users')
    .select('data->settings')
    .single()
    .returns<{ settings: { theme: 'light' | 'dark' } }>()
  if (result.error) {
    throw new Error(result.error.message)
  }
  let resultType: typeof result.data
  let expected: { settings: { theme: 'light' | 'dark' } }
  expectType<TypeEqual<typeof resultType, typeof expected>>(true)
}
