import { postgrest } from '../relationships'
import { Database } from '../types'
import { expectType } from 'tsd'
import { TypeEqual } from 'ts-expect'

// rpc call result in the proper type
{
  const { data } = await postgrest.rpc('get_username_and_status').select().single()
  let result: Exclude<typeof data, null>
  let expected: Database['public']['Functions']['get_username_and_status']['Returns'][number]
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// select on an rpc call
{
  const { data, error } = await postgrest.rpc('get_username_and_status').select('username')
  if (error) throw error
  expectType<{ username: string }[]>(data)
}
