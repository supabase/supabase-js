import { PostgrestClient } from '../src/index'

const postgrest = new PostgrestClient('http://localhost:3000')

test('order', async () => {
  const res = await postgrest.from('users').select().order('username', { ascending: false })
  expect(res).toMatchSnapshot()
})

test('order on multiple columns', async () => {
  const res = await postgrest
    .from('messages')
    .select()
    .order('channel_id', { ascending: false })
    .order('username', { ascending: false })
  expect(res).toMatchSnapshot()
})

test('limit', async () => {
  const res = await postgrest.from('users').select().limit(1)
  expect(res).toMatchSnapshot()
})

test('range', async () => {
  const res = await postgrest.from('users').select().range(1, 3)
  expect(res).toMatchSnapshot()
})

test('single', async () => {
  const res = await postgrest.from('users').select().limit(1).single()
  expect(res).toMatchSnapshot()
})

test('single on insert', async () => {
  const res = await postgrest.from('users').insert({ username: 'foo' }).single()
  expect(res).toMatchSnapshot()

  await postgrest.from('users').delete().eq('username', 'foo')
})

test('maybeSingle', async () => {
  const res = await postgrest.from('users').select().eq('username', 'goldstein').maybeSingle()
  expect(res).toMatchSnapshot()
})

test('select on insert', async () => {
  const res = await postgrest.from('users').insert({ username: 'foo' }).select('status')
  expect(res).toMatchSnapshot()

  await postgrest.from('users').delete().eq('username', 'foo')
})

test('select on stored procedure', async () => {
  const res = await postgrest
    .rpc('get_username_and_status', { name_param: 'supabot' })
    .select('status')
  expect(res).toMatchSnapshot()
})
