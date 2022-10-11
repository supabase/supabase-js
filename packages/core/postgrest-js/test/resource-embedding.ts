import { PostgrestClient } from '../src/index'
import { Database } from './types'

const postgrest = new PostgrestClient<Database>('http://localhost:3000')

test('embedded select', async () => {
  const res = await postgrest.from('users').select('messages(*)')
  expect(res).toMatchSnapshot()
})

describe('embedded filters', () => {
  // TODO: Test more filters
  test('embedded eq', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .eq('messages.channel_id' as any, 1)
    expect(res).toMatchSnapshot()
  })
  test('embedded or', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .or('channel_id.eq.2,message.eq.Hello World 👋', { foreignTable: 'messages' })
    expect(res).toMatchSnapshot()
  })
  test('embedded or with and', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .or('channel_id.eq.2,and(message.eq.Hello World 👋,username.eq.supabot)', {
        foreignTable: 'messages',
      })
    expect(res).toMatchSnapshot()
  })
})

describe('embedded transforms', () => {
  test('embedded order', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .order('channel_id' as any, { foreignTable: 'messages', ascending: false })
    expect(res).toMatchSnapshot()
  })

  test('embedded order on multiple columns', async () => {
    const res = await postgrest
      .from('users')
      .select('messages(*)')
      .order('channel_id' as any, { foreignTable: 'messages', ascending: false })
      .order('username', { foreignTable: 'messages', ascending: false })
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
