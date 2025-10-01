import { PostgrestClient } from '../../src/index'
import { expectType, TypeEqual } from '../types'

const REST_URL = 'http://localhost:3000'

// Check for PostgrestClient without types provided to the client
{
  const postgrest = new PostgrestClient(REST_URL)
  const { data } = await postgrest.from('user_profile').select()
  expectType<TypeEqual<typeof data, any[] | null>>(true)
}
// basic embeding
{
  const postgrest = new PostgrestClient(REST_URL)
  const { data } = await postgrest
    .from('user_profile')
    .select(
      'user_id, some_embed(*), another_embed(first_field, second_field, renamed:field), aninnerembed!inner(id, name)'
    )
    .single()
  let result: Exclude<typeof data, null>
  let expected: {
    user_id: any
    some_embed: any[]
    another_embed: {
      first_field: any
      second_field: any
      renamed: any
    }[]
    aninnerembed: {
      id: any
      name: any
    }[]
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}
// embeding renaming
{
  const postgrest = new PostgrestClient(REST_URL)
  const { data } = await postgrest
    .from('projects')
    .select('status,service:services(service_api_keys(*))')
    .single()
  let result: Exclude<typeof data, null>
  let expected: {
    status: any
    service: {
      service_api_keys: any[]
    }[]
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}
// spread operator with stars should return any
{
  const postgrest = new PostgrestClient(REST_URL)
  const { data } = await postgrest
    .from('user_profile')
    .select('user_id, some_embed(*), ...spreadstars(*)')
    .single()
  let result: Exclude<typeof data, null>
  let expected: any
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}
// nested spread operator with stars should return any
{
  const postgrest = new PostgrestClient(REST_URL)
  const { data } = await postgrest
    .from('user_profile')
    .select('user_id, some_embed(*), some_other(id, ...spreadstars(*))')
    .single()
  let result: Exclude<typeof data, null>
  let expected: {
    user_id: any
    some_embed: any[]
    some_other: any[]
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}
// rpc without types should raise similar results
{
  const postgrest = new PostgrestClient(REST_URL)
  const { data } = await postgrest.rpc('user_profile').select('user_id, some_embed(*)').single()
  let result: Exclude<typeof data, null>
  let expected: {
    user_id: any
    some_embed: any[]
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}
// check for nested operators
{
  const postgrest = new PostgrestClient(REST_URL)
  const { data } = await postgrest
    .from('user_profile')
    .select(
      'user_id, some_embed(*), another_embed(first_field, second_field, renamed:field), aninnerembed!inner(id, name), ...spreadwithfields(field_spread, another)'
    )
    .single()
  let result: Exclude<typeof data, null>
  let expected: {
    user_id: any
    some_embed: any[]
    another_embed: {
      first_field: any
      second_field: any
      renamed: any
    }[]
    aninnerembed: {
      id: any
      name: any
    }[]
    field_spread: any
    another: any
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}
