import { PostgrestClient } from '../src/index'

// Unit test (custom fetch capture) — the array overloads of contains/containedBy/
// overlaps build a PostgreSQL array literal, so elements containing delimiters,
// quotes, backslashes or whitespace have to be quoted and escaped.
describe('array filter values needing array-literal quoting', () => {
  const REST_URL = 'http://localhost:3000'

  const sentFilter = async (
    build: (client: PostgrestClient<any, any, any>) => PromiseLike<unknown>
  ): Promise<string | null> => {
    const urls: string[] = []
    const fetch = (async (url: string) => {
      urls.push(url)
      return new Response('[]', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof globalThis.fetch
    await build(new PostgrestClient(REST_URL, { fetch }) as PostgrestClient<any, any, any>)
    return new URL(urls[0]).searchParams.get('tags')
  }

  test.each([
    ['a comma', 'a,b', '"a,b"'],
    ['a double quote', 'x"y', '"x\\"y"'],
    ['a backslash', 'e\\f', '"e\\\\f"'],
    ['a brace', 'p{q', '"p{q"'],
    ['whitespace', 'a b', '"a b"'],
    ['nothing', '', '""'],
    ['the word null', 'null', '"null"'],
    ['no reserved character', 'plain', 'plain'],
  ])('contains() quotes an element containing %s', async (_label, input, expected) => {
    expect(await sentFilter((c) => c.from('t').select().contains('tags', [input]))).toBe(
      `cs.{${expected}}`
    )
  })

  test('containedBy() quotes the same way', async () => {
    expect(await sentFilter((c) => c.from('t').select().containedBy('tags', ['a,b']))).toBe(
      'cd.{"a,b"}'
    )
  })

  test('overlaps() quotes the same way', async () => {
    expect(await sentFilter((c) => c.from('t').select().overlaps('tags', ['a,b']))).toBe(
      'ov.{"a,b"}'
    )
  })

  test('non-string elements are left alone', async () => {
    expect(await sentFilter((c) => c.from('t').select().contains('tags', [1, 2]))).toBe('cs.{1,2}')
  })

  test('in() keeps its own quoting rules', async () => {
    // PostgREST's value-list syntax, not an array literal: only `,` `(` `)` need
    // quoting there, and bare quotes are accepted as-is.
    expect(await sentFilter((c) => c.from('t').select().in('tags', ['a,b', 'x"y']))).toBe(
      'in.("a,b",x"y)'
    )
  })
})
