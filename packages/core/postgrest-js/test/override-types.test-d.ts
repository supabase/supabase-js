import { expectType } from 'tsd'
import { TypeEqual } from 'ts-expect'
import { PostgrestClient } from '../src'
import { CustomUserDataType, Database } from './types'

const REST_URL = 'http://localhost:54321'
const postgrest = new PostgrestClient<Database>(REST_URL)

// Test merge array result to object should error
{
  const singleResult = await postgrest
    .from('users')
    .select()
    .overrideTypes<{ custom_field: string }>()
  if (singleResult.error) {
    throw new Error(singleResult.error.message)
  }
  let result: typeof singleResult.data
  expectType<
    TypeEqual<
      typeof result,
      {
        Error: 'Type mismatch: Cannot cast array result to a single object. Use .returns<Array<YourType>> for array results or .single() to convert the result to a single object'
      }
    >
  >(true)
}

// Test merge object result to array type should error
{
  const singleResult = await postgrest
    .from('users')
    .select()
    .single()
    .overrideTypes<{ custom_field: string }[]>()
  if (singleResult.error) {
    throw new Error(singleResult.error.message)
  }
  let result: typeof singleResult.data
  expectType<
    TypeEqual<
      typeof result,
      {
        Error: 'Type mismatch: Cannot cast single object to array type. Remove Array wrapper from return type or make sure you are not using .single() up in the calling chain'
      }
    >
  >(true)
}

// Test with single() / maybeSingle()
{
  const singleResult = await postgrest
    .from('users')
    .select()
    .single()
    .overrideTypes<{ custom_field: string }>()
  if (singleResult.error) {
    throw new Error(singleResult.error.message)
  }
  let result: typeof singleResult.data
  expectType<TypeEqual<(typeof result)['custom_field'], string>>(true)
}
// Test with maybeSingle()
{
  const maybeSingleResult = await postgrest
    .from('users')
    .select()
    .maybeSingle()
    .overrideTypes<{ custom_field: string }>()
  if (maybeSingleResult.error) {
    throw new Error(maybeSingleResult.error.message)
  }
  let maybeSingleResultType: typeof maybeSingleResult.data
  let expectedType: { custom_field: string } | null
  expectType<TypeEqual<typeof maybeSingleResultType, typeof expectedType>>(true)
}
// Test replacing behavior
{
  const singleResult = await postgrest
    .from('users')
    .select()
    .single()
    .overrideTypes<{ custom_field: string }, { merge: false }>()
  if (singleResult.error) {
    throw new Error(singleResult.error.message)
  }
  let result: typeof singleResult.data
  expectType<TypeEqual<typeof result, { custom_field: string }>>(true)
}

// Test with select()
{
  const singleResult = await postgrest
    .from('users')
    .select()
    .overrideTypes<{ custom_field: string }[]>()
  if (singleResult.error) {
    throw new Error(singleResult.error.message)
  }
  let result: typeof singleResult.data
  expectType<
    TypeEqual<
      typeof result,
      {
        username: string
        data: CustomUserDataType | null
        age_range: unknown
        catchphrase: unknown
        status: 'ONLINE' | 'OFFLINE' | null
        custom_field: string
      }[]
    >
  >(true)
}
// Test replacing select behavior
{
  const singleResult = await postgrest
    .from('users')
    .select()
    .overrideTypes<{ custom_field: string }[], { merge: false }>()
  if (singleResult.error) {
    throw new Error(singleResult.error.message)
  }
  let result: typeof singleResult.data
  expectType<TypeEqual<typeof result, { custom_field: string }[]>>(true)
}
