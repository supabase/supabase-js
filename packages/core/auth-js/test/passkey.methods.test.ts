import { GoTrueAdminApi, GoTrueClient } from '../src/index'
import { AuthApiError, AuthSessionMissingError } from '../src/lib/errors'
import { isWebAuthnError } from '../src/lib/webauthn.errors'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'
import { Session } from '../src/lib/types'
import {
  webauthnAssertionCredentialResponse,
  webauthnAssertionMockCredential,
  webauthnCreationCredentialResponse,
  webauthnCreationMockCredential,
} from './webauthn.fixtures'

// Fetch is always mocked in this file, so the URL is never resolved.
const TEST_URL = 'http://localhost:9999'
const TEST_HEADERS = { apikey: 'test-publishable-key' }
const TEST_USER_UUID = '11111111-2222-3333-4444-555555555555'
const TEST_PASSKEY_UUID = '99999999-8888-7777-6666-555555555555'

const TEST_USER = {
  id: TEST_USER_UUID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'passkey-user@example.com',
  created_at: '2026-01-01T00:00:00.000Z',
}

const TEST_PASSKEY_ITEM = {
  id: TEST_PASSKEY_UUID,
  friendly_name: 'My YubiKey',
  created_at: '2026-01-01T00:00:00.000Z',
}

const mockSession = (): Session =>
  ({
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: TEST_USER,
  }) as Session

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  headers: new Headers({ 'x-supabase-api-version': '2024-01-01' }),
  json: () => Promise.resolve(body),
})

const apiErrorResponse = (message: string, status: number, code?: string) =>
  jsonResponse({ code, msg: message }, status)

type ClientSetup = {
  client: GoTrueClient
  mockFetch: jest.Mock
}

const createPasskeyClient = async ({
  withSession = false,
  experimental = { passkey: true },
}: {
  withSession?: boolean
  experimental?: { passkey?: boolean }
} = {}): Promise<ClientSetup> => {
  const mockFetch = jest.fn()
  const storage = memoryLocalStorageAdapter()
  const storageKey = 'passkey-methods-test'
  if (withSession) {
    await storage.setItem(storageKey, JSON.stringify(mockSession()))
  }
  const client = new GoTrueClient({
    url: TEST_URL,
    headers: TEST_HEADERS,
    storageKey,
    storage,
    autoRefreshToken: false,
    persistSession: true,
    fetch: mockFetch as unknown as typeof fetch,
    experimental,
  })
  return { client, mockFetch }
}

const lastRequest = (mockFetch: jest.Mock) => {
  const [url, params] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
  return { url, params, body: params.body ? JSON.parse(params.body) : undefined }
}

/**
 * Simulates a WebAuthn-capable browser in the Node test environment so that
 * browserSupportsWebAuthn() returns true and navigator.credentials can be mocked.
 */
const setupBrowserEnvironment = () => {
  class FakePublicKeyCredential {}

  const credentialsCreate = jest.fn()
  const credentialsGet = jest.fn()

  const overridden: Array<[string, PropertyDescriptor | undefined]> = []
  const override = (key: string, value: unknown) => {
    overridden.push([key, Object.getOwnPropertyDescriptor(globalThis, key)])
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  }

  override('window', {
    PublicKeyCredential: FakePublicKeyCredential,
    // href is required: GoTrueClient._initialize() parses window.location.href on
    // construction, and an absent href would silently abort initialization.
    location: {
      hostname: 'localhost',
      origin: 'http://localhost:5173',
      href: 'http://localhost:5173/',
    },
  })
  override('document', {})
  override('PublicKeyCredential', FakePublicKeyCredential)
  override('navigator', { credentials: { create: credentialsCreate, get: credentialsGet } })
  // Once window/document exist, GoTrueClient would open Node's native
  // BroadcastChannel, leaving MESSAGEPORT handles that keep Jest alive.
  override('BroadcastChannel', undefined)

  const restore = () => {
    for (const [key, descriptor] of overridden.reverse()) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor)
      } else {
        delete (globalThis as Record<string, unknown>)[key]
      }
    }
  }

  // Wrap a plain fixture object so it passes `instanceof PublicKeyCredential` checks
  const asPublicKeyCredential = <T extends object>(fixture: T): T =>
    Object.assign(Object.create(FakePublicKeyCredential.prototype), fixture)

  return { credentialsCreate, credentialsGet, restore, asPublicKeyCredential }
}

