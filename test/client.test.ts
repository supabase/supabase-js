import { createClient } from '../src/index'

const URL = 'http://localhost:3000'
const KEY = 'some.fake.key'

const supabase = createClient(URL, KEY)

test('supabase Client', async () => {
  expect(supabase).toMatchSnapshot()
})

test('from()', async () => {
  const builder = supabase.from('table')
  expect(builder).toMatchSnapshot()
})

test('from().select()', async () => {
  const builder = supabase.from('table').select('*')
  expect(builder).toMatchSnapshot()
})

// Socket should close when there are no open connections
// https://github.com/supabase/supabase-js/issues/44

// Should throw an error when the URL and KEY isn't provided
// https://github.com/supabase/supabase-js/issues/49
