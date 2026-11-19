import { PostgrestClient } from '../src/index'
import type { MaxAffectedEnabled, SpreadOnManyEnabled } from '../src/types/feature-flags'
import { InvalidMethodError } from '../src/PostgrestFilterBuilder'
import { Database } from './types.override'
import { expectType, TypeEqual } from './types'

const REST_URL = 'http://localhost:54321/rest/v1'

// Versions without the 13+ features: unset, 12 and older, or not a version.
{
  expectType<TypeEqual<MaxAffectedEnabled<undefined>, false>>(true)
  expectType<TypeEqual<MaxAffectedEnabled<string>, false>>(true)
  expectType<TypeEqual<MaxAffectedEnabled<'12'>, false>>(true)
  expectType<TypeEqual<MaxAffectedEnabled<'12.2.3'>, false>>(true)
  expectType<TypeEqual<MaxAffectedEnabled<'11.2.2'>, false>>(true)
  expectType<TypeEqual<MaxAffectedEnabled<'10'>, false>>(true)
  expectType<TypeEqual<MaxAffectedEnabled<'9.0.1'>, false>>(true)
  expectType<TypeEqual<MaxAffectedEnabled<'1'>, false>>(true)
  expectType<TypeEqual<MaxAffectedEnabled<''>, false>>(true)
  expectType<TypeEqual<MaxAffectedEnabled<'latest'>, false>>(true)
  expectType<TypeEqual<SpreadOnManyEnabled<'12.2.3'>, false>>(true)
}

// 13 and every later major, with or without minor / patch.
{
  expectType<TypeEqual<MaxAffectedEnabled<'13'>, true>>(true)
  expectType<TypeEqual<MaxAffectedEnabled<'13.0.5'>, true>>(true)
  expectType<TypeEqual<MaxAffectedEnabled<'14.1'>, true>>(true)
  expectType<TypeEqual<MaxAffectedEnabled<'15'>, true>>(true)
  expectType<TypeEqual<MaxAffectedEnabled<'16.5'>, true>>(true)
  expectType<TypeEqual<MaxAffectedEnabled<'20.0.0'>, true>>(true)
  expectType<TypeEqual<MaxAffectedEnabled<'100'>, true>>(true)
  expectType<TypeEqual<SpreadOnManyEnabled<'15.0.1'>, true>>(true)
  expectType<TypeEqual<SpreadOnManyEnabled<'16'>, true>>(true)
}

// Through the client: PostgrestVersion '16.5' unlocks maxAffected, '12' doesn't.
{
  const postgrest16 = new PostgrestClient<Database, { PostgrestVersion: '16.5' }>(REST_URL)
  const update16 = postgrest16
    .from('messages')
    .update({ message: 'foo' })
    .eq('message', 'bar')
    .maxAffected(1)
  expectType<
    TypeEqual<
      typeof update16,
      InvalidMethodError<'maxAffected method only available on postgrest 13+'>
    >
  >(false)

  const postgrest12 = new PostgrestClient<Database, { PostgrestVersion: '12' }>(REST_URL)
  const update12 = postgrest12
    .from('messages')
    .update({ message: 'foo' })
    .eq('message', 'bar')
    .maxAffected(1)
  expectType<
    TypeEqual<
      typeof update12,
      InvalidMethodError<'maxAffected method only available on postgrest 13+'>
    >
  >(true)
}
