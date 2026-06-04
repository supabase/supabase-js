import { PostgrestClient } from '../src/index'

const REST_URL = 'http://localhost:3000'

test('passes headers to fetch as a plain object so custom/polyfilled fetches can read them by key', async () => {
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    text: async () => '{}',
  })

  const client = new PostgrestClient(REST_URL, {
    fetch: mockFetch as any,
    headers: { 'X-Custom-Header': 'CustomValue' },
  })

  await client.rpc('test_func')

  const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
  const headers = options.headers as Record<string, string>

  // Plain-object key access works (would require .get() on a Headers instance).
  // This is what protects React Native's whatwg-fetch polyfill from silently
  // dropping Content-Type and causing PGRST202 on parameter-less RPC calls.
  expect(headers['content-type']).toBe('application/json')
  expect(headers['x-custom-header']).toBe('CustomValue')
  expect(options.body).toBe('{}')
})
