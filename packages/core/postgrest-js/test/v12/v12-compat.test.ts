// Tests for PostgREST v12 backward compatibility
// These tests verify behavior that differs between v12 and v14+
// TODO (@mandarini): Remove this file when v3 ships (early 2025)

import { PostgrestClient } from '../../src/index'
import { Database } from '../types.override'
import { expectType, TypeEqual } from '../types'
import { SelectQueryError } from '../../src/select-query-parser/utils'

const REST_URL = 'http://localhost:3012'
const postgrest = new PostgrestClient<Database>(REST_URL)

// Test 1: Main v12 vs v14+ difference - spread on many relation
test('select spread on many relation returns error in v12', async () => {
  const res = await postgrest
    .from('channels')
    .select('channel_id:id, ...messages(id, message)')
    .limit(1)
    .single()

  // In v12, spreading a many relation returns PGRST119 error
  // In v14+, this returns arrays (valid feature)
  expect(res.error?.code).toBe('PGRST119')
  expect(res.error?.message).toContain('spread operation')
  expect(res.error?.details).toContain('do not form a many-to-one or one-to-one relationship')

  let result: Exclude<typeof res.data, null>
  let expected: {
    channel_id: number
    messages: SelectQueryError<'"channels" and "messages" do not form a many-to-one or one-to-one relationship spread not possible'>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
})

// Test 2: Sanity check - basic select works
test('basic select works', async () => {
  const res = await postgrest.from('users').select('username').limit(1).single()

  expect(res.error).toBeNull()
  expect(res.data).not.toBeNull()
  expect(res.data?.username).toBeDefined()
})

// Test 3: Nested relations work
test('nested relations work', async () => {
  const res = await postgrest.from('messages').select('id, channels(slug)').limit(1).single()

  expect(res.error).toBeNull()
  expect(res.data).not.toBeNull()
  expect(res.data?.channels).toBeDefined()
  expect(res.data?.channels?.slug).toBeDefined()
})

// Test 4: Spread on one-to-one relation works (both v12 and v14+)
test('spread on one-to-one relation works in v12', async () => {
  const res = await postgrest
    .from('channels')
    .select('id, ...channel_details(details)')
    .limit(1)
    .single()

  // This should work in both v12 and v14+
  expect(res.error).toBeNull()
  expect(res.data).not.toBeNull()
  expect(res.data?.id).toBeDefined()
  // channel_details.details should be spread directly onto the result
  expect('details' in (res.data || {})).toBe(true)
})
