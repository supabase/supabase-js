import { PostgrestClient } from '../src/index'

const REST_URL = 'http://localhost:3000'

test('fetch receives headers as plain object', async () => {
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => '{}',
    headers: new Headers(),
  })

  const client = new PostgrestClient(REST_URL, {
    fetch: mockFetch as any,
    headers: { 'X-Custom-Header': 'CustomValue' },
  })

  await client.rpc('test_func')

  expect(mockFetch).toHaveBeenCalledTimes(1)
  const args = mockFetch.mock.calls[0]
  const options = args[1]

  // Verify headers is a plain object and contains expected values
  expect(options.headers).not.toBeInstanceOf(Headers)
  expect(Object.getPrototypeOf(options.headers)).toBe(Object.prototype)
  expect(options.headers['x-custom-header']).toBe('CustomValue')
  expect(options.headers['content-type']).toBe('application/json')
})

test('rpc without params sends empty json body', async () => {
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => '{}',
    headers: new Headers(),
  })

  const client = new PostgrestClient(REST_URL, {
    fetch: mockFetch as any,
  })

  await client.rpc('test_func')

  expect(mockFetch).toHaveBeenCalledTimes(1)
  const args = mockFetch.mock.calls[0]
  const options = args[1]

  expect(options.body).toBe('{}')
})
