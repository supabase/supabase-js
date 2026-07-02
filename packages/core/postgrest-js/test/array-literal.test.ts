import { PostgrestClient } from '../src/index'

const postgrest = new PostgrestClient('http://localhost:54321/rest/v1')

test('quotes array elements with reserved characters in contains/containedBy/overlaps', () => {
  const contains: any = postgrest.from('t').select().contains('tags', ['Doe, John', 'admin'])
  expect(contains.url.searchParams.get('tags')).toBe('cs.{"Doe, John",admin}')

  const containedBy: any = postgrest.from('t').select().containedBy('tags', ['a,b', 'c'])
  expect(containedBy.url.searchParams.get('tags')).toBe('cd.{"a,b",c}')

  const overlaps: any = postgrest.from('t').select().overlaps('tags', ['x"y', 'z'])
  expect(overlaps.url.searchParams.get('tags')).toBe('ov.{"x\\"y",z}')

  const numbers: any = postgrest.from('t').select().contains('nums', [1, 2, 3])
  expect(numbers.url.searchParams.get('nums')).toBe('cs.{1,2,3}')
})
