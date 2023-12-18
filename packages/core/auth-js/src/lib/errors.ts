import { WeakPasswordReasons } from './types'

export class AuthError extends Error {
  status: number | undefined
  protected __isAuthError = true

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return typeof error === 'object' && error !== null && '__isAuthError' in error
}

export class AuthApiError extends AuthError {
  status: number

  constructor(message: string, status: number) {
    super(message, status)
    this.name = 'AuthApiError'
    this.status = status
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
    }
  }
}

export function isAuthApiError(error: unknown): error is AuthApiError {
  return isAuthError(error) && error.name === 'AuthApiError'
}

export class AuthUnknownError extends AuthError {
  originalError: unknown

  constructor(message: string, originalError: unknown) {
    super(message)
    this.name = 'AuthUnknownError'
    this.originalError = originalError
  }
}

export class CustomAuthError extends AuthError {
  name: string
  status: number
  constructor(message: string, name: string, status: number) {
    super(message)
    this.name = name
    this.status = status
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
    }
  }
}

export class AuthSessionMissingError extends CustomAuthError {
  constructor() {
    super('Auth session missing!', 'AuthSessionMissingError', 400)
  }
}

export class AuthInvalidTokenResponseError extends CustomAuthError {
  constructor() {
    super('Auth session or user missing', 'AuthInvalidTokenResponseError', 500)
  }
}

export class AuthInvalidCredentialsError extends CustomAuthError {
  constructor(message: string) {
    super(message, 'AuthInvalidCredentialsError', 400)
  }
}

export class AuthImplicitGrantRedirectError extends CustomAuthError {
  details: { error: string; code: string } | null = null
  constructor(message: string, details: { error: string; code: string } | null = null) {
    super(message, 'AuthImplicitGrantRedirectError', 500)
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

export class AuthPKCEGrantCodeExchangeError extends CustomAuthError {
  details: { error: string; code: string } | null = null
  constructor(message: string, details: { error: string; code: string } | null = null) {
    super(message, 'AuthPKCEGrantCodeExchangeError', 500)
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

export class AuthRetryableFetchError extends CustomAuthError {
  constructor(message: string, status: number) {
    super(message, 'AuthRetryableFetchError', status)
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
export class AuthWeakPasswordError extends CustomAuthError {
  /**
   * Reasons why the password is deemed weak.
   */
  reasons: WeakPasswordReasons[]

  constructor(message: string, status: number, reasons: string[]) {
    super(message, 'AuthWeakPasswordError', status)

    this.reasons = reasons
  }
}

export function isAuthWeakPasswordError(error: unknown): error is AuthWeakPasswordError {
  return isAuthError(error) && error.name === 'AuthWeakPasswordError'
}
