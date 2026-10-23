import { PostgrestClient } from '../src/index'

const postgrest = new PostgrestClient('http://localhost:54321/rest/v1')

test('quotes every string element in contains/containedBy/overlaps', () => {
  const contains: any = postgrest.from('t').select().contains('tags', ['Doe, John', 'admin'])
  expect(contains.url.searchParams.get('tags')).toBe('cs.{"Doe, John","admin"}')

  const containedBy: any = postgrest.from('t').select().containedBy('tags', ['a,b', 'c'])
  expect(containedBy.url.searchParams.get('tags')).toBe('cd.{"a,b","c"}')

  const overlaps: any = postgrest.from('t').select().overlaps('tags', ['x"y', 'z'])
  expect(overlaps.url.searchParams.get('tags')).toBe('ov.{"x\\"y","z"}')

  const numbers: any = postgrest.from('t').select().contains('nums', [1, 2, 3])
  expect(numbers.url.searchParams.get('nums')).toBe('cs.{1,2,3}')
})

test('quotes an empty string and the literal word null so they are not read back as SQL NULL', () => {
  const q: any = postgrest.from('t').select().contains('tags', ['', 'null'])
  expect(q.url.searchParams.get('tags')).toBe('cs.{"","null"}')
})

test('quotes every pattern in likeAllOf/likeAnyOf/ilikeAllOf/ilikeAnyOf', () => {
  const likeAll: any = postgrest.from('t').select().likeAllOf('name', ['%a,b%', 'c'])
  expect(likeAll.url.searchParams.get('name')).toBe('like(all).{"%a,b%","c"}')

  const likeAny: any = postgrest.from('t').select().likeAnyOf('name', ['%a,b%', 'c'])
  expect(likeAny.url.searchParams.get('name')).toBe('like(any).{"%a,b%","c"}')

  const ilikeAll: any = postgrest.from('t').select().ilikeAllOf('name', ['%a,b%', 'c'])
  expect(ilikeAll.url.searchParams.get('name')).toBe('ilike(all).{"%a,b%","c"}')

  const ilikeAny: any = postgrest.from('t').select().ilikeAnyOf('name', ['%a,b%', 'c'])
  expect(ilikeAny.url.searchParams.get('name')).toBe('ilike(any).{"%a,b%","c"}')
})
