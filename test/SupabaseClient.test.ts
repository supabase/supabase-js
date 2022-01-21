import SupabaseClient from '../src/SupabaseClient'

const URL = 'http://localhost:3000'
const KEY = 'some.fake.key'

test('it should have the methods availabe', () => {
  const supabaseClient = new SupabaseClient(URL, KEY, {})

  expect(typeof supabaseClient.storage).toBe('object')
  expect(typeof supabaseClient.from).toBe('function')
  expect(typeof supabaseClient.rpc).toBe('function')
  expect(typeof supabaseClient.removeAllSubscriptions).toBe('function')
  expect(typeof supabaseClient.removeSubscription).toBe('function')
  expect(typeof supabaseClient.getSubscriptions).toBe('function')
})
