import { PostgrestClient } from '../src/index'
import { Database } from './types.override'

describe('URL Sanitization', () => {
  test('from() should remove leading slashes from relation names', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => [],
      text: async () => '[]',
    })

    const postgrest = new PostgrestClient<Database>('https://example.com', {
      fetch: mockFetch as any,
    })

    // Passing a relation with a leading slash
    await postgrest.from('/users' as any).select()

    const [url] = mockFetch.mock.calls[0]
    // Verify it produced a clean URL without a double slash
    expect(url.toString()).toContain('example.com/users')
    expect(url.toString()).not.toContain('example.com//users')
  })

  test('rpc() should remove leading slashes from function names', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => [],
      text: async () => '[]',
    })

    const postgrest = new PostgrestClient<Database>('https://example.com', {
      fetch: mockFetch as any,
    })

    // Passing a function name with a leading slash
    await postgrest.rpc('/my_function' as any)

    const [url] = mockFetch.mock.calls[0]
    // Verify it produced a clean /rpc/my_function path
    expect(url.toString()).toContain('example.com/rpc/my_function')
    expect(url.toString()).not.toContain('example.com/rpc//my_function')
  })
})
