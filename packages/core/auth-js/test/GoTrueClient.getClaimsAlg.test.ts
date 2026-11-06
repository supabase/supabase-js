import GoTrueClient from '../src/GoTrueClient'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'

const b64 = (value: string) => Buffer.from(value).toString('base64url')

const buildToken = (header: object) =>
  `${b64(JSON.stringify(header))}.${b64(JSON.stringify({ sub: 'user', exp: 4102444800 }))}.c2ln`

const makeClient = (jwk: object) => {
  const mockFetch = jest.fn().mockResolvedValue(
    new Response(JSON.stringify({ keys: [jwk] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  )
  const client = new GoTrueClient({
    url: 'http://localhost:9999',
    storageKey: `getclaims-alg-${Math.random()}`,
    storage: memoryLocalStorageAdapter({}),
    fetch: mockFetch,
    autoRefreshToken: false,
    persistSession: false,
  })
  return { client, mockFetch }
}

describe('GoTrueClient getClaims with an unsupported signing algorithm', () => {
  test.each(['none', 'ES384', 'RS512', 'EdDSA'])(
    'returns AuthInvalidJwtError instead of throwing for alg %s',
    async (alg) => {
      const { client } = makeClient({ kid: 'key-1', kty: 'EC', crv: 'P-256', x: 'x', y: 'y' })

      const { data, error } = await client.getClaims(buildToken({ alg, kid: 'key-1', typ: 'JWT' }))

      expect(data).toBeNull()
      expect(error?.name).toBe('AuthInvalidJwtError')
      expect(error?.code).toBe('invalid_jwt')
    }
  )

  test('returns AuthInvalidJwtError when the JWK does not match the alg claim', async () => {
    const { client } = makeClient({ kid: 'key-1', kty: 'EC', crv: 'P-256', x: 'x', y: 'y' })

    const { data, error } = await client.getClaims(
      buildToken({ alg: 'RS256', kid: 'key-1', typ: 'JWT' })
    )

    expect(data).toBeNull()
    expect(error?.name).toBe('AuthInvalidJwtError')
    expect(error?.code).toBe('invalid_jwt')
  })
})
