import { PostgrestClient } from '../src/index'

const postgrest = new PostgrestClient('http://localhost:3000')

test('not', async () => {
  const res = await postgrest.from('users').select().not('status', 'eq', 'OFFLINE')
  expect(res).toMatchSnapshot()
})

test('or', async () => {
  const res = await postgrest.from('users').select().or('status.eq.OFFLINE,username.eq.supabot')
  expect(res).toMatchSnapshot()
})

test('eq', async () => {
  const res = await postgrest.from('users').select().eq('username', 'supabot')
  expect(res).toMatchSnapshot()
})

test('neq', async () => {
  const res = await postgrest.from('users').select().neq('username', 'supabot')
  expect(res).toMatchSnapshot()
})

test('gt', async () => {
  const res = await postgrest.from('messages').select().gt('id', 1)
  expect(res).toMatchSnapshot()
})

test('gte', async () => {
  const res = await postgrest.from('messages').select().gte('id', 1)
  expect(res).toMatchSnapshot()
})

test('lt', async () => {
  const res = await postgrest.from('messages').select().lt('id', 2)
  expect(res).toMatchSnapshot()
})

test('lte', async () => {
  const res = await postgrest.from('messages').select().lte('id', 2)
  expect(res).toMatchSnapshot()
})

test('like', async () => {
  const res = await postgrest.from('users').select().like('username', '%supa%')
  expect(res).toMatchSnapshot()
})

test('ilike', async () => {
  const res = await postgrest.from('users').select().ilike('username', '%SUPA%')
  expect(res).toMatchSnapshot()
})

test('is', async () => {
  const res = await postgrest.from('users').select().is('data', null)
  expect(res).toMatchSnapshot()
})

test('in', async () => {
  const res = await postgrest.from('users').select().in('status', ['ONLINE', 'OFFLINE'])
  expect(res).toMatchSnapshot()
})

test('cs', async () => {
  const res = await postgrest.from('users').select().cs('age_range', '[1,2)')
  expect(res).toMatchSnapshot()
})

test('cd', async () => {
  const res = await postgrest.from('users').select().cd('age_range', '[1,2)')
  expect(res).toMatchSnapshot()
})

test('sl', async () => {
  const res = await postgrest.from('users').select().sl('age_range', '[2,25)')
  expect(res).toMatchSnapshot()
})

test('sr', async () => {
  const res = await postgrest.from('users').select().sr('age_range', '[2,25)')
  expect(res).toMatchSnapshot()
})

test('nxl', async () => {
  const res = await postgrest.from('users').select().nxl('age_range', '[2,25)')
  expect(res).toMatchSnapshot()
})

test('nxr', async () => {
  const res = await postgrest.from('users').select().nxr('age_range', '[2,25)')
  expect(res).toMatchSnapshot()
})

test('adj', async () => {
  const res = await postgrest.from('users').select().adj('age_range', '[2,25)')
  expect(res).toMatchSnapshot()
})

test('ov', async () => {
  const res = await postgrest.from('users').select().ov('age_range', '[2,25)')
  expect(res).toMatchSnapshot()
})

test('fts', async () => {
  const res = await postgrest
    .from('users')
    .select()
    .fts('catchphrase', `'fat' & 'cat'`, { config: 'english' })
  expect(res).toMatchSnapshot()
})

test('plfts', async () => {
  const res = await postgrest
    .from('users')
    .select()
    .plfts('catchphrase', `'fat' & 'cat'`, { config: 'english' })
  expect(res).toMatchSnapshot()
})

test('phfts', async () => {
  const res = await postgrest
    .from('users')
    .select()
    .phfts('catchphrase', 'cat', { config: 'english' })
  expect(res).toMatchSnapshot()
})

test('wfts', async () => {
  const res = await postgrest
    .from('users')
    .select()
    .wfts('catchphrase', `'fat' & 'cat'`, { config: 'english' })
  expect(res).toMatchSnapshot()
})

test('multiple filters', async () => {
  const res = await postgrest
    .from('users')
    .select()
    .eq('username', 'supabot')
    .is('data', null)
    .ov('age_range', '[1,2)')
    .eq('status', 'ONLINE')
    .fts('catchphrase', 'cat')
  expect(res).toMatchSnapshot()
})

test('filter', async () => {
  const res = await postgrest.from('users').select().filter('username', 'eq', 'supabot')
  expect(res).toMatchSnapshot()
})

test('match', async () => {
  const res = await postgrest
    .from('users')
    .select()
    .match({ username: 'supabot', status: 'ONLINE' })
  expect(res).toMatchSnapshot()
})
