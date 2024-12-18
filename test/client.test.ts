import { PostgrestClient } from '@supabase/postgrest-js'
import { createClient, createAdminClient, SupabaseClient } from '../src/index'
import { Database } from './types'

const URL = 'http://localhost:3000'
const KEY = 'some.fake.key'
const FAKE_ADMIN_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogInNlcnZpY2Vfcm9sZSIsCiAgImlzcyI6ICJzdXBhYmFzZSIsCiAgImlhdCI6IDE3MzQ0NzY0MDAsCiAgImV4cCI6IDE4OTIyNDI4MDAKfQ.rasWvv_ZRzGaptpahkSyL9R9L6NuEeCUQ45j6_VfYds'

const supabase = createClient(URL, KEY)

test('it should create a client with third-party auth accessToken', async () => {
  const client = createClient(URL, KEY, {
    accessToken: async () => {
      return 'jwt'
    },
  })

  expect(() => client.auth.getUser()).toThrowError(
    '@supabase/supabase-js: Supabase Client is configured with the accessToken option, accessing supabase.auth.getUser is not possible'
  )
})

// Check that it throws an error if a service key is used
test('createClient() should throw an error if a service key is used', () => {
  expect(() => createClient(URL, FAKE_ADMIN_KEY)).toThrowError(
    'createClient() requires an public API key. You are using an admin key. Admin keys should only be used with createAdminClient().'
  )
})

// Check that it doesn't throw an error if a service key is used
test('createAdminClient() should not throw an error if a service key is used', () => {
  expect(() => createAdminClient(URL, FAKE_ADMIN_KEY)).not.toThrow()
})

test('it should create the client connection', async () => {
  expect(supabase).toBeDefined()
  expect(supabase).toBeInstanceOf(SupabaseClient)
})

test('it should throw an error if no valid params are provided', async () => {
  expect(() => createClient('', KEY)).toThrowError('supabaseUrl is required.')
  expect(() => createClient(URL, '')).toThrowError('supabaseKey is required.')
})

describe('Custom Headers', () => {
  test('should have custom header set', () => {
    const customHeader = { 'X-Test-Header': 'value' }

    const request = createClient(URL, KEY, { global: { headers: customHeader } }).rpc('')

    // @ts-ignore
    const getHeaders = request.headers

    expect(getHeaders).toHaveProperty('X-Test-Header', 'value')
  })
})

describe('Realtime url', () => {
  test('should switch protocol from http to ws', () => {
    const client = createClient('http://localhost:3000', KEY)

    // @ts-ignore
    const realtimeUrl = client.realtimeUrl

    expect(realtimeUrl).toEqual('ws://localhost:3000/realtime/v1')
  })

  test('should switch protocol from https to wss', () => {
    const client = createClient('https://localhost:3000', KEY)

    // @ts-ignore
    const realtimeUrl = client.realtimeUrl

    expect(realtimeUrl).toEqual('wss://localhost:3000/realtime/v1')
  })

  test('should ignore case', () => {
    const client = createClient('HTTP://localhost:3000', KEY)

    // @ts-ignore
    const realtimeUrl = client.realtimeUrl

    expect(realtimeUrl).toEqual('ws://localhost:3000/realtime/v1')
  })
})

describe('Dynamic schema', () => {
  test('should swap schemas', async () => {
    const client = createClient<Database>('HTTP://localhost:3000', KEY)
    expect(client.schema('personal')).toBeInstanceOf(PostgrestClient)
    expect(client.schema('personal').from('users').schema).toBe('personal')
  })
})

// Socket should close when there are no open connections
// https://github.com/supabase/supabase-js/issues/44

// Should throw an error when the URL and KEY isn't provided
// https://github.com/supabase/supabase-js/issues/49
