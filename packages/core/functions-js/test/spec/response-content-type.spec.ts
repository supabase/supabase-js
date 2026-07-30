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
})
