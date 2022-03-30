import { createClient, SupabaseClient } from '../src/index'
import { DEFAULT_HEADERS } from '../src/lib/constants'

const URL = 'http://localhost:3000'
const KEY = 'some.fake.key'

const supabase = createClient(URL, KEY)

test('it should create the client connection', async () => {
  expect(supabase).toBeDefined()
  expect(supabase).toBeInstanceOf(SupabaseClient)
})

test('it should throw an error if no valid params are provided', async () => {
  expect(() => createClient('', KEY)).toThrowError('supabaseUrl is required.')
  expect(() => createClient(URL, '')).toThrowError('supabaseKey is required.')
})

test('it should not cache Authorization header', async () => {
  const checkHeadersSpy = jest.spyOn(SupabaseClient.prototype as any, '_getAuthHeaders')

  supabase.auth.setAuth('token1')
  supabase.rpc('') // Calling public method `rpc` calls private method _getAuthHeaders which result we want to test
  supabase.auth.setAuth('token2')
  supabase.rpc('') // Calling public method `rpc` calls private method _getAuthHeaders which result we want to test

  expect(checkHeadersSpy.mock.results[0].value).toHaveProperty('Authorization', 'Bearer token1')
  expect(checkHeadersSpy.mock.results[1].value).toHaveProperty('Authorization', 'Bearer token2')
})

describe('Custom Headers', () => {
  test('should have custom header set', () => {
    const customHeader = { 'X-Test-Header': 'value' }

    const checkHeadersSpy = jest.spyOn(SupabaseClient.prototype as any, '_getAuthHeaders')
    createClient(URL, KEY, { headers: customHeader }).rpc('') // Calling public method `rpc` calls private method _getAuthHeaders which result we want to test
    const getHeaders = checkHeadersSpy.mock.results[0].value

    expect(checkHeadersSpy).toBeCalled()
    expect(getHeaders).toHaveProperty('X-Test-Header', 'value')
  })

  test('should allow custom Authorization header', () => {
    const customHeader = { Authorization: 'Bearer custom_token' }
    supabase.auth.setAuth('override_me')
    const checkHeadersSpy = jest.spyOn(SupabaseClient.prototype as any, '_getAuthHeaders')
    createClient(URL, KEY, { headers: customHeader }).rpc('') // Calling public method `rpc` calls private method _getAuthHeaders which result we want to test
    const getHeaders = checkHeadersSpy.mock.results[0].value

    expect(checkHeadersSpy).toBeCalled()
    expect(getHeaders).toHaveProperty('Authorization', 'Bearer custom_token')
  })
})

// Socket should close when there are no open connections
// https://github.com/supabase/supabase-js/issues/44

// Should throw an error when the URL and KEY isn't provided
// https://github.com/supabase/supabase-js/issues/49
