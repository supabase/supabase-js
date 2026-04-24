import { GoTrueAdminApi, GoTrueClient } from '../src/index'

const ERROR_MESSAGE_FRAGMENT = 'the passkey API is experimental and disabled by default'

// Guard runs before any network I/O, so the URL never needs to resolve.
const TEST_URL = 'http://127.0.0.1:1/auth/v1'
const TEST_HEADERS = { apikey: 'test-anon-key' }
const TEST_UUID = '00000000-0000-0000-0000-000000000000'

describe('Passkey experimental gating', () => {
  let client: GoTrueClient
  let admin: GoTrueAdminApi

  beforeEach(() => {
    client = new GoTrueClient({
      url: TEST_URL,
      headers: TEST_HEADERS,
      autoRefreshToken: false,
      persistSession: false,
    })
    admin = new GoTrueAdminApi({
      url: TEST_URL,
      headers: TEST_HEADERS,
    })
  })

  test.each<[string, () => Promise<unknown>]>([
    ['signInWithPasskey', () => client.signInWithPasskey()],
    ['registerPasskey', () => client.registerPasskey()],
    ['passkey.startRegistration', () => client.passkey.startRegistration()],
    [
      'passkey.verifyRegistration',
      () => client.passkey.verifyRegistration({ challengeId: 'c', credential: {} as any }),
    ],
    ['passkey.startAuthentication', () => client.passkey.startAuthentication()],
    [
      'passkey.verifyAuthentication',
      () => client.passkey.verifyAuthentication({ challengeId: 'c', credential: {} as any }),
    ],
    ['passkey.list', () => client.passkey.list()],
    ['passkey.update', () => client.passkey.update({ passkeyId: 'p', friendlyName: 'n' })],
    ['passkey.delete', () => client.passkey.delete({ passkeyId: 'p' })],
    ['admin.passkey.listPasskeys', () => admin.passkey.listPasskeys({ userId: TEST_UUID })],
    [
      'admin.passkey.deletePasskey',
      () => admin.passkey.deletePasskey({ userId: TEST_UUID, passkeyId: TEST_UUID }),
    ],
  ])('%s throws when experimental.passkey is not set', async (_name, invoke) => {
    await expect(invoke()).rejects.toThrow(ERROR_MESSAGE_FRAGMENT)
  })

  test('error message references the opt-in key', async () => {
    await expect(client.passkey.list()).rejects.toThrow(/experimental.*passkey/)
  })
})