const serverCreationOptions = {
  challenge: webauthnCreationCredentialResponse.challenge,
  rp: { id: 'localhost', name: 'Test RP' },
  user: { id: 'dXNlci1pZA', name: 'passkey-user@example.com', displayName: 'Passkey User' },
  pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
  timeout: 60000,
  authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  attestation: 'none',
}

const serverRequestOptions = {
  challenge: webauthnAssertionCredentialResponse.challenge,
  rpId: 'localhost',
  timeout: 60000,
  userVerification: 'preferred',
}

const sessionServerResponse = {
  access_token: 'new-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'new-refresh-token',
  user: TEST_USER,
}

describe('passkey.startRegistration', () => {
  it('posts to /passkeys/registration/options with the session JWT', async () => {
    const { client, mockFetch } = await createPasskeyClient({ withSession: true })
    const optionsResponse = {
      challenge_id: TEST_PASSKEY_UUID,
      options: serverCreationOptions,
      expires_at: Math.floor(Date.now() / 1000) + 300,
    }
    mockFetch.mockResolvedValueOnce(jsonResponse(optionsResponse))

    const { data, error } = await client.passkey.startRegistration()

    expect(error).toBeNull()
    expect(data).toEqual(optionsResponse)
    const { url, params, body } = lastRequest(mockFetch)
    expect(url).toEqual(`${TEST_URL}/passkeys/registration/options`)
    expect(params.method).toEqual('POST')
    expect(params.headers).toMatchObject({
      apikey: 'test-publishable-key',
      Authorization: 'Bearer test-access-token',
    })
    expect(body).toEqual({})
  })

  it('returns AuthSessionMissingError without a session and does not hit the server', async () => {
    const { client, mockFetch } = await createPasskeyClient()

    const { data, error } = await client.passkey.startRegistration()

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(AuthSessionMissingError)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns the API error when the server rejects the request', async () => {
    const { client, mockFetch } = await createPasskeyClient({ withSession: true })
    mockFetch.mockResolvedValueOnce(
      apiErrorResponse('Maximum number of passkeys reached', 422, 'too_many_passkeys')
    )

    const { data, error } = await client.passkey.startRegistration()

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(AuthApiError)
    expect(error?.status).toEqual(422)
    expect((error as AuthApiError).code).toEqual('too_many_passkeys')
  })
})

describe('passkey.verifyRegistration', () => {
  it('posts the challenge id and credential and returns passkey metadata', async () => {
    const { client, mockFetch } = await createPasskeyClient({ withSession: true })
    mockFetch.mockResolvedValueOnce(jsonResponse(TEST_PASSKEY_ITEM))

    const { data, error } = await client.passkey.verifyRegistration({
      challengeId: TEST_PASSKEY_UUID,
      credential: webauthnCreationCredentialResponse.credentialResponse,
    })

    expect(error).toBeNull()
    expect(data).toEqual(TEST_PASSKEY_ITEM)
    const { url, params, body } = lastRequest(mockFetch)
    expect(url).toEqual(`${TEST_URL}/passkeys/registration/verify`)
    expect(params.method).toEqual('POST')
    expect(params.headers).toMatchObject({
      apikey: 'test-publishable-key',
      Authorization: 'Bearer test-access-token',
    })
    expect(body).toEqual({
      challenge_id: TEST_PASSKEY_UUID,
      credential: webauthnCreationCredentialResponse.credentialResponse,
    })
  })

  it('returns AuthSessionMissingError without a session', async () => {
    const { client, mockFetch } = await createPasskeyClient()

    const { data, error } = await client.passkey.verifyRegistration({
      challengeId: TEST_PASSKEY_UUID,
      credential: webauthnCreationCredentialResponse.credentialResponse,
    })

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(AuthSessionMissingError)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns the API error for an invalid or consumed challenge', async () => {
    const { client, mockFetch } = await createPasskeyClient({ withSession: true })
    mockFetch.mockResolvedValueOnce(
      apiErrorResponse('Challenge not found or already used', 400, 'webauthn_challenge_not_found')
    )

    const { data, error } = await client.passkey.verifyRegistration({
      challengeId: TEST_PASSKEY_UUID,
      credential: webauthnCreationCredentialResponse.credentialResponse,
    })

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(AuthApiError)
    expect((error as AuthApiError).code).toEqual('webauthn_challenge_not_found')
  })
})

