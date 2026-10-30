import 'jest'

import { FunctionsClient, FunctionsRelayError } from '../../src/index'

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

  test.each([204, 205])('returns success for a bodyless %i JSON response', async (status) => {
    const response = new Response(null, {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
    const client = new FunctionsClient('http://localhost', {
      customFetch: jest.fn(async () => response),
    })

    const result = await client.invoke('fn', { method: 'DELETE' })

    expect(result.error).toBeNull()
    expect(result.data).toBeNull()
    expect(result.response).toBe(response)
  })

  test.each([204, 205])('returns success for a bodyless %i multipart response', async (status) => {
    const response = new Response(null, {
      status,
      headers: { 'Content-Type': 'multipart/form-data; boundary=test' },
    })
    const client = new FunctionsClient('http://localhost', {
      customFetch: jest.fn(async () => response),
    })

    const result = await client.invoke('fn')

    expect(result.error).toBeNull()
    expect(result.data).toBeNull()
    expect(result.response).toBe(response)
  })

  test.each(['', '{invalid'])('keeps errors for an invalid 200 JSON body: %j', async (body) => {
    const client = makeClient('application/json', body)

    const { data, error } = await client.invoke('fn')

    expect(data).toBeNull()
    expect(error).toMatchObject({ name: 'SyntaxError' })
  })

  test.each([204, 205])('keeps an empty text result for status %i', async (status) => {
    const response = new Response(null, { status })
    const client = new FunctionsClient('http://localhost', {
      customFetch: jest.fn(async () => response),
    })

    const result = await client.invoke('fn')

    expect(result.error).toBeNull()
    expect(result.data).toBe('')
    expect(result.response).toBe(response)
  })

  test.each([204, 205])('keeps an empty Blob result for status %i', async (status) => {
    const response = new Response(null, {
      status,
      headers: { 'Content-Type': 'application/octet-stream' },
    })
    const client = new FunctionsClient('http://localhost', {
      customFetch: jest.fn(async () => response),
    })

    const result = await client.invoke('fn')

    expect(result.error).toBeNull()
    expect(result.data.size).toBe(0)
    expect(result.response).toBe(response)
  })

  test('keeps relay errors for a bodyless response', async () => {
    const response = new Response(null, {
      status: 204,
      headers: { 'Content-Type': 'application/json', 'x-relay-error': 'true' },
    })
    const client = new FunctionsClient('http://localhost', {
      customFetch: jest.fn(async () => response),
    })

    const result = await client.invoke('fn')

    expect(result.data).toBeNull()
    expect(result.error).toBeInstanceOf(FunctionsRelayError)
    expect(result.response).toBe(response)
  })
})
