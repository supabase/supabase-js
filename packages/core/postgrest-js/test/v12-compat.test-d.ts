// Type tests for PostgREST v12 backward compatibility
// Ensures TypeScript types correctly handle v12 error cases
// TODO (@mandarini): Remove this file when v3 ships (early 2025)

import { PostgrestClient } from '../src/index'
import { Database } from './types.override'
import { expectType, TypeEqual } from './types'
import { SelectQueryError } from '../src/select-query-parser/utils'

const REST_URL = 'http://localhost:3012'
const postgrest = new PostgrestClient<Database>(REST_URL)

// Type test: spread on many relation produces SelectQueryError type
// In v12 this returns PGRST119 error at runtime
// In v14+ this returns arrays at runtime
// TypeScript should infer SelectQueryError for safety (handles both versions)
{
  const res = await postgrest
    .from('channels')
    .select('channel_id:id, ...messages(id, message)')
    .single()

  let result: Exclude<typeof res.data, null>
  let expected: {
    channel_id: number
    messages: SelectQueryError<'"channels" and "messages" do not form a many-to-one or one-to-one relationship spread not possible'>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// Type test: spread on one-to-one relation works correctly
// This should work in both v12 and v14+
{
  const res = await postgrest.from('channels').select('id, ...channel_details(details)').single()

  let result: Exclude<typeof res.data, null>
  let expected: {
    id: number
    details: string | null
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}
