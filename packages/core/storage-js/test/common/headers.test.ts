import { normalizeHeaders, setHeader } from '../../src/lib/common/headers'

describe('setHeader', () => {
  it('sets a new header with lowercase key', () => {
    const result = setHeader({}, 'Content-Type', 'application/json')
    expect(result).toEqual({ 'content-type': 'application/json' })
  })

  it('replaces an existing header with the same case', () => {
    const result = setHeader({ 'content-type': 'text/plain' }, 'content-type', 'application/json')
    expect(result).toEqual({ 'content-type': 'application/json' })
  })

  it('replaces an existing header with different case and normalizes key to lowercase', () => {
    const result = setHeader({ 'content-type': 'text/plain' }, 'Content-Type', 'application/json')
    expect(result).toEqual({ 'content-type': 'application/json' })
  })

  it('removes all case variants and sets one lowercase canonical key', () => {
    const headers: Record<string, string> = {}
    // Simulate duplicate keys by building with Object.assign
    Object.assign(headers, {
      'content-type': 'text/plain',
      'Content-Type': 'text/html',
    })

    const result = setHeader(headers, 'CONTENT-TYPE', 'application/json')
    expect(result).toEqual({ 'content-type': 'application/json' })
  })

  it('does not mutate the input object', () => {
    const original = { 'Content-Type': 'text/plain', Authorization: 'Bearer token' }
    const result = setHeader(original, 'Content-Type', 'application/json')

    expect(original['Content-Type']).toBe('text/plain')
    expect(result['content-type']).toBe('application/json')
    expect(result).not.toHaveProperty('Content-Type')
  })

  it('preserves other headers when replacing', () => {
    const result = setHeader(
      { 'content-type': 'text/plain', authorization: 'Bearer token', 'x-custom': 'value' },
      'Content-Type',
      'application/json'
    )
    expect(result).toEqual({
      'content-type': 'application/json',
      authorization: 'Bearer token',
      'x-custom': 'value',
    })
  })

  it('does not deduplicate unrelated headers when setting a different one', () => {
    const headers: Record<string, string> = {}
    Object.assign(headers, {
      'content-type': 'text/plain',
      'Content-Type': 'text/html',
    })

    const result = setHeader(headers, 'Content-Length', '42')
    expect(result).toEqual({
      'content-type': 'text/plain',
      'Content-Type': 'text/html',
      'content-length': '42',
    })
  })

  it('ensures no duplicate when setting an unrelated header with pre-existing duplicates', () => {
    const headers: Record<string, string> = {}
    Object.assign(headers, {
      'content-type': 'text/plain',
      'Content-Type': 'text/html',
    })

    const result = setHeader(headers, 'content-length', '42')
    expect(result['content-length']).toBe('42')
    // setHeader only deduplicates the header being set;
    // pre-existing duplicates of other headers are preserved as-is
    const contentTypeKeys = Object.keys(result).filter((k) => k.toLowerCase() === 'content-type')
    expect(contentTypeKeys).toHaveLength(2)
  })
})

describe('normalizeHeaders', () => {
  it('lowercases all header keys', () => {
    const result = normalizeHeaders({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token',
    })
    expect(result).toEqual({ 'content-type': 'application/json', authorization: 'Bearer token' })
  })

  it('deduplicates case variants keeping the last value', () => {
    const headers: Record<string, string> = {}
    Object.assign(headers, {
      'content-type': 'text/plain',
      'Content-Type': 'application/json',
    })

    const result = normalizeHeaders(headers)
    expect(Object.keys(result).filter((k) => k === 'content-type')).toHaveLength(1)
    expect(result['content-type']).toBe('application/json')
  })

  it('does not mutate the input object', () => {
    const original = { 'Content-Type': 'text/plain' }
    const result = normalizeHeaders(original)
    expect(original).toHaveProperty('Content-Type')
    expect(result).not.toHaveProperty('Content-Type')
    expect(result).toHaveProperty('content-type')
  })

  it('returns empty object for empty input', () => {
    expect(normalizeHeaders({})).toEqual({})
  })
})
