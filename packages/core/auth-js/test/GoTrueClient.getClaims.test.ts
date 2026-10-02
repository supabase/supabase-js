import GoTrueClient from '../src/GoTrueClient'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'

const b64 = (value: string) => Buffer.from(value).toString('base64url')

describe('GoTrueClient getClaims with a malformed JWT', () => {
  test.each([
    [
      'a header that is not JSON',
      `${b64('not json')}.${b64('{}')}.c2ln`,
      'JWT header or payload is not valid JSON',
    ],
    [
      'a payload that is not JSON',
      `${b64('{"alg":"HS256"}')}.${b64('{bad')}.c2ln`,
      'JWT header or payload is not valid JSON',
    ],
    [
      'a null payload',
      `${b64('{"alg":"HS256"}')}.${b64('null')}.c2ln`,
      'JWT header or payload is not a JSON object',
    ],
  ])('returns AuthInvalidJwtError instead of throwing for %s', async (_case, token, message) => {
    const mockFetch = jest.fn()
    const client = new GoTrueClient({
      url: 'http://localhost:9999',
      storage: memoryLocalStorageAdapter({}),
      fetch: mockFetch,
      autoRefreshToken: false,
      persistSession: false,
    })

    const { data, error } = await client.getClaims(token)

    expect(data).toBeNull()
    expect(error?.name).toBe('AuthInvalidJwtError')
    expect(error?.code).toBe('invalid_jwt')
    expect(error?.message).toBe(message)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
