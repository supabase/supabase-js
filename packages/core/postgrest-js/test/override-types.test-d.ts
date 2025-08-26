import { expectType, TypeEqual } from './types'
import { PostgrestClient } from '../src'
import { CustomUserDataType, Database } from './types.override'
import { Json } from './types.generated'

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
        Error: 'Type mismatch: Cannot cast array result to a single object. Use .overrideTypes<Array<YourType>> or .returns<Array<YourType>> (deprecated) for array results or .single() to convert the result to a single object'
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
// Test with maybeSingle() merging with new field
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
  let expectedType: {
    age_range: unknown
    catchphrase: unknown
    data: CustomUserDataType | null
    status: 'ONLINE' | 'OFFLINE' | null
    username: string
    custom_field: string
  } | null
  expectType<TypeEqual<typeof maybeSingleResultType, typeof expectedType>>(true)
}
// Test with maybeSingle() merging with override field
{
  const maybeSingleResult = await postgrest
    .from('users')
    .select()
    .maybeSingle()
    .overrideTypes<{ catchphrase: string }>()
  if (maybeSingleResult.error) {
    throw new Error(maybeSingleResult.error.message)
  }
  let maybeSingleResultType: typeof maybeSingleResult.data
  let expectedType: {
    age_range: unknown
    catchphrase: string
    data: CustomUserDataType | null
    status: 'ONLINE' | 'OFFLINE' | null
    username: string
  } | null
  expectType<TypeEqual<typeof maybeSingleResultType, typeof expectedType>>(true)
}
// Test with maybeSingle() replace with override field
{
  const maybeSingleResult = await postgrest
    .from('users')
    .select()
    .maybeSingle()
    .overrideTypes<{ catchphrase: string }, { merge: false }>()
  if (maybeSingleResult.error) {
    throw new Error(maybeSingleResult.error.message)
  }
  let maybeSingleResultType: typeof maybeSingleResult.data
  let expectedType: {
    catchphrase: string
  } | null
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

// Test overriding existing field types in array results
{
  const result = await postgrest
    .from('users')
    .select()
    .overrideTypes<{ username: number }[], { merge: false }>()
  if (result.error) {
    throw new Error(result.error.message)
  }
  let data: typeof result.data
  expectType<TypeEqual<typeof data, { username: number }[]>>(true)
}

// Test merging and replacing existing field types in array results
{
  const result = await postgrest.from('users').select().overrideTypes<{ username: number }[]>()
  if (result.error) {
    throw new Error(result.error.message)
  }
  let data: typeof result.data
  expectType<
    TypeEqual<
      typeof data,
      {
        username: number
        data: CustomUserDataType | null
        age_range: unknown
        catchphrase: unknown
        status: 'ONLINE' | 'OFFLINE' | null
      }[]
    >
  >(true)
}

// Test merging and replacing existing field types in object result
{
  const result = await postgrest
    .from('users')
    .select()
    .single()
    .overrideTypes<{ username: number }>()
  if (result.error) {
    throw new Error(result.error.message)
  }
  let data: typeof result.data
  expectType<
    TypeEqual<
      typeof data,
      {
        username: number
        data: CustomUserDataType | null
        age_range: unknown
        catchphrase: unknown
        status: 'ONLINE' | 'OFFLINE' | null
      }
    >
  >(true)
}

// Test merging nested object fields remove optionality via override
{
  const result = await postgrest
    .from('users')
    .select()
    .overrideTypes<{ data: { foo: number; qux: boolean } }[]>()
  if (result.error) {
    throw new Error(result.error.message)
  }
  let data: typeof result.data
  expectType<
    TypeEqual<
      typeof data,
      {
        username: string
        data: {
          foo: number
          bar: { baz: number }
          en: 'ONE' | 'TWO' | 'THREE'
          record: Record<string, Json | undefined> | null
          recordNumber: Record<number, Json | undefined> | null
          qux: boolean
        }
        age_range: unknown
        catchphrase: unknown
        status: 'ONLINE' | 'OFFLINE' | null
      }[]
    >
  >(true)
}
// Test merging nested object fields preserve optionality via the override
{
  const result = await postgrest
    .from('users')
    .select()
    .single()
    .overrideTypes<{ data: { foo: number; qux: boolean } | null }>()
  if (result.error) {
    throw new Error(result.error.message)
  }
  let data: typeof result.data
  expectType<
    TypeEqual<
      typeof data,
      {
        username: string
        data: {
          foo: number
          bar: { baz: number }
          en: 'ONE' | 'TWO' | 'THREE'
          record: Record<string, Json | undefined> | null
          recordNumber: Record<number, Json | undefined> | null
          qux: boolean
        } | null
        age_range: unknown
        catchphrase: unknown
        status: 'ONLINE' | 'OFFLINE' | null
      }
    >
  >(true)
}

// Test replacing nested object structure
{
  const result = await postgrest
    .from('users')
    .select()
    .overrideTypes<{ data: { newField: string } }[], { merge: false }>()
  if (result.error) {
    throw new Error(result.error.message)
  }
  let data: typeof result.data
  expectType<TypeEqual<typeof data, { data: { newField: string } }[]>>(true)
}

// Test deep nested merge with array fields
{
  const result = await postgrest
    .from('users')
    .select()
    .overrideTypes<{ nested: { arr: { newElement: boolean }[] } }[]>()
  if (result.error) {
    throw new Error(result.error.message)
  }
  let data: typeof result.data
  expectType<
    TypeEqual<
      typeof data,
      {
        username: string
        data: CustomUserDataType | null
        age_range: unknown
        catchphrase: unknown
        status: 'ONLINE' | 'OFFLINE' | null
        nested: { arr: { newElement: boolean }[] }
      }[]
    >
  >(true)
}

// Test merging at multiple nested levels
{
  const result = await postgrest
    .from('users')
    .select()
    .overrideTypes<{ data: { bar: { newBaz: string }; en: 'FOUR' } }[]>()
  if (result.error) {
    throw new Error(result.error.message)
  }
  let data: typeof result.data
  expectType<
    TypeEqual<
      typeof data,
      {
        username: string
        data: {
          foo: string
          bar: { baz: number; newBaz: string }
          en: 'FOUR' // Overridden enum value
          record: Record<string, Json | undefined> | null
          recordNumber: Record<number, Json | undefined> | null
        }
        age_range: unknown
        catchphrase: unknown
        status: 'ONLINE' | 'OFFLINE' | null
      }[]
    >
  >(true)
}

// Test merging with Json defined as Record
{
  const result = await postgrest
    .from('users')
    .select()
    .overrideTypes<{ data: { record: { baz: 'foo' }; recordNumber: { bar: 'foo' } } }[]>()
  if (result.error) {
    throw new Error(result.error.message)
  }
  let data: typeof result.data
  expectType<
    TypeEqual<
      typeof data,
      {
        username: string
        data: {
          foo: string
          bar: {
            baz: number
          }
          en: 'ONE' | 'TWO' | 'THREE'
          record: {
            [x: string]: Json | undefined
            baz: 'foo'
          }
          recordNumber: {
            [x: number]: Json | undefined
            bar: 'foo'
          }
        }
        age_range: unknown
        catchphrase: unknown
        status: 'ONLINE' | 'OFFLINE' | null
      }[]
    >
  >(true)
}

// Test overrideTypes with embedded relations
{
  const result = await postgrest.from('users').select('*, messages(*)').overrideTypes<
    {
      messages: { created_at: Date; data: string }[]
    }[]
  >()
  if (result.error) {
    throw new Error(result.error.message)
  }
  let data: typeof result.data
  expectType<
    TypeEqual<
      typeof data,
      {
        username: string
        data: CustomUserDataType | null
        age_range: unknown
        catchphrase: unknown
        status: 'ONLINE' | 'OFFLINE' | null
        messages: {
          channel_id: number
          data: string
          id: number
          message: string | null
          username: string
          created_at: Date
        }[]
      }[]
    >
  >(true)
}

// Test overrideTypes with embedded relations and merge: false
{
  const result = await postgrest.from('users').select('*, messages(*)').overrideTypes<
    {
      messages: { content: string }[]
    }[],
    { merge: false }
  >()
  if (result.error) {
    throw new Error(result.error.message)
  }
  let data: typeof result.data
  expectType<
    TypeEqual<
      typeof data,
      {
        messages: { content: string }[]
      }[]
    >
  >(true)
}

// Test overrideTypes with a new array field
{
  const result = await postgrest.from('users').select('*, messages(*)').overrideTypes<
    {
      test: { created_at: Date; data: string }[]
    }[]
  >()
  if (result.error) {
    throw new Error(result.error.message)
  }
  let data: typeof result.data
  expectType<
    TypeEqual<
      typeof data,
      {
        username: string
        data: CustomUserDataType | null
        age_range: unknown
        catchphrase: unknown
        status: 'ONLINE' | 'OFFLINE' | null
        messages: {
          channel_id: number
          data: Json
          id: number
          message: string | null
          username: string
        }[]
        test: { created_at: Date; data: string }[]
      }[]
    >
  >(true)
}

// Test overrideTypes deep nesting with embedded inner relation
{
  const result = await postgrest
    .from('users')
    .select('*, messages(*, channels!inner(*))')
    .overrideTypes<
      {
        messages: { channels: { data: string } }[]
      }[]
    >()
  if (result.error) {
    throw new Error(result.error.message)
  }
  let data: typeof result.data
  expectType<
    TypeEqual<
      typeof data,
      {
        age_range: unknown
        catchphrase: unknown
        data: CustomUserDataType | null
        status: 'ONLINE' | 'OFFLINE' | null
        username: string
        messages: {
          id: number
          username: string
          channels: {
            id: number
            data: string
            slug: string | null
          }
          data: Json
          channel_id: number
          message: string | null
        }[]
      }[]
    >
  >(true)
}

// Test overrideTypes single object with error embeded relation
{
  const result = await postgrest.from('users').select('*, somerelation(*)').overrideTypes<
    {
      somerelation: { created_at: Date; data: string }
    }[]
  >()
  if (result.error) {
    throw new Error(result.error.message)
  }
  let data: typeof result.data
  expectType<
    TypeEqual<
      typeof data,
      {
        username: string
        data: CustomUserDataType | null
        age_range: unknown
        catchphrase: unknown
        status: 'ONLINE' | 'OFFLINE' | null
        somerelation: { created_at: Date; data: string }
      }[]
    >
  >(true)
}
