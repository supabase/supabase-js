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
