/**
 * Docker-only tests: Asymmetric JWT (RS256)
 *
 * These tests require a GoTrue instance configured with RS256 signing keys.
 * Supabase CLI uses HS256 by default, so these tests require Docker.
 *
 * Run with: npx nx test:docker auth-js
 */

import { asymmetricClient, DOCKER_URLS } from './clients'
import { mockUserCredentials } from '../lib/utils'

// Check Node version for crypto.subtle support
const nodeVersion = parseInt(process.version.slice(1).split('.')[0], 10)
const isNodeHigherThan18 = nodeVersion > 18

describe('Docker: Asymmetric JWT (RS256)', () => {
  test('getClaims fetches JWKS to verify asymmetric jwt', async () => {
    const fetchedUrls: any[] = []
    const fetchedResponse: any[] = []

    // override fetch to inspect fetchJwk called within getClaims
    asymmetricClient['fetch'] = async (url: RequestInfo | URL, options = {}) => {
      fetchedUrls.push(url)
      const response = await globalThis.fetch(url, options)
      const clonedResponse = response.clone()
      fetchedResponse.push(await clonedResponse.json())
      return response
    }

    const { email, password } = mockUserCredentials()
    const {
      data: { user },
      error: initialError,
    } = await asymmetricClient.signUp({
      email,
      password,
    })
    expect(initialError).toBeNull()
    expect(user).not.toBeNull()

    const { data, error } = await asymmetricClient.getClaims()
    expect(error).toBeNull()
    expect(data?.claims.email).toEqual(user?.email)

    // node 18 doesn't support crypto.subtle API by default
    if (isNodeHigherThan18) {
      expect(fetchedUrls).toContain(
        DOCKER_URLS.SIGNUP_ENABLED_ASYMMETRIC_AUTO_CONFIRM_ON + '/.well-known/jwks.json'
      )
    }

    // contains the response for getSession and fetchJwk
    expect(fetchedResponse).toHaveLength(2)
  })

  test('getClaims should return error for Invalid JWT signature (mocked verify)', async () => {
    // node 18 doesn't support crypto.subtle API by default
    if (!isNodeHigherThan18) {
      console.warn('Skipping test due to Node version <= 18')
      return
    }

    const { email, password } = mockUserCredentials()
    const { data: signUpData, error: signUpError } = await asymmetricClient.signUp({
      email,
      password,
    })
    expect(signUpError).toBeNull()
    expect(signUpData.session).not.toBeNull()

    const verifySpy = jest.spyOn(crypto.subtle, 'verify').mockImplementation(async () => false)

    const { data, error } = await asymmetricClient.getClaims()

    verifySpy.mockRestore()
    expect(error).not.toBeNull()
    expect(error?.message).toContain('Invalid JWT signature')
    expect(data).toBeNull()
  })

  test('getClaims should return error for Invalid JWT signature with invalid base64', async () => {
    const { email, password } = mockUserCredentials()

    const { data: signUpData, error: signUpError } = await asymmetricClient.signUp({
      email,
      password,
    })

    expect(signUpError).toBeNull()
    expect(signUpData.session).not.toBeNull()

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(
      JSON.stringify({
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'https://example.com',
        sub: '1234567890',
        user_metadata: {},
        role: 'authenticated',
      })
    ).toString('base64url')
    const invalidSignature = 'invalid_signature_that_is_not_base64url_encoded'
    const invalidJWT = `${header}.${payload}.${invalidSignature}`

    // @ts-expect-error 'Allow access to protected storage'
    const storage = asymmetricClient.storage
    // @ts-expect-error 'Allow access to protected storageKey'
    const storageKey = asymmetricClient.storageKey

    await storage.setItem(
      storageKey,
      JSON.stringify({
        ...signUpData.session,
        access_token: invalidJWT,
      })
    )

    const { data, error } = await asymmetricClient.getClaims()

    expect(error).not.toBeNull()
    expect(error?.message).toContain('unable to parse or verify signature')
    expect(data).toBeNull()
  })
})

