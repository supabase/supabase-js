/**
 * End-to-end passkey tests against the Supabase CLI Auth server.
 *
 * Requires the CLI test infrastructure, with `[auth.passkey]` and `[auth.webauthn]` configured.
 */

import { GoTrueAdminApi, GoTrueClient } from '../src/index'
import { AuthApiError, AuthSessionMissingError } from '../src/lib/errors'
import { SupportedStorage } from '../src/lib/types'
import {
  GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY,
} from './lib/clients'
import { mockUserCredentials } from './lib/utils'
import { SoftwareAuthenticator } from './lib/software-authenticator'

// Must match [auth.webauthn] in test/supabase/config.toml
const RP_ID = 'localhost'
const RP_ORIGIN = 'http://localhost:5173'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const memoryStorage = (): SupportedStorage => {
  const items = new Map<string, string>()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value)
    },
    removeItem: (key) => {
      items.delete(key)
    },
  }
}

const createPasskeyClient = () =>
  new GoTrueClient({
    url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    autoRefreshToken: false,
    persistSession: true,
    storage: memoryStorage(),
    experimental: { passkey: true },
  })

const adminClient = new GoTrueAdminApi({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  headers: {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
  },
  experimental: { passkey: true },
})

describe('Passkey end-to-end', () => {
  // Client that registers the passkey (holds the signed-up user's session)
  const ownerClient = createPasskeyClient()
  const authenticator = new SoftwareAuthenticator({ rpId: RP_ID, origin: RP_ORIGIN })

  let userId: string
  let passkeyId: string

  beforeAll(async () => {
    const { email, password } = mockUserCredentials()
    const { data, error } = await ownerClient.signUp({ email, password })
    expect(error).toBeNull()
    expect(data.session).not.toBeNull()
    userId = data.user!.id

    // Register the suite's canonical passkey up front so passkeyId is valid in
    // every test, regardless of filtering or execution order.
    const { data: options, error: optionsError } = await ownerClient.passkey.startRegistration()
    expect(optionsError).toBeNull()
    const credential = authenticator.create(options!.options)
    const { data: created, error: createError } = await ownerClient.passkey.verifyRegistration({
      challengeId: options!.challenge_id,
      credential,
    })
    expect(createError).toBeNull()
    passkeyId = created!.id
  })

  describe('registration ceremony', () => {
    it('startRegistration returns WebAuthn creation options', async () => {
      const { data, error } = await ownerClient.passkey.startRegistration()

      expect(error).toBeNull()
      expect(data).not.toBeNull()
      expect(data!.challenge_id).toMatch(UUID_REGEX)
      expect(data!.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000))
      expect(data!.options.rp.id).toEqual(RP_ID)
      expect(data!.options.challenge).toEqual(expect.any(String))
      expect(data!.options.user.id).toEqual(expect.any(String))
      expect(data!.options.pubKeyCredParams).toEqual(
        expect.arrayContaining([expect.objectContaining({ alg: -7, type: 'public-key' })])
      )
      // Passkeys are discoverable credentials
      expect(data!.options.authenticatorSelection?.residentKey).toEqual('required')
    })

    it('verifyRegistration creates the passkey', async () => {
      // Register (and clean up) a second passkey with its own authenticator;
      // the suite's canonical passkey is registered in beforeAll.
      const secondAuthenticator = new SoftwareAuthenticator({ rpId: RP_ID, origin: RP_ORIGIN })
      const { data: options, error: optionsError } = await ownerClient.passkey.startRegistration()
      expect(optionsError).toBeNull()

      const credential = secondAuthenticator.create(options!.options)
      const { data, error } = await ownerClient.passkey.verifyRegistration({
        challengeId: options!.challenge_id,
        credential,
      })

      expect(error).toBeNull()
      expect(data).not.toBeNull()
      expect(data!.id).toMatch(UUID_REGEX)
      expect(data!.created_at).toEqual(expect.any(String))

      const { error: deleteError } = await ownerClient.passkey.delete({ passkeyId: data!.id })
      expect(deleteError).toBeNull()
    })

    it('verifyRegistration rejects an unknown challenge', async () => {
      const { data: options, error: optionsError } = await ownerClient.passkey.startRegistration()
      expect(optionsError).toBeNull()
      const credential = authenticator.create(options!.options)

      const { data, error } = await ownerClient.passkey.verifyRegistration({
        challengeId: '00000000-0000-0000-0000-000000000000',
        credential,
      })

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(AuthApiError)
      expect((error as AuthApiError).code).toEqual('webauthn_challenge_not_found')
    })

    it('startRegistration requires a session', async () => {
      const anonymousClient = createPasskeyClient()
      const { data, error } = await anonymousClient.passkey.startRegistration()

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(AuthSessionMissingError)
    })
  })

  describe('passkey management', () => {
    it('list returns the registered passkey', async () => {
      const { data, error } = await ownerClient.passkey.list()

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data![0].id).toEqual(passkeyId)
      expect(data![0].created_at).toEqual(expect.any(String))
    })

    it('update renames the passkey', async () => {
      const { data, error } = await ownerClient.passkey.update({
        passkeyId,
        friendlyName: 'e2e test key',
      })

      expect(error).toBeNull()
      expect(data!.id).toEqual(passkeyId)
      expect(data!.friendly_name).toEqual('e2e test key')

      const { data: listed, error: listError } = await ownerClient.passkey.list()
      expect(listError).toBeNull()
      expect(listed![0].friendly_name).toEqual('e2e test key')
    })

    it('update rejects an unknown passkey id', async () => {
      const { data, error } = await ownerClient.passkey.update({
        passkeyId: '00000000-0000-0000-0000-000000000000',
        friendlyName: 'nope',
      })

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(AuthApiError)
      expect((error as AuthApiError).status).toEqual(404)
    })
  })

  describe('authentication ceremony', () => {
    it('signs in with the passkey via the two-step flow', async () => {
      const signInClient = createPasskeyClient()

      const { data: options, error: optionsError } =
        await signInClient.passkey.startAuthentication()
      expect(optionsError).toBeNull()
      expect(options!.challenge_id).toMatch(UUID_REGEX)
      expect(options!.options.challenge).toEqual(expect.any(String))
      // Discoverable login: the server must not constrain credentials
      expect(options!.options.allowCredentials ?? []).toHaveLength(0)

      const assertion = authenticator.get(options!.options)
      const { data, error } = await signInClient.passkey.verifyAuthentication({
        challengeId: options!.challenge_id,
        credential: assertion,
      })

      expect(error).toBeNull()
      expect(data!.user!.id).toEqual(userId)
      expect(data!.session).not.toBeNull()
      expect(data!.session!.access_token).toEqual(expect.any(String))

      // The session is persisted on the client
      const {
        data: { session },
      } = await signInClient.getSession()
      expect(session?.access_token).toEqual(data!.session!.access_token)

      // The session is usable against the server
      const { data: userData, error: userError } = await signInClient.getUser()
      expect(userError).toBeNull()
      expect(userData.user?.id).toEqual(userId)

      // The sign-in is recorded on the passkey
      const { data: listed, error: listError } = await ownerClient.passkey.list()
      expect(listError).toBeNull()
      expect(listed![0].last_used_at).toEqual(expect.any(String))
    })

    it('rejects a replayed authentication challenge', async () => {
      const signInClient = createPasskeyClient()
      const { data: options, error: optionsError } =
        await signInClient.passkey.startAuthentication()
      expect(optionsError).toBeNull()
      const assertion = authenticator.get(options!.options)

      const first = await signInClient.passkey.verifyAuthentication({
        challengeId: options!.challenge_id,
        credential: assertion,
      })
      expect(first.error).toBeNull()

      const second = await signInClient.passkey.verifyAuthentication({
        challengeId: options!.challenge_id,
        credential: assertion,
      })
      expect(second.data).toBeNull()
      expect(second.error).toBeInstanceOf(AuthApiError)
      expect((second.error as AuthApiError).code).toEqual('webauthn_challenge_not_found')
    })

    it('rejects an assertion from an unregistered authenticator', async () => {
      const signInClient = createPasskeyClient()
      const unregisteredAuthenticator = new SoftwareAuthenticator({
        rpId: RP_ID,
        origin: RP_ORIGIN,
      })
      // Bind the authenticator to the real user handle without registering it
      const { data: registrationOptions, error: registrationOptionsError } =
        await ownerClient.passkey.startRegistration()
      expect(registrationOptionsError).toBeNull()
      unregisteredAuthenticator.create(registrationOptions!.options)

      const { data: options, error: optionsError } =
        await signInClient.passkey.startAuthentication()
      expect(optionsError).toBeNull()
      const assertion = unregisteredAuthenticator.get(options!.options)
      const { data, error } = await signInClient.passkey.verifyAuthentication({
        challengeId: options!.challenge_id,
        credential: assertion,
      })

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(AuthApiError)
      expect((error as AuthApiError).code).toEqual('webauthn_verification_failed')
    })
  })

  describe('admin passkey management', () => {
    it('listPasskeys returns the passkeys of the user', async () => {
      const { data, error } = await adminClient.passkey.listPasskeys({ userId })

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data![0].id).toEqual(passkeyId)
    })

    it('deletePasskey removes the passkey', async () => {
      // Register a second passkey to delete via the admin API
      const secondAuthenticator = new SoftwareAuthenticator({ rpId: RP_ID, origin: RP_ORIGIN })
      const { data: options, error: optionsError } = await ownerClient.passkey.startRegistration()
      expect(optionsError).toBeNull()
      const credential = secondAuthenticator.create(options!.options)
      const { data: created, error: createError } = await ownerClient.passkey.verifyRegistration({
        challengeId: options!.challenge_id,
        credential,
      })
      expect(createError).toBeNull()

      const { error } = await adminClient.passkey.deletePasskey({
        userId,
        passkeyId: created!.id,
      })
      expect(error).toBeNull()

      const { data: remaining, error: listError } = await adminClient.passkey.listPasskeys({
        userId,
      })
      expect(listError).toBeNull()
      expect(remaining!.map((passkey) => passkey.id)).toEqual([passkeyId])
    })
  })

  describe('passkey deletion', () => {
    it('delete removes the passkey and disables sign-in with it', async () => {
      const { error } = await ownerClient.passkey.delete({ passkeyId })
      expect(error).toBeNull()

      const { data: listed, error: listError } = await ownerClient.passkey.list()
      expect(listError).toBeNull()
      expect(listed).toHaveLength(0)

      // Signing in with the deleted passkey now fails
      const signInClient = createPasskeyClient()
      const { data: options, error: optionsError } =
        await signInClient.passkey.startAuthentication()
      expect(optionsError).toBeNull()
      const assertion = authenticator.get(options!.options)
      const { data, error: signInError } = await signInClient.passkey.verifyAuthentication({
        challengeId: options!.challenge_id,
        credential: assertion,
      })

      expect(data).toBeNull()
      expect(signInError).toBeInstanceOf(AuthApiError)
      expect((signInError as AuthApiError).code).toEqual('webauthn_verification_failed')
    })
  })
})