describe('passkey.startAuthentication', () => {
  it('posts to /passkeys/authentication/options without requiring a session', async () => {
    const { client, mockFetch } = await createPasskeyClient()
    const optionsResponse = {
      challenge_id: TEST_PASSKEY_UUID,
      options: serverRequestOptions,
      expires_at: Math.floor(Date.now() / 1000) + 300,
    }
    mockFetch.mockResolvedValueOnce(jsonResponse(optionsResponse))

    const { data, error } = await client.passkey.startAuthentication()

    expect(error).toBeNull()
    expect(data).toEqual(optionsResponse)
    const { url, params, body } = lastRequest(mockFetch)
    expect(url).toEqual(`${TEST_URL}/passkeys/authentication/options`)
    expect(params.method).toEqual('POST')
    expect(params.headers).toMatchObject({ apikey: 'test-publishable-key' })
    expect(params.headers.Authorization).toBeUndefined()
    expect(body).toEqual({ gotrue_meta_security: {} })
  })

  it('forwards the captcha token', async () => {
    const { client, mockFetch } = await createPasskeyClient()
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ challenge_id: TEST_PASSKEY_UUID, options: serverRequestOptions })
    )

    await client.passkey.startAuthentication({ options: { captchaToken: 'captcha-token' } })

    const { body } = lastRequest(mockFetch)
    expect(body).toEqual({ gotrue_meta_security: { captcha_token: 'captcha-token' } })
  })
})

describe('passkey.verifyAuthentication', () => {
  it('verifies the credential, saves the session and emits SIGNED_IN', async () => {
    const { client, mockFetch } = await createPasskeyClient()
    mockFetch.mockResolvedValueOnce(jsonResponse(sessionServerResponse))

    const events: string[] = []
    const {
      data: { subscription },
    } = client.onAuthStateChange((event) => {
      events.push(event)
    })

    const { data, error } = await client.passkey.verifyAuthentication({
      challengeId: TEST_PASSKEY_UUID,
      credential: webauthnAssertionCredentialResponse.credentialResponse,
    })
    subscription.unsubscribe()

    expect(error).toBeNull()
    expect(data?.session?.access_token).toEqual('new-access-token')
    expect(data?.user).toEqual(TEST_USER)
    expect(events).toContain('SIGNED_IN')

    const { url, body } = lastRequest(mockFetch)
    expect(url).toEqual(`${TEST_URL}/passkeys/authentication/verify`)
    expect(body).toEqual({
      challenge_id: TEST_PASSKEY_UUID,
      credential: webauthnAssertionCredentialResponse.credentialResponse,
    })

    const {
      data: { session },
    } = await client.getSession()
    expect(session?.access_token).toEqual('new-access-token')
  })

  it('returns the API error when verification fails and does not save a session', async () => {
    const { client, mockFetch } = await createPasskeyClient()
    mockFetch.mockResolvedValueOnce(
      apiErrorResponse('WebAuthn verification failed', 400, 'webauthn_verification_failed')
    )

    const { data, error } = await client.passkey.verifyAuthentication({
      challengeId: TEST_PASSKEY_UUID,
      credential: webauthnAssertionCredentialResponse.credentialResponse,
    })

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(AuthApiError)
    expect((error as AuthApiError).code).toEqual('webauthn_verification_failed')

    const {
      data: { session },
    } = await client.getSession()
    expect(session).toBeNull()
  })
})

