import { expectType, TypeEqual } from './types'
import { PostgrestBuilder, PostgrestClient } from '../src/index'
import { Database } from './types.override'

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
      { PostgrestVersion: '12' },
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

// Check that a deeply nested result type doesn't yield an possibly infinite recursion error
{
  // Maximum reached is 14 levels of nesting before the recursion too deep error
  const result = await postgrest
    .from('users')
    .select(
      `username,
      catchphrase,
      messages(
        *,
        blurb_message,
        users(
          *,
          catchphrase,
          messages(
            *,
            blurb_message,
            channels(
              *,
              users(
                *,
                catchphrase,
                messages(
                  *,
                  blurb_message,
                  users(
                    *,
                    catchphrase,
                    messages(
                      *,
                      blurb_message,
                      channels(
                        *,
                        users(
                          *,
                          catchphrase,
                          messages(
                            *,
                            blurb_message,
                            users(
                              *,
                              catchphrase,
                              messages(
                                *,
                                blurb_message,
                                channels(
                                  *
                                )
                              )
                            )
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
      `
    )
    .single()
  let resultType: Exclude<typeof result.data, null>
  let resultUsernameNested: (typeof resultType)['messages'][0]['username']
  let expected: string
  expectType<TypeEqual<typeof resultUsernameNested, typeof expected>>(true)
}

// Check that selecting many fields doesn't yield an possibly infinite recursion error
{
  const result = await postgrest
    .from('users')
    // Maximum reached was one hundred seventy six fields
    // Without the Omit<Acc, keyof FieldResult> & FieldResult
    // With it, it raise as soon as after 12 fields only
    .select(
      `username,
      catchphrase,
      one:username,
      two:username,
      three:username,
      four:username,
      five:username,
      six:username,
      seven:username,
      eight:username,
      nine:username,
      ten:username,
      eleven:username,
      twelve:username,
      thirteen:username,
      fourteen:username,
      fifteen:username,
      sixteen:username,
      seventeen:username,
      eighteen:username,
      nineteen:username,
      twenty:username,
      twentyone:username,
      twentytwo:username,
      twentythree:username,
      twentyfour:username,
      twentyfive:username,
      twentysix:username,
      twentyseven:username,
      twentyeight:username,
      twentynine:username,
      thirty:username,
      thirtyone:username,
      thirtytwo:username,
      thirtythree:username,
      thirtyfour:username,
      thirtyfive:username,
      thirtysix:username,
      thirtyseven:username,
      thirtyeight:username,
      thirtynine:username,
      forty:username,
      fortyone:username,
      fortytwo:username,
      fortythree:username,
      fortyfour:username,
      fortyfive:username,
      fortysix:username,
      fortyseven:username,
      fortyeight:username,
      fortynine:username,
      fifty:username
      `
    )
    .single()
  let resultType: Exclude<typeof result.data, null>
  let resultFifty: (typeof resultType)['fifty']
  let expected: string
  expectType<TypeEqual<typeof resultFifty, typeof expected>>(true)
}

// Check that selecting many fields doesn't affect the depth recursion limit
{
  const result = await postgrest
    .from('users')
    .select(
      `username,
      catchphrase,
      data->>one,
      data->>two,
      data->>three,
      data->>four,
      data->>five,
      data->>six,
      data->>seven,
      data->>eight,
      data->>nine,
      data->>ten,
      data->>eleven,
      data->>twelve,
      data->>thirteen,
      data->>fourteen,
      data->>fifteen,
      data->>sixteen,
      data->>seventeen,
      data->>eighteen,
      data->>nineteen,
      data->>twenty,
      data->>twentyone,
      data->>twentytwo,
      data->>twentythree,
      data->>twentyfour,
      data->>twentyfive,
      data->>twentysix,
      data->>twentyseven,
      data->>twentyeight,
      data->>twentynine,
      data->>thirty,
      data->>thirtyone,
      data->>thirtytwo,
      data->>thirtythree,
      data->>thirtyfour,
      data->>thirtyfive,
      data->>thirtysix,
      data->>thirtyseven,
      data->>thirtyeight,
      data->>thirtynine,
      data->>forty,
      data->>fortyone,
      data->>fortytwo,
      data->>fortythree,
      data->>fortyfour,
      data->>fortyfive,
      data->>fortysix,
      data->>fortyseven,
      data->>fortyeight,
      data->>fortynine,
      data->>fifty,
      messages(
        *,
        blurb_message,
        users(
          *,
          catchphrase,
          messages(
            *,
            blurb_message,
            channels(
              *,
              users(
                *,
                catchphrase,
                messages(
                  *,
                  blurb_message,
                  users(
                    *,
                    catchphrase,
                    messages(
                      *,
                      blurb_message,
                      channels(
                        *,
                        users(
                          *,
                          catchphrase,
                          messages(
                            *,
                            blurb_message,
                            users(
                              *,
                              catchphrase,
                              messages(
                                *,
                                blurb_message,
                                channels(
                                  *
                                )
                              )
                            )
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
      `
    )
    .single()
  let resultType: Exclude<typeof result.data, null>
  let resultFifty: (typeof resultType)['fifty']
  let resultUsernameNested: (typeof resultType)['messages'][0]['username']
  let expected: string
  expectType<TypeEqual<typeof resultFifty, typeof expected>>(true)
  expectType<TypeEqual<typeof resultUsernameNested, typeof expected>>(true)
}
