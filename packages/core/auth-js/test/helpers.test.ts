import { stackGuard, isInStackGuard, parseParametersFromURL } from '../src/lib/helpers'

describe('stackGuard and isInStackGuard', () => {
  it('should detect that a nested function is in a stack guard', async () => {
    let result: boolean | null = null

    const nested = async () => {
      result = isInStackGuard('TEST')
    }

    await stackGuard('TEST', async () => {
      await nested()
    })

    expect(result).toBe(true)
  })

  it('should not detect that a nested function is in a stack guard', async () => {
    let result: boolean | null = null

    const nested = async () => {
      result = isInStackGuard('TEST')
    }

    await stackGuard('DIFFERENT', async () => {
      await nested()
    })

    expect(result).toBe(false)
  })

  it('should not detect that a function called outside a stack guard is in one', async () => {
    let result: boolean | null = null

    const nested = async () => {
      result = isInStackGuard('TEST')
    }

    await stackGuard('TEST', async () => {
      // not calling nested
    })

    await nested()

    expect(result).toBe(false)
  })
})

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
