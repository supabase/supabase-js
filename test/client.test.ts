import { createClient, SupabaseClient } from '../src/index'

const URL = 'http://localhost:3000'
const VALID_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTYzNTk4NjQxMCwiZXhwIjoxOTUxNTYyNDEwfQ.-uF_c2AEivd8BeMFPDXdCZO12ir61Qvb0jvw4Tm1Z1A'
const INVALID_KEY = 'some.fake.key'
const MALFORMED_KEY = 'helloworld'
const EXPIRED_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MCwiZXhwIjoxfQ.9RFgd6Co8tRYSzBhjPbe9WgJW2HmHHYmV0LZVhfvFus'

const supabase = createClient(URL, VALID_KEY)

test('it should create the client connection', async () => {
  expect(supabase).toBeDefined()
  expect(supabase).toBeInstanceOf(SupabaseClient)
})

test('it should throw an error if no valid params are provided', async () => {
  expect(() => createClient('', VALID_KEY)).toThrowError('supabaseUrl is required.')
  expect(() => createClient(URL, '')).toThrowError('supabaseKey is required.')
})

test('it should throw an error if the JWT is invalid', async () => {
  expect(() => createClient(URL, INVALID_KEY)).toThrowError('Invalid JWT - JSON not valid.')
})

test('it should throw an error if the JWT is malformed', async () => {
  expect(() => createClient(URL, MALFORMED_KEY)).toThrowError('Invalid JWT - Malformed token.')
})

test('it should throw an error if the JWT is expired', async () => {
  expect(() => createClient(URL, EXPIRED_KEY)).toThrowError(
    'supabaseKey must have a future expiry date.'
  )
})

// Socket should close when there are no open connections
// https://github.com/supabase/supabase-js/issues/44

// Should throw an error when the URL and KEY isn't provided
// https://github.com/supabase/supabase-js/issues/49
