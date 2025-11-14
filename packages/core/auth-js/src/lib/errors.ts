import { WeakPasswordReasons } from './types'
import { ErrorCode } from './error-codes'

/**
 * Base error thrown by Supabase Auth helpers.
 *
 * @example
 * ```ts
 * import { AuthError } from '@supabase/auth-js'
 *
 * throw new AuthError('Unexpected auth error', 500, 'unexpected')
 * ```
 */
export class AuthError extends Error {
  /**
   * Error code associated with the error. Most errors coming from
   * HTTP responses will have a code, though some errors that occur
   * before a response is received will not have one present. In that
   * case {@link #status} will also be undefined.
   */
  code: ErrorCode | (string & {}) | undefined

  /** HTTP status code that caused the error. */
  status: number | undefined

  protected __isAuthError = true

  constructor(message: string, status?: number, code?: string) {
    super(message)
    this.name = 'AuthError'
    this.status = status
    this.code = code
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return typeof error === 'object' && error !== null && '__isAuthError' in error
}

/**
 * Error returned directly from the GoTrue REST API.
 *
 * @example
 * ```ts
 * import { AuthApiError } from '@supabase/auth-js'
 *
 * throw new AuthApiError('Invalid credentials', 400, 'invalid_credentials')
 * ```
 */
export class AuthApiError extends AuthError {
  status: number

  constructor(message: string, status: number, code: string | undefined) {
    super(message, status, code)
    this.name = 'AuthApiError'
    this.status = status
    this.code = code
  }
}

export function isAuthApiError(error: unknown): error is AuthApiError {
  return isAuthError(error) && error.name === 'AuthApiError'
}

/**
 * Wraps non-standard errors so callers can inspect the root cause.
 *
 * @example
 * ```ts
 * import { AuthUnknownError } from '@supabase/auth-js'
 *
 * try {
 *   await someAuthCall()
 * } catch (err) {
 *   throw new AuthUnknownError('Auth failed', err)
 * }
 * ```
 */
export class AuthUnknownError extends AuthError {
  originalError: unknown

  constructor(message: string, originalError: unknown) {
    super(message)
    this.name = 'AuthUnknownError'
    this.originalError = originalError
  }
}

/**
 * Flexible error class used to create named auth errors at runtime.
 *
 * @example
 * ```ts
 * import { CustomAuthError } from '@supabase/auth-js'
 *
 * throw new CustomAuthError('My custom auth error', 'MyAuthError', 400, 'custom_code')
 * ```
 */
export class CustomAuthError extends AuthError {
  name: string
  status: number

  constructor(message: string, name: string, status: number, code: string | undefined) {
    super(message, status, code)
    this.name = name
    this.status = status
  }
}

/**
 * Error thrown when an operation requires a session but none is present.
 *
 * @example
 * ```ts
 * import { AuthSessionMissingError } from '@supabase/auth-js'
 *
 * throw new AuthSessionMissingError()
 * ```
 */
export class AuthSessionMissingError extends CustomAuthError {
  constructor() {
    super('Auth session missing!', 'AuthSessionMissingError', 400, undefined)
  }
}

export function isAuthSessionMissingError(error: any): error is AuthSessionMissingError {
  return isAuthError(error) && error.name === 'AuthSessionMissingError'
}

/**
 * Error thrown when the token response is malformed.
 *
 * @example
 * ```ts
 * import { AuthInvalidTokenResponseError } from '@supabase/auth-js'
 *
 * throw new AuthInvalidTokenResponseError()
 * ```
 */
export class AuthInvalidTokenResponseError extends CustomAuthError {
  constructor() {
    super('Auth session or user missing', 'AuthInvalidTokenResponseError', 500, undefined)
  }
}

/**
 * Error thrown when email/password credentials are invalid.
 *
 * @example
 * ```ts
 * import { AuthInvalidCredentialsError } from '@supabase/auth-js'
 *
 * throw new AuthInvalidCredentialsError('Email or password is incorrect')
 * ```
 */
export class AuthInvalidCredentialsError extends CustomAuthError {
  constructor(message: string) {
    super(message, 'AuthInvalidCredentialsError', 400, undefined)
  }
}

/**
 * Error thrown when implicit grant redirects contain an error.
 *
 * @example
 * ```ts
 * import { AuthImplicitGrantRedirectError } from '@supabase/auth-js'
 *
 * throw new AuthImplicitGrantRedirectError('OAuth redirect failed', {
 *   error: 'access_denied',
 *   code: 'oauth_error',
 * })
 * ```
 */
export class AuthImplicitGrantRedirectError extends CustomAuthError {
  details: { error: string; code: string } | null = null
  constructor(message: string, details: { error: string; code: string } | null = null) {
    super(message, 'AuthImplicitGrantRedirectError', 500, undefined)
    this.details = details
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      details: this.details,
    }
  }
}

