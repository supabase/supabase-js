import { PostgrestClient } from '../src/index'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient(REST_URL)

test('basic select table', async () => {
  const res = await postgrest.from('users').select()
  expect(res).toMatchSnapshot()
})

test('stored procedure', async () => {
  const res = await postgrest.rpc('get_status', { name_param: 'supabot' })
  expect(res).toMatchSnapshot()
})

test('custom headers', async () => {
  const postgrest = new PostgrestClient(REST_URL, { headers: { apikey: 'foo' } })
  expect(postgrest.from('users').select().headers['apikey']).toEqual('foo')
})

test('auth', async () => {
  const postgrest = new PostgrestClient(REST_URL).auth('foo')
  expect(postgrest.from('users').select().headers['Authorization']).toEqual('Bearer foo')
})

test('switch schema', async () => {
  const postgrest = new PostgrestClient(REST_URL, { schema: 'personal' })
  const res = await postgrest.from('users').select()
  expect(res).toMatchSnapshot()
})

describe('basic insert, update, delete', () => {
  test('basic insert', async () => {
    let res = await postgrest
      .from('messages')
      .insert({ message: 'foo', username: 'supabot', channel_id: 1 })
    expect(res).toMatchSnapshot()

    res = await postgrest.from('messages').select()
    expect(res).toMatchSnapshot()
  })

  test('upsert', async () => {
    let res = await postgrest
      .from('messages')
      .insert({ id: 3, message: 'foo', username: 'supabot', channel_id: 2 }, { upsert: true })
    expect(res).toMatchSnapshot()

    res = await postgrest.from('messages').select()
    expect(res).toMatchSnapshot()
  })

  test('bulk insert', async () => {
    let res = await postgrest.from('messages').insert([
      { message: 'foo', username: 'supabot', channel_id: 1 },
      { message: 'foo', username: 'supabot', channel_id: 1 },
    ])
    expect(res).toMatchSnapshot()

    res = await postgrest.from('messages').select()
    expect(res).toMatchSnapshot()
  })

  test('basic update', async () => {
    let res = await postgrest.from('messages').update({ channel_id: 2 }).eq('message', 'foo')
    expect(res).toMatchSnapshot()

    res = await postgrest.from('messages').select()
    expect(res).toMatchSnapshot()
  })

  test('basic delete', async () => {
    let res = await postgrest.from('messages').delete().eq('message', 'foo')
    expect(res).toMatchSnapshot()

    res = await postgrest.from('messages').select()
    expect(res).toMatchSnapshot()
  })
})

test('missing table', async () => {
  const res = await postgrest.from('missing_table').select()
  expect(res).toMatchSnapshot()
})

test('connection error', async () => {
  const postgrest = new PostgrestClient('http://this.url.does.not.exist')
  let isErrorCaught = false
  await postgrest
    .from('user')
    .select()
    .then(undefined, () => {
      isErrorCaught = true
    })
  expect(isErrorCaught).toBe(true)
})

test('custom type', async () => {
  interface User {
    username: string
    data: object | null
    age_range: string | null
    status: 'ONLINE' | 'OFFLINE'
    catchphrase: 'string' | null
  }

  // TODO: Find a cleaner way to weave a custom type
  // eq should show User's properties in LSP/IntelliSense
  const { data: users } = <{ data: User[] }>(
    await postgrest.from<User>('users').select().eq('username', 'supabot')
  )
  const user = users[0]
  // Autocomplete should show properties of user after '.'
  user.username
})
