import { postgrest, selectParams, RPC_NAME } from '../rpc'
import { Database } from '../types'
import { expectType } from 'tsd'
import { TypeEqual } from 'ts-expect'

// RPC call with no params
{
  const { data } = await postgrest.rpc(RPC_NAME, { name_param: 'supabot' }).select()
  let result: Exclude<typeof data, null>
  let expected: Database['public']['Functions'][typeof RPC_NAME]['Returns']
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// RPC call with star select
{
  const { data } = await postgrest
    .rpc(RPC_NAME, { name_param: 'supabot' })
    .select(selectParams.starSelect)
  let result: Exclude<typeof data, null>
  let expected: Database['public']['Functions'][typeof RPC_NAME]['Returns']
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// RPC call with single field select
{
  const { data } = await postgrest
    .rpc(RPC_NAME, { name_param: 'supabot' })
    .select(selectParams.fieldSelect)
  let result: Exclude<typeof data, null>
  let expected: { username: string }[]
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// RPC call with multiple fields select
{
  const { data } = await postgrest
    .rpc(RPC_NAME, { name_param: 'supabot' })
    .select(selectParams.fieldsSelect)
  let result: Exclude<typeof data, null>
  let expected: Database['public']['Functions'][typeof RPC_NAME]['Returns']
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// RPC call with field aliasing
{
  const { data } = await postgrest
    .rpc(RPC_NAME, { name_param: 'supabot' })
    .select(selectParams.fieldAliasing)
  let result: Exclude<typeof data, null>
  let expected: { name: string }[]
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// RPC call with field casting
{
  const { data } = await postgrest
    .rpc(RPC_NAME, { name_param: 'supabot' })
    .select(selectParams.fieldCasting)
  let result: Exclude<typeof data, null>
  let expected: { status: string }[]
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// RPC call with field aggregate
{
  const { data } = await postgrest
    .rpc(RPC_NAME, { name_param: 'supabot' })
    .select(selectParams.fieldAggregate)
  let result: Exclude<typeof data, null>
  let expected: { count: number; status: 'ONLINE' | 'OFFLINE' }[]
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}
