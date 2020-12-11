import { PostgrestClient } from '../src/index'

const postgrest = new PostgrestClient('http://localhost:3000')

test('embedded select', async () => {
  const res = await postgrest.from('users').select('messages(*)')
  expect(res).toMatchSnapshot()
})

describe('embedded filters', () => {
  // TODO: Test more filters
  test('embedded eq', async () => {
    const res = await postgrest.from('users').select('messages(*)').eq('messages.channel_id', 1)
    expect(res).toMatchSnapshot()
  })
})

describe('embedded transforms', () => {
  test('embedded order', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .order('channel_id', { foreignTable: 'messages', ascending: false })
    expect(res).toMatchSnapshot()
  })

  test('embedded limit', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .limit(1, { foreignTable: 'messages' })
    expect(res).toMatchSnapshot()
  })

  test('embedded range', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .range(1, 1, { foreignTable: 'messages' })
    expect(res).toMatchSnapshot()
  })
})