describe('passkey.list', () => {
  it('fetches the passkeys for the current user', async () => {
    const { client, mockFetch } = await createPasskeyClient({ withSession: true })
    mockFetch.mockResolvedValueOnce(jsonResponse([TEST_PASSKEY_ITEM]))

    const { data, error } = await client.passkey.list()

    expect(error).toBeNull()
    expect(data).toEqual([TEST_PASSKEY_ITEM])
    const { url, params } = lastRequest(mockFetch)
    expect(url).toEqual(`${TEST_URL}/passkeys`)
    expect(params.method).toEqual('GET')
    expect(params.headers).toMatchObject({
      apikey: 'test-publishable-key',
      Authorization: 'Bearer test-access-token',
    })
  })

  it('returns AuthSessionMissingError without a session', async () => {
    const { client, mockFetch } = await createPasskeyClient()

    const { data, error } = await client.passkey.list()

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(AuthSessionMissingError)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('passkey.update', () => {
  it('patches the passkey friendly name', async () => {
    const { client, mockFetch } = await createPasskeyClient({ withSession: true })
    const updated = { ...TEST_PASSKEY_ITEM, friendly_name: 'Renamed key' }
    mockFetch.mockResolvedValueOnce(jsonResponse(updated))

    const { data, error } = await client.passkey.update({
      passkeyId: TEST_PASSKEY_UUID,
      friendlyName: 'Renamed key',
    })

    expect(error).toBeNull()
    expect(data).toEqual(updated)
    const { url, params, body } = lastRequest(mockFetch)
    expect(url).toEqual(`${TEST_URL}/passkeys/${TEST_PASSKEY_UUID}`)
    expect(params.method).toEqual('PATCH')
    expect(body).toEqual({ friendly_name: 'Renamed key' })
  })

  it('returns AuthSessionMissingError without a session', async () => {
    const { client } = await createPasskeyClient()

    const { error } = await client.passkey.update({
      passkeyId: TEST_PASSKEY_UUID,
      friendlyName: 'Renamed key',
    })

    expect(error).toBeInstanceOf(AuthSessionMissingError)
  })
})

describe('passkey.delete', () => {
  it('deletes the passkey', async () => {
    const { client, mockFetch } = await createPasskeyClient({ withSession: true })
    mockFetch.mockResolvedValueOnce(jsonResponse(null, 204))

    const { data, error } = await client.passkey.delete({ passkeyId: TEST_PASSKEY_UUID })

    expect(error).toBeNull()
    expect(data).toBeNull()
    const { url, params } = lastRequest(mockFetch)
    expect(url).toEqual(`${TEST_URL}/passkeys/${TEST_PASSKEY_UUID}`)
    expect(params.method).toEqual('DELETE')
    expect(params.headers).toMatchObject({
      apikey: 'test-publishable-key',
      Authorization: 'Bearer test-access-token',
    })
  })

  it('returns the API error when the passkey does not exist', async () => {
    const { client, mockFetch } = await createPasskeyClient({ withSession: true })
    mockFetch.mockResolvedValueOnce(apiErrorResponse('Passkey not found', 404, 'passkey_not_found'))

    const { data, error } = await client.passkey.delete({ passkeyId: TEST_PASSKEY_UUID })

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(AuthApiError)
    expect((error as AuthApiError).code).toEqual('passkey_not_found')
  })
})

describe('signInWithPasskey', () => {
  it('returns an error outside of a WebAuthn-capable browser', async () => {
    const { client, mockFetch } = await createPasskeyClient()

    const { data, error } = await client.signInWithPasskey()

    expect(data).toBeNull()
    expect(error?.message).toEqual('Browser does not support WebAuthn')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  describe('in a simulated browser', () => {
    let browser: ReturnType<typeof setupBrowserEnvironment>

    beforeEach(() => {
      browser = setupBrowserEnvironment()
    })

    afterEach(() => {
      browser.restore()
    })

    it('runs the full ceremony: options, navigator.credentials.get, verify', async () => {
      const { client, mockFetch } = await createPasskeyClient()
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse({
            challenge_id: TEST_PASSKEY_UUID,
            options: serverRequestOptions,
            expires_at: Math.floor(Date.now() / 1000) + 300,
          })
        )
        .mockResolvedValueOnce(jsonResponse(sessionServerResponse))
      browser.credentialsGet.mockResolvedValueOnce(
        browser.asPublicKeyCredential(webauthnAssertionMockCredential)
      )

      const { data, error } = await client.signInWithPasskey()

      expect(error).toBeNull()
      expect(data?.session?.access_token).toEqual('new-access-token')
      expect(data?.user).toEqual(TEST_USER)

      // navigator.credentials.get received the deserialized challenge
      const getOptions = browser.credentialsGet.mock.calls[0][0]
      expect(getOptions.publicKey.rpId).toEqual('localhost')
      expect(getOptions.publicKey.challenge).toBeInstanceOf(ArrayBuffer)
      expect(getOptions.signal).toBeInstanceOf(AbortSignal)

      // The serialized credential was sent to the verify endpoint
      expect(mockFetch).toHaveBeenCalledTimes(2)
      const { url, body } = lastRequest(mockFetch)
      expect(url).toEqual(`${TEST_URL}/passkeys/authentication/verify`)
      expect(body).toEqual({
        challenge_id: TEST_PASSKEY_UUID,
        credential: webauthnAssertionCredentialResponse.credentialResponse,
      })
    })

    it('returns the options error without invoking the authenticator', async () => {
      const { client, mockFetch } = await createPasskeyClient()
      mockFetch.mockResolvedValueOnce(apiErrorResponse('Passkeys are disabled', 422))

      const { data, error } = await client.signInWithPasskey()

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(AuthApiError)
      expect(browser.credentialsGet).not.toHaveBeenCalled()
    })

    it('returns a WebAuthnError when the user cancels the ceremony', async () => {
      const { client, mockFetch } = await createPasskeyClient()
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ challenge_id: TEST_PASSKEY_UUID, options: serverRequestOptions })
      )
      const cancellation = new Error('The operation either timed out or was not allowed')
      cancellation.name = 'NotAllowedError'
      browser.credentialsGet.mockRejectedValueOnce(cancellation)

      const { data, error } = await client.signInWithPasskey()

      expect(data).toBeNull()
      expect(isWebAuthnError(error)).toBe(true)
      // Only the options request went out; verify was never called
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })
})

describe('registerPasskey', () => {
  it('returns an error outside of a WebAuthn-capable browser', async () => {
    const { client, mockFetch } = await createPasskeyClient({ withSession: true })

    const { data, error } = await client.registerPasskey()

    expect(data).toBeNull()
    expect(error?.message).toEqual('Browser does not support WebAuthn')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  describe('in a simulated browser', () => {
    let browser: ReturnType<typeof setupBrowserEnvironment>

    beforeEach(() => {
      browser = setupBrowserEnvironment()
    })

    afterEach(() => {
      browser.restore()
    })

    it('runs the full ceremony: options, navigator.credentials.create, verify', async () => {
      const { client, mockFetch } = await createPasskeyClient({ withSession: true })
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse({
            challenge_id: TEST_PASSKEY_UUID,
            options: serverCreationOptions,
            expires_at: Math.floor(Date.now() / 1000) + 300,
          })
        )
        .mockResolvedValueOnce(jsonResponse(TEST_PASSKEY_ITEM))
      browser.credentialsCreate.mockResolvedValueOnce(
        browser.asPublicKeyCredential(webauthnCreationMockCredential)
      )

      const { data, error } = await client.registerPasskey()

      expect(error).toBeNull()
      expect(data).toEqual(TEST_PASSKEY_ITEM)

      const createOptions = browser.credentialsCreate.mock.calls[0][0]
      expect(createOptions.publicKey.rp.id).toEqual('localhost')
      expect(createOptions.publicKey.challenge).toBeInstanceOf(ArrayBuffer)
      expect(createOptions.publicKey.user.id).toBeInstanceOf(ArrayBuffer)

      expect(mockFetch).toHaveBeenCalledTimes(2)
      const { url, body } = lastRequest(mockFetch)
      expect(url).toEqual(`${TEST_URL}/passkeys/registration/verify`)
      expect(body).toEqual({
        challenge_id: TEST_PASSKEY_UUID,
        credential: webauthnCreationCredentialResponse.credentialResponse,
      })
    })

    it('returns AuthSessionMissingError without invoking the authenticator', async () => {
      const { client, mockFetch } = await createPasskeyClient()

      const { data, error } = await client.registerPasskey()

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(AuthSessionMissingError)
      expect(browser.credentialsCreate).not.toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('returns a WebAuthnError when credential creation fails', async () => {
      const { client, mockFetch } = await createPasskeyClient({ withSession: true })
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ challenge_id: TEST_PASSKEY_UUID, options: serverCreationOptions })
      )
      const failure = new Error('The authenticator was previously registered')
      failure.name = 'InvalidStateError'
      browser.credentialsCreate.mockRejectedValueOnce(failure)

      const { data, error } = await client.registerPasskey()

      expect(data).toBeNull()
      expect(isWebAuthnError(error)).toBe(true)
      expect((error as { code?: string }).code).toEqual('ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })
})

describe('admin.passkey', () => {
  const createAdminClient = () => {
    const mockFetch = jest.fn()
    const admin = new GoTrueAdminApi({
      url: TEST_URL,
      headers: { Authorization: 'Bearer secret-key-token' },
      fetch: mockFetch as unknown as typeof fetch,
      experimental: { passkey: true },
    })
    return { admin, mockFetch }
  }

  it('listPasskeys fetches the passkeys of the given user', async () => {
    const { admin, mockFetch } = createAdminClient()
    mockFetch.mockResolvedValueOnce(jsonResponse([TEST_PASSKEY_ITEM]))

    const { data, error } = await admin.passkey.listPasskeys({ userId: TEST_USER_UUID })

    expect(error).toBeNull()
    expect(data).toEqual([TEST_PASSKEY_ITEM])
    const { url, params } = lastRequest(mockFetch)
    expect(url).toEqual(`${TEST_URL}/admin/users/${TEST_USER_UUID}/passkeys`)
    expect(params.method).toEqual('GET')
    expect(params.headers).toMatchObject({ Authorization: 'Bearer secret-key-token' })
  })

  it('listPasskeys rejects a non-UUID userId before hitting the server', async () => {
    const { admin, mockFetch } = createAdminClient()

    await expect(admin.passkey.listPasskeys({ userId: 'not-a-uuid' })).rejects.toThrow(
      'Expected parameter to be UUID'
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('deletePasskey deletes the passkey of the given user', async () => {
    const { admin, mockFetch } = createAdminClient()
    mockFetch.mockResolvedValueOnce(jsonResponse(null, 204))

    const { data, error } = await admin.passkey.deletePasskey({
      userId: TEST_USER_UUID,
      passkeyId: TEST_PASSKEY_UUID,
    })

    expect(error).toBeNull()
    expect(data).toBeNull()
    const { url, params } = lastRequest(mockFetch)
    expect(url).toEqual(`${TEST_URL}/admin/users/${TEST_USER_UUID}/passkeys/${TEST_PASSKEY_UUID}`)
    expect(params.method).toEqual('DELETE')
  })

  it('deletePasskey rejects a non-UUID passkeyId before hitting the server', async () => {
    const { admin, mockFetch } = createAdminClient()

    await expect(
      admin.passkey.deletePasskey({ userId: TEST_USER_UUID, passkeyId: 'not-a-uuid' })
    ).rejects.toThrow('Expected parameter to be UUID')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('deletePasskey returns the API error when the passkey does not exist', async () => {
    const { admin, mockFetch } = createAdminClient()
    mockFetch.mockResolvedValueOnce(apiErrorResponse('Passkey not found', 404, 'passkey_not_found'))

    const { data, error } = await admin.passkey.deletePasskey({
      userId: TEST_USER_UUID,
      passkeyId: TEST_PASSKEY_UUID,
    })

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(AuthApiError)
    expect((error as AuthApiError).code).toEqual('passkey_not_found')
  })
})
