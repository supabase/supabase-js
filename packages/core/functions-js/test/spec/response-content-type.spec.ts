import 'jest'

import { FunctionsClient } from '../../src/index'

/**
 * Unit tests (no relay) for response body parsing based on the response
 * Content-Type header. HTTP media types are case-insensitive (RFC 9110), so the
 * client must match them regardless of casing.
 */
describe('response Content-Type parsing', () => {
  const makeClient = (contentType: string, body: string) => {
    const customFetch = jest.fn(
      async () =>
        new Response(body, {
          status: 200,
          headers: { 'Content-Type': contentType },
        })
    ) as any
    return new FunctionsClient('http://localhost', { customFetch })
  }

  test('parses JSON when Content-Type is lowercase', async () => {
    const client = makeClient('application/json', JSON.stringify({ foo: 'bar' }))
    const { data, error } = await client.invoke('fn', {})
    expect(error).toBeNull()
    expect(data).toEqual({ foo: 'bar' })
  })

  test('parses JSON when Content-Type has mixed casing', async () => {
    const client = makeClient('Application/JSON; charset=utf-8', JSON.stringify({ foo: 'bar' }))
    const { data, error } = await client.invoke('fn', {})
    expect(error).toBeNull()
    expect(data).toEqual({ foo: 'bar' })
  })

  test('parses JSON when Content-Type is uppercase', async () => {
    const client = makeClient('APPLICATION/JSON', JSON.stringify({ foo: 'bar' }))
    const { data, error } = await client.invoke('fn', {})
    expect(error).toBeNull()
    expect(data).toEqual({ foo: 'bar' })
  })

  test('parses a media type using the +json structured syntax suffix', async () => {
    const client = makeClient('application/problem+json', JSON.stringify({ title: 'Not Found' }))
    const { data, error } = await client.invoke('fn', {})
    expect(error).toBeNull()
    expect(data).toEqual({ title: 'Not Found' })
  })

  test('parses a vendor media type using the +json suffix', async () => {
    const client = makeClient(
      'application/vnd.api+json; charset=utf-8',
      JSON.stringify({ data: { id: '1' } })
    )
    const { data, error } = await client.invoke('fn', {})
    expect(error).toBeNull()
    expect(data).toEqual({ data: { id: '1' } })
  })

  test('parses a +json suffix regardless of casing', async () => {
    const client = makeClient('Application/LD+JSON', JSON.stringify({ '@type': 'Thing' }))
    const { data, error } = await client.invoke('fn', {})
    expect(error).toBeNull()
    expect(data).toEqual({ '@type': 'Thing' })
  })

  test('does not treat application/json-seq as a single JSON document', async () => {
    const client = makeClient('application/json-seq', '{"a":1}\n{"a":2}')
    const { data, error } = await client.invoke('fn', {})
    expect(error).toBeNull()
    expect(typeof data).toBe('string')
  })

  test('still falls back to text for an unrelated media type', async () => {
    const client = makeClient('text/plain', 'hello')
    const { data, error } = await client.invoke('fn', {})
    expect(error).toBeNull()
    expect(data).toBe('hello')
  })
})
