import { PostgrestClient } from '../src/index'

const postgrest = new PostgrestClient('http://localhost:54321/rest/v1')

const search = (builder: unknown) => decodeURIComponent((builder as { url: URL }).url.search)

describe('filter value escaping', () => {
  test('in() escapes double quotes and backslashes inside quoted values', () => {
    const q = postgrest.from('t').select('*').in('name', ['x,"y', 'C:\\dir(1)', 'plain'])
    expect(search(q)).toBe('?select=*&name=in.("x,\\"y","C:\\\\dir(1)",plain)')
  })

  test('notIn() escapes the same way', () => {
    const q = postgrest.from('t').select('*').notIn('name', ['a"b'])
    expect(search(q)).toBe('?select=*&name=not.in.("a\\"b")')
  })

  test('contains() quotes array elements that contain reserved characters', () => {
    const q = postgrest.from('t').select('*').contains('tags', ['a,b', 'c', 'a"b'])
    expect(search(q)).toBe('?select=*&tags=cs.{"a,b",c,"a\\"b"}')
  })

  test('containedBy() quotes array elements that contain reserved characters', () => {
    const q = postgrest.from('t').select('*').containedBy('tags', ['a,b', 'c'])
    expect(search(q)).toBe('?select=*&tags=cd.{"a,b",c}')
  })

  test('overlaps() quotes array elements that contain reserved characters', () => {
    const q = postgrest.from('t').select('*').overlaps('tags', ['a,b', 'c'])
    expect(search(q)).toBe('?select=*&tags=ov.{"a,b",c}')
  })

  test('values without reserved characters are left unquoted', () => {
    const q = postgrest.from('t').select('*').in('status', ['ONLINE', 'OFFLINE'])
    expect(search(q)).toBe('?select=*&status=in.(ONLINE,OFFLINE)')
  })
})
