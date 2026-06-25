import 'jest'

import { WebAuthnError, WebAuthnUnknownError } from '../src/lib/webauthn.errors'

describe('WebAuthnError serialization', () => {
  test('WebAuthnError serializes message, name, and code with JSON.stringify', () => {
    const err = new WebAuthnError({
      message: 'Registration ceremony was sent an abort signal',
      code: 'ERROR_CEREMONY_ABORTED',
    })

    const serialized = JSON.parse(JSON.stringify(err))

    expect(serialized.message).toBe('Registration ceremony was sent an abort signal')
    expect(serialized.code).toBe('ERROR_CEREMONY_ABORTED')
    expect(serialized.name).toBe('Unknown Error')
  })

  test('WebAuthnError preserves explicit name when provided', () => {
    const err = new WebAuthnError({
      message: 'something went wrong',
      code: 'ERROR_AUTHENTICATOR_GENERAL_ERROR',
      name: 'CustomName',
    })

    const serialized = JSON.parse(JSON.stringify(err))

    expect(serialized.name).toBe('CustomName')
  })

  test('WebAuthnUnknownError serializes message, name, and code with JSON.stringify', () => {
    const err = new WebAuthnUnknownError('passkey failed', new Error('boom'))

    const serialized = JSON.parse(JSON.stringify(err))

    expect(serialized.message).toBe('passkey failed')
    expect(serialized.name).toBe('WebAuthnUnknownError')
    expect(serialized.code).toBe('ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY')
  })

  test('WebAuthnUnknownError does not leak originalError on serialization', () => {
    const err = new WebAuthnUnknownError('passkey failed', new Error('boom'))

    const serialized = JSON.parse(JSON.stringify(err))

    expect(serialized.originalError).toBeUndefined()
  })
})