export function isAuthImplicitGrantRedirectError(
  error: any
): error is AuthImplicitGrantRedirectError {
  return isAuthError(error) && error.name === 'AuthImplicitGrantRedirectError'
}

/**
 * Error thrown during PKCE code exchanges.
 *
 * @example
 * ```ts
 * import { AuthPKCEGrantCodeExchangeError } from '@supabase/auth-js'
 *
 * throw new AuthPKCEGrantCodeExchangeError('PKCE exchange failed')
 * ```
 */
export class AuthPKCEGrantCodeExchangeError extends CustomAuthError {
  details: { error: string; code: string } | null = null

  constructor(message: string, details: { error: string; code: string } | null = null) {
    super(message, 'AuthPKCEGrantCodeExchangeError', 500, undefined)
    this.details = details
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      details: this.details,
    }
  }
}

/**
 * Error thrown when a transient fetch issue occurs.
 *
 * @example
 * ```ts
 * import { AuthRetryableFetchError } from '@supabase/auth-js'
 *
 * throw new AuthRetryableFetchError('Service temporarily unavailable', 503)
 * ```
 */
export class AuthRetryableFetchError extends CustomAuthError {
  constructor(message: string, status: number) {
    super(message, 'AuthRetryableFetchError', status, undefined)
  }
}

export function isAuthRetryableFetchError(error: unknown): error is AuthRetryableFetchError {
  return isAuthError(error) && error.name === 'AuthRetryableFetchError'
}

/**
 * This error is thrown on certain methods when the password used is deemed
 * weak. Inspect the reasons to identify what password strength rules are
 * inadequate.
 */
/**
 * Error thrown when a supplied password is considered weak.
 *
 * @example
 * ```ts
 * import { AuthWeakPasswordError } from '@supabase/auth-js'
 *
 * throw new AuthWeakPasswordError('Password too short', 400, ['min_length'])
 * ```
 */
export class AuthWeakPasswordError extends CustomAuthError {
  /**
   * Reasons why the password is deemed weak.
   */
  reasons: WeakPasswordReasons[]

  constructor(message: string, status: number, reasons: WeakPasswordReasons[]) {
    super(message, 'AuthWeakPasswordError', status, 'weak_password')

    this.reasons = reasons
  }
}

export function isAuthWeakPasswordError(error: unknown): error is AuthWeakPasswordError {
  return isAuthError(error) && error.name === 'AuthWeakPasswordError'
}

/**
 * Error thrown when a JWT cannot be verified or parsed.
 *
 * @example
 * ```ts
 * import { AuthInvalidJwtError } from '@supabase/auth-js'
 *
 * throw new AuthInvalidJwtError('Token signature is invalid')
 * ```
 */
export class AuthInvalidJwtError extends CustomAuthError {
  constructor(message: string) {
    super(message, 'AuthInvalidJwtError', 400, 'invalid_jwt')
  }
}
