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

test('contains', async () => {
  const res = await postgrest.from('users').select().contains('age_range', '[1,2)')
  expect(res).toMatchSnapshot()
})

test('containedBy', async () => {
  const res = await postgrest.from('users').select().containedBy('age_range', '[1,2)')
  expect(res).toMatchSnapshot()
})

test('rangeLt', async () => {
  const res = await postgrest.from('users').select().rangeLt('age_range', '[2,25)')
  expect(res).toMatchSnapshot()
})

test('rangeGt', async () => {
  const res = await postgrest.from('users').select().rangeGt('age_range', '[2,25)')
  expect(res).toMatchSnapshot()
})

test('rangeGte', async () => {
  const res = await postgrest.from('users').select().rangeGte('age_range', '[2,25)')
  expect(res).toMatchSnapshot()
})

test('rangeLte', async () => {
  const res = await postgrest.from('users').select().rangeLte('age_range', '[2,25)')
  expect(res).toMatchSnapshot()
})

test('adjacent', async () => {
  const res = await postgrest.from('users').select().adjacent('age_range', '[2,25)')
  expect(res).toMatchSnapshot()
})

test('overlaps', async () => {
  const res = await postgrest.from('users').select().overlaps('age_range', '[2,25)')
  expect(res).toMatchSnapshot()
})

test('textSearch', async () => {
  const res = await postgrest
    .from('users')
    .select()
    .textSearch('catchphrase', `'fat' & 'cat'`, { config: 'english' })
  expect(res).toMatchSnapshot()
})

test('textSearch with plainto_tsquery', async () => {
  const res = await postgrest
    .from('users')
    .select()
    .textSearch('catchphrase', `'fat' & 'cat'`, { config: 'english', type: 'plain' })
  expect(res).toMatchSnapshot()
})

test('textSearch with phraseto_tsquery', async () => {
  const res = await postgrest
    .from('users')
    .select()
    .textSearch('catchphrase', 'cat', { config: 'english', type: 'phrase' })
  expect(res).toMatchSnapshot()
})

test('textSearch with websearch_to_tsquery', async () => {
  const res = await postgrest
    .from('users')
    .select()
    .textSearch('catchphrase', `'fat' & 'cat'`, { config: 'english', type: 'websearch' })
  expect(res).toMatchSnapshot()
})

test('multiple filters', async () => {
  const res = await postgrest
    .from('users')
    .select()
    .eq('username', 'supabot')
    .is('data', null)
    .overlaps('age_range', '[1,2)')
    .eq('status', 'ONLINE')
    .textSearch('catchphrase', 'cat')
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
