import 'jest'

import { WebAuthnApi } from '../src/lib/webauthn'
import { AuthError } from '../src/lib/errors'

/**
 * `_register()` is gated by `browserSupportsWebAuthn()`, which needs a browser-like
 * global. Provide the minimum surface so the enroll/cleanup path runs under the
 * `node` test environment. Each Jest test file gets its own sandboxed global, so
 * these assignments don't leak to other suites.
 */
const originalWindow = (globalThis as any).window
const originalDocument = (globalThis as any).document
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

beforeAll(() => {
  ;(globalThis as any).window = {
    PublicKeyCredential: function () {},
    location: { hostname: 'example.com', origin: 'https://example.com' },
  }
  ;(globalThis as any).document = {}
  Object.defineProperty(globalThis, 'navigator', {
    value: { credentials: { create: () => {}, get: () => {} } },
    configurable: true,
    writable: true,
  })
})

afterAll(() => {
  ;(globalThis as any).window = originalWindow
  ;(globalThis as any).document = originalDocument
  if (originalNavigator) {
    Object.defineProperty(globalThis, 'navigator', originalNavigator)
  } else {
    delete (globalThis as any).navigator
  }
})

type StubFactor = {
  id: string
  factor_type: string
  friendly_name: string
  status: 'verified' | 'unverified'
}

function makeClient(factors: StubFactor[]) {
  const unenroll = jest.fn(async () => ({ data: {}, error: null }))
  const client = {
    mfa: {
      // Enrollment fails, e.g. a friendly-name conflict.
      enroll: jest.fn(async () => ({
        data: null,
        error: new AuthError('A factor with this friendly name already exists'),
      })),
      listFactors: jest.fn(async () => ({ data: { all: factors }, error: null })),
      unenroll,
    },
  }
  return { client, unenroll }
}

const registerParams = {
  friendlyName: 'Work Laptop',
  webauthn: { rpId: 'example.com', rpOrigins: ['https://example.com'] },
}

describe('WebAuthnApi.register() failed-enrollment cleanup', () => {
  test('preserves an existing verified factor when enrollment fails', async () => {
    const { client, unenroll } = makeClient([
      {
        id: 'verified-factor-id',
        factor_type: 'webauthn',
        friendly_name: 'Work Laptop',
        status: 'verified',
      },
    ])
    const api = new WebAuthnApi(client as any)

    const { data, error } = await api.register(registerParams)

    // The enroll error is surfaced to the caller...
    expect(data).toBeNull()
    expect(error).toBeInstanceOf(AuthError)
    // ...and the user's working passkey is left untouched.
    expect(unenroll).not.toHaveBeenCalled()
  })

  test('removes a stale unverified factor so a retry can succeed', async () => {
    const { client, unenroll } = makeClient([
      {
        id: 'stale-unverified-id',
        factor_type: 'webauthn',
        friendly_name: 'Work Laptop',
        status: 'unverified',
      },
    ])
    const api = new WebAuthnApi(client as any)

    await api.register(registerParams)

    expect(unenroll).toHaveBeenCalledTimes(1)
    expect(unenroll).toHaveBeenCalledWith({ factorId: 'stale-unverified-id' })
  })

  test('does not touch a verified factor that shares a name with a stale unverified one', async () => {
    const { client, unenroll } = makeClient([
      {
        id: 'verified-factor-id',
        factor_type: 'webauthn',
        friendly_name: 'Work Laptop',
        status: 'verified',
      },
      {
        id: 'stale-unverified-id',
        factor_type: 'webauthn',
        friendly_name: 'Work Laptop',
        status: 'unverified',
      },
    ])
    const api = new WebAuthnApi(client as any)

    await api.register(registerParams)

    expect(unenroll).toHaveBeenCalledTimes(1)
    expect(unenroll).toHaveBeenCalledWith({ factorId: 'stale-unverified-id' })
  })
})
