import { test } from 'tstyche'
import { expectType, TypeEqual } from './types'
import { PostgrestClient } from '../src/index'
import { SelectQueryError } from '../src/select-query-parser/utils'
import { Database } from './types.generated'

const REST_URL = 'http://localhost:54321/rest/v1'
const postgrest = new PostgrestClient<Database>(REST_URL)

type Address = Database['public']['CompositeTypes']['address']
type UserStatus = Database['public']['Enums']['user_status']

// Row, Insert and Update diverge for identity, generated and defaulted columns
{
  const { data } = await postgrest
    .from('inference_cases')
    .select('id, sequence_id, price, quantity, total')
    .single()
  expectType<
    TypeEqual<
      typeof data,
      {
        id: number
        sequence_id: number
        price: number
        quantity: number
        total: number | null
      } | null
    >
  >(true)

  postgrest.from('inference_cases').insert({ price: 1, required_payload: {} })
  postgrest.from('inference_cases').insert({ price: 1, required_payload: {}, sequence_id: 7 })
  // A required column is missing
  // @ts-expect-error Argument of type '{ required_payload: {}; }' is not assignable to parameter of type
  postgrest.from('inference_cases').insert({ required_payload: {} })
  // An identity column generated always cannot be written
  // @ts-expect-error Type 'number' is not assignable to type
  postgrest.from('inference_cases').insert({ price: 1, required_payload: {}, id: 1 })
  // A stored generated column cannot be written
  // @ts-expect-error Type 'number' is not assignable to type
  postgrest.from('inference_cases').insert({ price: 1, required_payload: {}, total: 2 })

  postgrest.from('inference_cases').update({})
  postgrest.from('inference_cases').update({ price: 2, quantity: 3 })
  // A stored generated column cannot be updated
  // @ts-expect-error Type 'number' is not assignable to type
  postgrest.from('inference_cases').update({ total: 2 })
  // An identity column generated always cannot be updated
  // @ts-expect-error Type 'number' is not assignable to type
  postgrest.from('inference_cases').update({ id: 2 })
}

// Nullability follows NOT NULL, including for json and jsonb
{
  const { data } = await postgrest.from('inference_cases').select('note, price').single()
  expectType<TypeEqual<typeof data, { note: string | null; price: number } | null>>(true)

  postgrest
    .from('inference_cases')
    .insert({ price: 1, required_payload: {}, optional_payload: null })
  // A NOT NULL column cannot be updated to null
  // @ts-expect-error Type 'null' is not assignable to type 'number | undefined'.
  postgrest.from('inference_cases').update({ price: null })
}

// These tests type Json as unknown, and NonNullable<unknown> is unknown before TypeScript 4.8
// @tstyche if { target: [">=4.8"] }
test('a NOT NULL jsonb column does not accept null', () => {
  // @ts-expect-error Type 'null' is not assignable to type '{}'.
  postgrest.from('inference_cases').insert({ price: 1, required_payload: null })
  // @ts-expect-error Type 'null' is not assignable to type '{} | undefined'.
  postgrest.from('inference_cases').update({ required_payload: null })
})

// Enums, arrays and composite types
{
  const { data } = await postgrest
    .from('inference_cases')
    .select('tags, scores, shipping_address, status')
    .single()
  expectType<
    TypeEqual<
      typeof data,
      {
        tags: string[]
        scores: number[] | null
        shipping_address: Address | null
        status: UserStatus
      } | null
    >
  >(true)
  expectType<TypeEqual<Address, { street: string | null; city: string | null }>>(true)

  postgrest.from('inference_cases').insert({
    price: 1,
    required_payload: {},
    tags: ['a'],
    scores: [1, 2],
    shipping_address: { street: 'Main', city: null },
    status: 'OFFLINE',
  })
  // An array column does not accept a scalar
  // @ts-expect-error Type 'string' is not assignable to type 'string[]'.
  postgrest.from('inference_cases').insert({ price: 1, required_payload: {}, tags: 'a' })
  // An array column checks its element type
  // @ts-expect-error Type 'string' is not assignable to type 'number'.
  postgrest.from('inference_cases').insert({ price: 1, required_payload: {}, scores: ['1'] })
  // An enum column rejects a value outside the enum
  // @ts-expect-error Type '"AWAY"' is not assignable to type '"ONLINE" | "OFFLINE" | undefined'.
  postgrest.from('inference_cases').insert({ price: 1, required_payload: {}, status: 'AWAY' })
  postgrest.from('inference_cases').insert({
    price: 1,
    required_payload: {},
    // A composite column checks its field types
    // @ts-expect-error Type 'number' is not assignable to type 'string'.
    shipping_address: { street: 1, city: null },
  })
}

// RPC arguments and return types
{
  const { data: sum } = await postgrest.rpc('sum_scores', { scores: [1, 2] })
  expectType<TypeEqual<typeof sum, number | null>>(true)
  postgrest.rpc('sum_scores', { scores: [1], offset_by: 2 })
  // A required argument is missing
  // @ts-expect-error Argument of type '{ offset_by: number; }' is not assignable to parameter of type '{ offset_by?: number | undefined; scores: number[]; }'.
  postgrest.rpc('sum_scores', { offset_by: 2 })
  // An array argument checks its element type
  // @ts-expect-error Type 'string' is not assignable to type 'number'.
  postgrest.rpc('sum_scores', { scores: ['1'] })

  const { data: address } = await postgrest.rpc('echo_address', {
    address: { street: 'Main', city: 'Town' },
  })
  expectType<TypeEqual<typeof address, Address | null>>(true)
}

