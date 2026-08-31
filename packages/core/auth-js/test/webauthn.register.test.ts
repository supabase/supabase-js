import 'jest'

import { WebAuthnApi } from '../src/lib/webauthn'
import { AuthError } from '../src/lib/errors'
import type GoTrueClient from '../src/GoTrueClient'

/**
 * register() cleanup after a failed enrollment (#2640).
 *
 * When _enroll fails (most commonly a friendly-name conflict), register() looks
 * up a webauthn factor with the requested friendly name and unenrolls it so the
 * user can retry. That cleanup must only ever remove an unverified leftover from
 * a previous failed attempt, never a verified factor: a verified factor with the
 * same name is the user's active credential, and the conflict proves it exists.
 */
describe('WebAuthnApi register cleanup on failed enroll', () => {
  const originalWindow = (globalThis as any).window
  const originalNavigator = (globalThis as any).navigator
  const originalDocument = (globalThis as any).document

  beforeEach(() => {
    ;(globalThis as any).window = {
      PublicKeyCredential: function () {},
      location: { hostname: 'localhost', origin: 'http://localhost' },
    }
    ;(globalThis as any).document = {}
    ;(globalThis as any).navigator = {
      credentials: { create: () => Promise.resolve(null), get: () => Promise.resolve(null) },
    }
  })

  afterEach(() => {
    ;(globalThis as any).window = originalWindow
    ;(globalThis as any).navigator = originalNavigator
    ;(globalThis as any).document = originalDocument
  })

  const enrollError = new AuthError('A factor with the friendly name already exists', 422)

  function buildClient(
    factors: Array<{ id: string; factor_type: string; friendly_name: string; status: string }>
  ) {
    return {
      mfa: {
        enroll: jest.fn().mockResolvedValue({ data: null, error: enrollError }),
        listFactors: jest.fn().mockResolvedValue({ data: { all: factors }, error: null }),
        unenroll: jest.fn().mockResolvedValue({ data: null, error: null }),
      },
    }
  }

  test('does not unenroll a verified factor with the same friendly name', async () => {
    const client = buildClient([
      {
        id: 'verified-factor',
        factor_type: 'webauthn',
        friendly_name: 'my-key',
        status: 'verified',
      },
    ])
    const api = new WebAuthnApi(client as unknown as GoTrueClient)

    const { data, error } = await api.register({
      friendlyName: 'my-key',
      webauthn: { rpId: 'localhost' },
    })

    expect(data).toBeNull()
    expect(error).toBe(enrollError)
    expect(client.mfa.unenroll).not.toHaveBeenCalled()
  })

  test('unenrolls only the unverified leftover with the same friendly name', async () => {
    const client = buildClient([
      {
        id: 'verified-factor',
        factor_type: 'webauthn',
        friendly_name: 'my-key',
        status: 'verified',
      },
      {
        id: 'leftover-factor',
        factor_type: 'webauthn',
        friendly_name: 'my-key',
        status: 'unverified',
      },
    ])
    const api = new WebAuthnApi(client as unknown as GoTrueClient)

    const { error } = await api.register({
      friendlyName: 'my-key',
      webauthn: { rpId: 'localhost' },
    })

    expect(error).toBe(enrollError)
    expect(client.mfa.unenroll).toHaveBeenCalledTimes(1)
    expect(client.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'leftover-factor' })
  })

  test('leaves factors of other names and types untouched', async () => {
    const client = buildClient([
      {
        id: 'other-name',
        factor_type: 'webauthn',
        friendly_name: 'other-key',
        status: 'unverified',
      },
      { id: 'totp-factor', factor_type: 'totp', friendly_name: 'my-key', status: 'unverified' },
    ])
    const api = new WebAuthnApi(client as unknown as GoTrueClient)

    const { error } = await api.register({
      friendlyName: 'my-key',
      webauthn: { rpId: 'localhost' },
    })

    expect(error).toBe(enrollError)
    expect(client.mfa.unenroll).not.toHaveBeenCalled()
  })
})
