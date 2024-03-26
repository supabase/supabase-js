import { parseParametersFromURL, parseResponseAPIVersion } from '../src/lib/helpers'

describe('parseParametersFromURL', () => {
  it('should parse parameters from a URL with query params only', () => {
    const url = new URL('https://supabase.com')
    url.searchParams.set('a', 'b')
    url.searchParams.set('b', 'c')

    const result = parseParametersFromURL(url.href)
    expect(result).toMatchObject({
      a: 'b',
      b: 'c',
    })
  })

  it('should parse parameters from a URL with fragment params only', () => {
    const url = new URL('https://supabase.com')
    const fragmentParams = new URLSearchParams({ a: 'b', b: 'c' })
    url.hash = fragmentParams.toString()

    const result = parseParametersFromURL(url.href)
    expect(result).toMatchObject({
      a: 'b',
      b: 'c',
    })
  })

  it('should parse parameters from a URL with both query params and fragment params', () => {
    const url = new URL('https://supabase.com')
    url.searchParams.set('a', 'b')
    url.searchParams.set('b', 'c')
    url.searchParams.set('x', 'z')

    const fragmentParams = new URLSearchParams({ d: 'e', x: 'y' })
    url.hash = fragmentParams.toString()

    const result = parseParametersFromURL(url.href)
    expect(result).toMatchObject({
      a: 'b',
      b: 'c',
      d: 'e',
      x: 'z', // search params take precedence
    })
  })
})

describe('parseResponseAPIVersion', () => {
  it('should parse valid dates', () => {
    expect(
      parseResponseAPIVersion({
        headers: {
          get: () => {
            return '2024-01-01'
          },
        },
      } as any)
    ).toEqual(new Date('2024-01-01T00:00:00.0Z'))
  })

  it('should return null on invalid dates', () => {
    ;['2024-01-32', '', 'notadate', 'Sat Feb 24 2024 17:59:17 GMT+0100'].forEach((example) => {
      expect(
        parseResponseAPIVersion({
          headers: {
            get: () => {
              return example
            },
          },
        } as any)
      ).toBeNull()
    })
  })
})
