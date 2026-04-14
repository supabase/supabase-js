import 'jest'

import {
  AuthError,
  AuthApiError,
  AuthUnknownError,
  AuthSessionMissingError,
  AuthInvalidTokenResponseError,
  AuthInvalidCredentialsError,
  AuthImplicitGrantRedirectError,
  AuthPKCEGrantCodeExchangeError,
  AuthPKCECodeVerifierMissingError,
  AuthRetryableFetchError,
  AuthWeakPasswordError,
  AuthInvalidJwtError,
} from '../src/lib/errors'

describe('AuthError serialization', () => {
  test('AuthError serializes message with JSON.stringify', () => {
    const err = new AuthError('something went wrong', 500, 'unexpected')
    const serialized = JSON.parse(JSON.stringify(err))
    expect(serialized.message).toBe('something went wrong')
    expect(serialized.name).toBe('AuthError')
    expect(serialized.status).toBe(500)
    expect(serialized.code).toBe('unexpected')
  })

  test('AuthApiError serializes message with JSON.stringify', () => {
    const err = new AuthApiError('Invalid credentials', 400, 'invalid_credentials')
    const serialized = JSON.parse(JSON.stringify(err))
    expect(serialized.message).toBe('Invalid credentials')
    expect(serialized.name).toBe('AuthApiError')
    expect(serialized.status).toBe(400)
    expect(serialized.code).toBe('invalid_credentials')
  })

  test('AuthUnknownError serializes message with JSON.stringify', () => {
    const err = new AuthUnknownError('Auth failed', new Error('original'))
    const serialized = JSON.parse(JSON.stringify(err))
    expect(serialized.message).toBe('Auth failed')
    expect(serialized.name).toBe('AuthUnknownError')
    expect(serialized).not.toHaveProperty('originalError')
  })

  test('AuthSessionMissingError serializes message with JSON.stringify', () => {
    const err = new AuthSessionMissingError()
    const serialized = JSON.parse(JSON.stringify(err))
    expect(serialized.message).toBe('Auth session missing!')
    expect(serialized.name).toBe('AuthSessionMissingError')
    expect(serialized.status).toBe(400)
  })

  test('AuthInvalidTokenResponseError serializes message with JSON.stringify', () => {
    const err = new AuthInvalidTokenResponseError()
    const serialized = JSON.parse(JSON.stringify(err))
    expect(serialized.message).toBe('Auth session or user missing')
    expect(serialized.name).toBe('AuthInvalidTokenResponseError')
    expect(serialized.status).toBe(500)
  })

  test('AuthInvalidCredentialsError serializes message with JSON.stringify', () => {
    const err = new AuthInvalidCredentialsError('Email or password is incorrect')
    const serialized = JSON.parse(JSON.stringify(err))
    expect(serialized.message).toBe('Email or password is incorrect')
    expect(serialized.name).toBe('AuthInvalidCredentialsError')
    expect(serialized.status).toBe(400)
  })

  test('AuthImplicitGrantRedirectError serializes message and details with JSON.stringify', () => {
    const details = { error: 'access_denied', code: 'oauth_error' }
    const err = new AuthImplicitGrantRedirectError('OAuth redirect failed', details)
    const serialized = JSON.parse(JSON.stringify(err))
    expect(serialized.message).toBe('OAuth redirect failed')
    expect(serialized.name).toBe('AuthImplicitGrantRedirectError')
    expect(serialized.status).toBe(500)
    expect(serialized.details).toEqual(details)
  })

  test('AuthPKCEGrantCodeExchangeError serializes message and details with JSON.stringify', () => {
    const details = { error: 'code_expired', code: 'pkce_error' }
    const err = new AuthPKCEGrantCodeExchangeError('PKCE exchange failed', details)
    const serialized = JSON.parse(JSON.stringify(err))
    expect(serialized.message).toBe('PKCE exchange failed')
    expect(serialized.name).toBe('AuthPKCEGrantCodeExchangeError')
    expect(serialized.status).toBe(500)
    expect(serialized.details).toEqual(details)
  })

  test('AuthPKCECodeVerifierMissingError serializes message with JSON.stringify', () => {
    const err = new AuthPKCECodeVerifierMissingError()
    const serialized = JSON.parse(JSON.stringify(err))
    expect(serialized.message).toContain('PKCE code verifier not found in storage')
    expect(serialized.name).toBe('AuthPKCECodeVerifierMissingError')
    expect(serialized.status).toBe(400)
    expect(serialized.code).toBe('pkce_code_verifier_not_found')
  })

  test('AuthRetryableFetchError serializes message with JSON.stringify', () => {
    const err = new AuthRetryableFetchError('Service unavailable', 503)
    const serialized = JSON.parse(JSON.stringify(err))
    expect(serialized.message).toBe('Service unavailable')
    expect(serialized.name).toBe('AuthRetryableFetchError')
    expect(serialized.status).toBe(503)
  })

  test('AuthWeakPasswordError serializes message and reasons with JSON.stringify', () => {
    const err = new AuthWeakPasswordError('Password too short', 422, ['length', 'characters'])
    const serialized = JSON.parse(JSON.stringify(err))
    expect(serialized.message).toBe('Password too short')
    expect(serialized.name).toBe('AuthWeakPasswordError')
    expect(serialized.status).toBe(422)
    expect(serialized.code).toBe('weak_password')
    expect(serialized.reasons).toEqual(['length', 'characters'])
  })

  test('AuthInvalidJwtError serializes message with JSON.stringify', () => {
    const err = new AuthInvalidJwtError('Token expired')
    const serialized = JSON.parse(JSON.stringify(err))
    expect(serialized.message).toBe('Token expired')
    expect(serialized.name).toBe('AuthInvalidJwtError')
    expect(serialized.status).toBe(400)
    expect(serialized.code).toBe('invalid_jwt')
  })
})