// Computed fields are selectable by name but left out of select('*'), in every schema
{
  const { data: all } = await postgrest.from('inference_cases').select('*').single()
  expectType<
    TypeEqual<'inference_case_label' extends keyof NonNullable<typeof all> ? true : false, false>
  >(true)
  const { data: named } = await postgrest
    .from('inference_cases')
    .select('id, inference_case_label')
    .single()
  expectType<TypeEqual<typeof named, { id: number; inference_case_label: string | null } | null>>(
    true
  )

  const { data: personalAll } = await postgrest
    .schema('personal')
    .from('users')
    .select('*')
    .single()
  expectType<
    TypeEqual<'username_label' extends keyof NonNullable<typeof personalAll> ? true : false, false>
  >(true)
  const { data: personalNamed } = await postgrest
    .schema('personal')
    .from('users')
    .select('username, username_label')
    .single()
  expectType<
    TypeEqual<typeof personalNamed, { username: string; username_label: string | null } | null>
  >(true)
}

// A zero-argument function is not a computed field and does not hide a column of the same name
{
  const { data } = await postgrest.from('inference_cases').select('*').single()
  expectType<TypeEqual<NonNullable<typeof data>['note'], string | null>>(true)

  const { data: note } = await postgrest.rpc('note')
  expectType<TypeEqual<typeof note, string | null>>(true)
}

// Views with INSTEAD OF triggers are writable only for the operations they have triggers for
{
  postgrest.from('trigger_writable_view').insert({ username: 'a', status: 'ONLINE' })
  postgrest.from('trigger_writable_view').update({ status: 'OFFLINE' })

  postgrest.from('update_only_trigger_view').update({ status: 'OFFLINE' })
  // A view with only an INSTEAD OF UPDATE trigger cannot be inserted into
  // @ts-expect-error Object literal may only specify known properties, and 'username' does not exist in type 'never[]'.
  postgrest.from('update_only_trigger_view').insert({ username: 'a' })
}

// Materialized views are readable and resolve as rows wherever functions use them
{
  const { data } = await postgrest.from('user_status_counts').select('*')
  expectType<TypeEqual<typeof data, { status: UserStatus | null; total: number | null }[] | null>>(
    true
  )
  // A materialized view cannot be inserted into
  // @ts-expect-error Object literal may only specify known properties, and 'total' does not exist in type 'never[]'.
  postgrest.from('user_status_counts').insert({ total: 1 })
  // A materialized view cannot be updated
  // @ts-expect-error is not assignable to
  postgrest.from('user_status_counts').update({ total: 1 })

  const { data: counts } = await postgrest.rpc('get_user_status_counts')
  expectType<
    TypeEqual<typeof counts, { status: UserStatus | null; total: number | null }[] | null>
  >(true)
  const { data: described } = await postgrest.rpc('describe_status_count', {
    count_row: { status: 'ONLINE', total: 1 },
  })
  expectType<TypeEqual<typeof described, string | null>>(true)
}

// Foreign tables resolve as rows in select, argument and return positions
{
  const { data } = await postgrest.from('remote_users').select('*')
  expectType<TypeEqual<typeof data, { status: UserStatus | null; username: string }[] | null>>(true)

  const { data: remote } = await postgrest.rpc('get_remote_users')
  expectType<TypeEqual<typeof remote, { status: UserStatus | null; username: string }[] | null>>(
    true
  )
  const { data: described } = await postgrest.rpc('describe_remote_user', {
    remote_row: { username: 'a', status: null },
  })
  expectType<TypeEqual<typeof described, string | null>>(true)
  // A foreign table row argument checks its column types
  // @ts-expect-error Type 'number' is not assignable to type 'string'.
  postgrest.rpc('describe_remote_user', { remote_row: { username: 1, status: null } })
}

// Functions and relationships across schemas
{
  const { data: personalUsers } = await postgrest.rpc('get_personal_users')
  type PersonalUser = NonNullable<typeof personalUsers>[number]
  expectType<TypeEqual<'catchphrase' extends keyof PersonalUser ? true : false, false>>(true)
  expectType<TypeEqual<PersonalUser['username'], string>>(true)

  const { data: note } = await postgrest
    .schema('personal')
    .from('user_notes')
    .select('note, users(username)')
    .single()
  expectType<TypeEqual<typeof note, { note: string; users: { username: string } | null } | null>>(
    true
  )

  // PostgREST does not embed through a foreign key into another schema
  const { data: crossSchema } = await postgrest
    .schema('personal')
    .from('user_notes')
    .select('note, users!user_notes_author_fkey(username)')
    .single()
  type CrossSchemaEmbed = NonNullable<typeof crossSchema>['users']
  expectType<CrossSchemaEmbed extends SelectQueryError<string> ? true : false>(true)
}
