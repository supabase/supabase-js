import { PostgrestQueryBuilder } from '@supabase/postgrest-js'
import { SupabaseQueryBuilder } from '../src/lib/SupabaseQueryBuilder'
import { Fetch, GenericObject, SupabaseEventTypes, SupabaseRealtimePayload } from '../src/lib/types'

const URL = 'http://localhost:3000'
const SETTINGS: {
  headers?: GenericObject
  schema: string
  realtime: any
  table: string
  fetch?: Fetch
} = {
  headers: { 'X-API-Key': '123' },
  schema: 'public',
  realtime: { connect: jest.fn() },
  table: 'users',
  fetch: jest.fn(),
}

test('it should create a new instance of the class', () => {
  const supabaseQueryBuilder = new SupabaseQueryBuilder(URL, SETTINGS)
  expect(supabaseQueryBuilder).toBeInstanceOf(PostgrestQueryBuilder)

  expect(typeof supabaseQueryBuilder.on).toBe('function')
})
