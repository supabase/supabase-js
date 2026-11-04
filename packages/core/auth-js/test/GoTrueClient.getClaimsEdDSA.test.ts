import GoTrueClient from '../src/GoTrueClient'
import { AuthInvalidJwtError } from '../src/lib/errors'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'

const URL_BASE = 'http://localhost:9999'
const KID = 'ed25519-test-key'

const base64url = (data: string | Uint8Array) => Buffer.from(data).toString('base64url')

async function generateEd25519Key() {
  const { privateKey, publicKey } = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  const jwk = await crypto.subtle.exportKey('jwk', publicKey)
  return { privateKey, jwk: { ...jwk, kid: KID, alg: 'EdDSA', key_ops: ['verify'] } }
}

async function signJwt(privateKey: CryptoKey, header: Record<string, unknown>) {
  const payload = {
    sub: '11111111-1111-1111-1111-111111111111',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  const signature = await crypto.subtle.sign(
    { name: 'Ed25519' },
    privateKey,
    new TextEncoder().encode(signingInput)
  )
  return `${signingInput}.${base64url(new Uint8Array(signature))}`
}

// The JWKS cache is shared by every client with the same storage key.
let clientCount = 0

function makeClient(jwks: { keys: object[] }) {
  const fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.startsWith(`${URL_BASE}/.well-known/jwks.json`)) {
      return new Response(JSON.stringify(jwks), { status: 200 })
    }
    if (url === `${URL_BASE}/user`) {
      return new Response(JSON.stringify({ id: '11111111-1111-1111-1111-111111111111' }), {
        status: 200,
      })
    }
    throw new Error(`unexpected request to ${url}`)
  })
  const client = new GoTrueClient({
    url: URL_BASE,
    autoRefreshToken: false,
    persistSession: false,
    storage: memoryLocalStorageAdapter(),
    storageKey: `test-getclaims-eddsa-${clientCount++}`,
    fetch,
  })
  const requestedUrls = () => fetch.mock.calls.map(([input]) => String(input))
  return { client, requestedUrls }
}

describe('getClaims with Ed25519 signing keys', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('verifies an EdDSA JWT locally without calling getUser', async () => {
    const { privateKey, jwk } = await generateEd25519Key()
    const jwt = await signJwt(privateKey, { alg: 'EdDSA', typ: 'JWT', kid: KID })
    const { client, requestedUrls } = makeClient({ keys: [jwk] })

    const { data, error } = await client.getClaims(jwt)

    expect(error).toBeNull()
    expect(data?.claims.sub).toBe('11111111-1111-1111-1111-111111111111')
    expect(requestedUrls()).toEqual([
      `${URL_BASE}/.well-known/jwks.json?supported_algs=RS256%2CES256%2CEdDSA%2CEd25519`,
    ])
  })

  it('accepts the fully specified Ed25519 alg from RFC 9864', async () => {
    const { privateKey, jwk } = await generateEd25519Key()
    const jwt = await signJwt(privateKey, { alg: 'Ed25519', typ: 'JWT', kid: KID })
    const { client } = makeClient({ keys: [{ ...jwk, alg: 'Ed25519' }] })

    const { error } = await client.getClaims(jwt)

    expect(error).toBeNull()
  })

  it('returns an error for an EdDSA JWT signed by another key', async () => {
    const { jwk } = await generateEd25519Key()
    const other = await generateEd25519Key()
    const jwt = await signJwt(other.privateKey, { alg: 'EdDSA', typ: 'JWT', kid: KID })
    const { client } = makeClient({ keys: [jwk] })

    const { data, error } = await client.getClaims(jwt)

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(AuthInvalidJwtError)
  })

  it('falls back to getUser when the runtime cannot import an Ed25519 key', async () => {
    const { privateKey, jwk } = await generateEd25519Key()
    const jwt = await signJwt(privateKey, { alg: 'EdDSA', typ: 'JWT', kid: KID })
    const { client, requestedUrls } = makeClient({ keys: [jwk] })
    jest
      .spyOn(crypto.subtle, 'importKey')
      .mockRejectedValue(new DOMException('Unrecognized name.', 'NotSupportedError'))

    const { error } = await client.getClaims(jwt)

    expect(error).toBeNull()
    expect(requestedUrls()).toContain(`${URL_BASE}/user`)
  })

  it('falls back to getUser for an algorithm it does not know', async () => {
    const { privateKey, jwk } = await generateEd25519Key()
    const jwt = await signJwt(privateKey, { alg: 'ES384', typ: 'JWT', kid: KID })
    const { client, requestedUrls } = makeClient({ keys: [jwk] })

    const { error } = await client.getClaims(jwt)

    expect(error).toBeNull()
    expect(requestedUrls()).toContain(`${URL_BASE}/user`)
  })

  it('falls back to getUser when the JWKS leaves out the signing key', async () => {
    const { privateKey } = await generateEd25519Key()
    const jwt = await signJwt(privateKey, { alg: 'EdDSA', typ: 'JWT', kid: KID })
    const { client, requestedUrls } = makeClient({ keys: [] })

    const { error } = await client.getClaims(jwt)

    expect(error).toBeNull()
    expect(requestedUrls()).toContain(`${URL_BASE}/user`)
  })
})
